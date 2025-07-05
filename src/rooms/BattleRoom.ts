import { Room, type Client, updateLobby } from "@colyseus/core"
import { BattleState } from "../schemas/BattleState"
import type { BattlePlayer } from "../schemas/BattlePlayer"

export class BattleRoom extends Room<BattleState> {
  maxClients = 8
  private gameTimer: any = null
  private updateInterval: any = null

  onCreate(options: any) {
    console.log("⚔️ BattleRoom created!", options)

    // Set metadata for room discovery
    this.setMetadata({
      name: options.roomName || `Battle_${Date.now().toString().substring(8)}`,
      gameType: "battle",
      gameMode: options.gameMode || "deathmatch",
      mapTheme: options.mapTheme || "default",
      maxPlayers: options.maxPlayers || 8,
      fromLobby: options.fromLobby || false,
      lobbyId: options.lobbyId || null,
      hostName: options.hostName || "Unknown",
      createdAt: Date.now(),
      currentPlayers: 0,
      gameStarted: false,
      gameEnded: false,
    }).then(() => {
      updateLobby(this)
    })

    this.setState(new BattleState())
    this.state.gameMode = options.gameMode || "deathmatch"
    this.state.mapTheme = options.mapTheme || "default"
    this.state.maxPlayers = options.maxPlayers || 8

    this.setupMessageHandlers()

    // Start update loop
    this.updateInterval = setInterval(() => {
      this.updateGame()
    }, 1000 / 60) // 60 FPS

    console.log(`⚔️ BattleRoom ${this.roomId} ready for battle!`)
  }

  private setupMessageHandlers() {
    this.onMessage("ready", (client: Client, message: any) => {
      const player = this.state.players.get(client.sessionId)
      if (player) {
        player.ready = !player.ready
        console.log(`⚔️ Player ${player.name} is ${player.ready ? "ready" : "not ready"}`)

        this.updateMetadataAndLobby()

        this.broadcast("player_ready_changed", {
          playerId: client.sessionId,
          ready: player.ready,
          timestamp: Date.now(),
        })

        // Check if all players are ready to start game
        if (this.state.areAllPlayersReady() && this.state.players.size >= 2 && !this.state.gameStarted) {
          this.startGame()
        }
      }
    })

    this.onMessage("move", (client: Client, message: any) => {
      const player = this.state.players.get(client.sessionId)
      if (player && this.state.gameStarted && player.isAlive) {
        player.setPosition(message.x, message.y, message.z)
        if (message.animationState) {
          player.setAnimationState(message.animationState)
        }
      }
    })

    this.onMessage("attack", (client: Client, message: any) => {
      const attacker = this.state.players.get(client.sessionId)
      if (attacker && this.state.gameStarted && attacker.isAlive) {
        this.handleAttack(attacker, message)
      }
    })

    this.onMessage("respawn", (client: Client, message: any) => {
      const player = this.state.players.get(client.sessionId)
      if (player && this.state.gameStarted && !player.isAlive) {
        player.respawn()
        console.log(`⚔️ Player ${player.name} respawned`)

        this.broadcast("player_respawned", {
          playerId: client.sessionId,
          playerName: player.name,
          timestamp: Date.now(),
        })
      }
    })

    this.onMessage("ping", (client: Client, message: any) => {
      client.send("pong", { timestamp: Date.now() })
    })
  }

  private handleAttack(attacker: BattlePlayer, attackData: any) {
    const damage = attackData.damage || 25
    const range = attackData.range || 50

    // Find players within attack range
    this.state.players.forEach((target, targetId) => {
      if (targetId !== attacker.sessionId && target.isAlive) {
        const distance = attacker.getDistance(target)
        if (distance <= range) {
          target.takeDamage(damage)

          console.log(`⚔️ ${attacker.name} attacked ${target.name} for ${damage} damage`)

          this.broadcast("player_attacked", {
            attackerId: attacker.sessionId,
            targetId: targetId,
            damage: damage,
            targetHealth: target.health,
            timestamp: Date.now(),
          })

          // Check if target was killed
          if (!target.isAlive) {
            attacker.addKill()
            console.log(`💀 ${target.name} was killed by ${attacker.name}`)

            this.broadcast("player_killed", {
              killerId: attacker.sessionId,
              victimId: targetId,
              killerName: attacker.name,
              victimName: target.name,
              timestamp: Date.now(),
            })

            // Check win conditions
            const winner = this.state.checkWinConditions()
            if (winner) {
              this.endGame(winner)
            }
          }
        }
      }
    })
  }

  private updateGame() {
    if (!this.state.gameStarted || this.state.gameEnded) return

    // Check win conditions
    const winner = this.state.checkWinConditions()
    if (winner) {
      this.endGame(winner)
    }

    // Update metadata periodically
    if (Date.now() % 5000 < 16) {
      // Every ~5 seconds
      this.updateMetadataAndLobby()
    }
  }

  private startGame() {
    console.log(`⚔️ Starting battle in room ${this.roomId}`)

    this.state.startGame()

    // Update metadata
    this.setMetadata({
      ...this.metadata,
      gameStarted: true,
    }).then(() => {
      updateLobby(this)
    })

    this.broadcast("game_started", {
      message: "Battle has begun!",
      gameMode: this.state.gameMode,
      mapTheme: this.state.mapTheme,
      timeLimit: this.state.timeLimit,
      scoreLimit: this.state.scoreLimit,
      timestamp: Date.now(),
    })

    // Start game timer
    this.gameTimer = setTimeout(() => {
      if (!this.state.gameEnded) {
        const winner = this.state.getLeaderboard()[0]
        this.endGame(winner ? winner.name : "Time's up!")
      }
    }, this.state.timeLimit * 1000)
  }

  private endGame(winner: string) {
    console.log(`⚔️ Battle ended in room ${this.roomId}. Winner: ${winner}`)

    this.state.endGame(winner)

    if (this.gameTimer) {
      clearTimeout(this.gameTimer)
      this.gameTimer = null
    }

    // Update metadata
    this.setMetadata({
      ...this.metadata,
      gameEnded: true,
      winner: winner,
    }).then(() => {
      updateLobby(this)
    })

    this.broadcast("game_ended", {
      winner: winner,
      leaderboard: this.state.getLeaderboard(),
      gameStats: this.state.getGameStats(),
      timestamp: Date.now(),
    })

    // Close room after a delay
    setTimeout(() => {
      console.log(`⚔️ Closing battle room ${this.roomId}`)
      this.disconnect()
    }, 30000) // 30 seconds
  }

  private async updateMetadataAndLobby() {
    const playerCount = this.state.players.size
    const readyCount = this.state.getReadyPlayers().length
    const aliveCount = this.state.getAlivePlayers().length

    await this.setMetadata({
      ...this.metadata,
      currentPlayers: playerCount,
      readyPlayers: readyCount,
      alivePlayers: aliveCount,
      gameStarted: this.state.gameStarted,
      gameEnded: this.state.gameEnded,
      remainingTime: this.state.getRemainingTime(),
      lastUpdate: Date.now(),
    })

    try {
      await updateLobby(this)
    } catch (error) {
      console.error("❌ Failed to update battle room lobby:", error)
    }
  }

  async onAuth(client: Client, options: any) {
    console.log(`🔐 BattleRoom: Authentication request from ${client.sessionId}`, options)

    try {
      if (!options || typeof options !== "object") {
        throw new Error("Invalid authentication options")
      }

      let username = options.username
      if (!username || typeof username !== "string" || username.trim() === "") {
        username = `Player_${client.sessionId.substring(0, 6)}`
      }

      username = username.trim().substring(0, 20)

      if (this.clients.length >= this.maxClients) {
        throw new Error("Battle room is full")
      }

      console.log(`✅ BattleRoom: Authentication successful for ${client.sessionId} (${username})`)
      return {
        username: username,
        authenticated: true,
        joinTime: Date.now(),
        characterType: options.characterType || "default",
      }
    } catch (error: any) {
      console.error(`❌ BattleRoom: Authentication failed for ${client.sessionId}:`, error.message)
      throw error
    }
  }

  async onJoin(client: Client, options: any) {
    console.log(`🚪 BattleRoom: Player ${client.sessionId} (${options.username}) joined the battle`)

    try {
      const username = options.username || `Player_${client.sessionId.substring(0, 6)}`

      // Add player to battle state
      const player = this.state.addPlayer(client.sessionId, username, options.characterType || "default")

      console.log(`✅ BattleRoom: Player ${username} added to battle state`)

      const playerCount = this.state.players.size

      // Update metadata
      await this.updateMetadataAndLobby()

      // Send welcome message to new player
      client.send("battle_joined", {
        message: `Welcome to the battle, ${username}!`,
        playerId: client.sessionId,
        playerName: username,
        gameMode: this.state.gameMode,
        mapTheme: this.state.mapTheme,
        gameStarted: this.state.gameStarted,
        playerCount: playerCount,
        timestamp: Date.now(),
      })

      // Send current game state to new player
      client.send("game_state_update", {
        gameStats: this.state.getGameStats(),
        timestamp: Date.now(),
      })

      // Broadcast player joined to all other players
      this.broadcast(
        "player_joined_battle",
        {
          playerId: client.sessionId,
          playerName: username,
          playerCount: playerCount,
          timestamp: Date.now(),
        },
        { except: client },
      )

      console.log(`📊 BattleRoom: Now has ${playerCount} players`)
    } catch (error: any) {
      console.error(`❌ BattleRoom: Error in onJoin for ${client.sessionId}:`, error)
      client.send("error", { message: "Failed to join battle" })
    }
  }

  async onLeave(client: Client, consented: boolean) {
    console.log(`👋 BattleRoom: Player ${client.sessionId} left the battle (consented: ${consented})`)

    try {
      const removed = this.state.removePlayer(client.sessionId)

      if (removed) {
        console.log(`✅ BattleRoom: Player ${client.sessionId} removed from battle state`)

        // Update metadata
        await this.updateMetadataAndLobby()

        this.broadcast("player_left_battle", {
          playerId: client.sessionId,
          timestamp: Date.now(),
        })
      }

      const remainingPlayers = this.state.players.size
      console.log(`📊 BattleRoom: Now has ${remainingPlayers} players`)

      // End game if not enough players
      if (remainingPlayers < 2 && this.state.gameStarted && !this.state.gameEnded) {
        const winner = this.state.getAllPlayers()[0]
        this.endGame(winner ? winner.name : "Not enough players")
      }

      // Close room if empty
      if (remainingPlayers === 0) {
        console.log(`⚔️ BattleRoom: Room is empty, scheduling cleanup...`)
        setTimeout(() => {
          this.disconnect()
        }, 5000)
      }
    } catch (error: any) {
      console.error(`❌ BattleRoom: Error in onLeave for ${client.sessionId}:`, error)
    }
  }

  onDispose() {
    console.log("⚔️ BattleRoom: Room disposed")
    if (this.gameTimer) {
      clearTimeout(this.gameTimer)
    }
    if (this.updateInterval) {
      clearInterval(this.updateInterval)
    }
  }

  onError(client: Client, error: any) {
    console.error(`❌ BattleRoom: Client ${client.sessionId} error:`, error)
  }
}
