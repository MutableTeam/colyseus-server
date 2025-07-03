import { Room, type Client } from "@colyseus/core"
import { BattleState } from "../schemas/BattleState"
import { AbilityManager } from "../managers/AbilityManager"
import { CollisionManager } from "../managers/CollisionManager"
import type { BattlePlayer } from "../schemas/BattlePlayer"
import { Vector3D } from "../schemas/Vector3D"

export class BattleRoom extends Room<BattleState> {
  maxClients = 16
  private gameStarted = false
  private gameStartTimer: any = null
  private readyCheckInterval: any = null
  private abilityManager: AbilityManager = new AbilityManager()
  private collisionManager: CollisionManager = new CollisionManager()
  private gameLoopInterval: any
  private lastUpdate: number = Date.now()

  onCreate(options: any) {
    console.log("⚔️ BattleRoom created!", options)

    // Set metadata for room discovery
    this.setMetadata({
      name: options.roomName || `Battle_${Date.now().toString().substring(8)}`,
      gameType: "battle",
      gameMode: options.gameMode || "deathmatch",
      isPublic: true,
      createdAt: Date.now(),
      gameStarted: this.gameStarted,
      fromLobby: options.fromLobby || false,
    })

    // Initialize battle state
    this.setState(new BattleState())
    this.state.gameMode = options.gameMode || "deathmatch"
    this.state.roomName = options.roomName || `Battle_${Date.now().toString().substring(8)}`
    this.state.maxPlayers = options.maxPlayers || 16
    this.state.gameStarted = false

    // Set up message handlers
    this.setupMessageHandlers()

    // Start ready check interval
    this.startReadyCheck()

    // Start game loop
    this.startGameLoop()

    console.log(`⚔️ BattleRoom ${this.roomId} ready for players!`)
  }

  private setupMessageHandlers() {
    // Handle player ready state
    this.onMessage("ready", (client: Client, message: any) => {
      const player = this.state.players.get(client.sessionId) as BattlePlayer
      if (player) {
        player.setReady(message.ready)
        
        this.broadcast("player_ready_changed", {
          playerId: client.sessionId,
          playerName: player.name,
          ready: player.ready,
          timestamp: Date.now(),
        })

        console.log(`🎯 BattleRoom: Player ${player.name} ready state: ${player.ready}`)
        this.checkGameStart()
      }
    })

    // Handle player movement (for Three.js)
    this.onMessage("player_move", (client: Client, message: any) => {
      const player = this.state.players.get(client.sessionId) as BattlePlayer
      if (player && message.position) {
        player.position.x = message.position.x
        player.position.y = message.position.y
        player.position.z = message.position.z

        if (message.rotation) {
          player.rotation.x = message.rotation.x
          player.rotation.y = message.rotation.y
          player.rotation.z = message.rotation.z
          player.rotation.w = message.rotation.w
        }
      }
    })

    // Handle player actions
    this.onMessage("player_action", (client: Client, message: any) => {
      const player = this.state.players.get(client.sessionId) as BattlePlayer
      const abilityType = message.abilityType
      let success = false

      if (player) {
        // Handle different action types
        switch (message.type) {
          case "shoot":
            this.handlePlayerShoot(client, message)
            break
          case "jump":
            this.handlePlayerJump(client, message)
            break
          case "ability":
            success = this.abilityManager.useAbility(this, player, abilityType, message.targetPosition || null)
            break
        }
      }

      if (success) {
        // Broadcast ability use to all players
        this.broadcast("player_used_ability", {
          playerId: client.sessionId,
          abilityType: abilityType,
          position: player?.position,
          timestamp: Date.now(),
        })
      } else if (message.type === "ability") {
        // Send failure message to player
        client.send("ability_failed", {
          abilityType: abilityType,
          reason: "Cooldown or insufficient resources",
          timestamp: Date.now(),
        })
      }
    })

    // Handle ping/heartbeat messages
    this.onMessage("ping", (client: Client, message: any) => {
      client.send("pong", { timestamp: Date.now() })
    })

    // Handle test message for debugging
    this.onMessage("test_message", (client: Client, message: any) => {
      console.log(`🧪 BattleRoom: Test message from ${client.sessionId}:`, message)

      const player = this.state.players.get(client.sessionId) as BattlePlayer
      const playerCount = this.state.players.size

      client.send("test_response", {
        message: "Battle room test response",
        timestamp: Date.now(),
        clientId: client.sessionId,
        roomId: this.roomId,
        playerFound: !!player,
        playerName: player?.name || "Unknown",
        totalPlayers: playerCount,
        gameStarted: this.gameStarted,
        gameMode: this.state.gameMode,
        connectedClients: this.clients.length,
      })

      this.broadcastBattleStats()
    })

    // Handle game actions (simplified)
    this.onMessage("game_action", (client: Client, message: any) => {
      const player = this.state.players.get(client.sessionId) as BattlePlayer
      if (!player || !this.gameStarted) return

      switch (message.type) {
        case "score":
          player.addScore(message.points || 10)
          this.broadcast("player_scored", {
            playerId: client.sessionId,
            points: message.points || 10,
            totalScore: player.score,
          })
          break
        case "kill":
          player.addKill()
          const victim = this.state.players.get(message.victimId)
          if (victim) {
            victim.addDeath()
          }
          this.broadcast("player_kill", {
            killerId: client.sessionId,
            victimId: message.victimId,
          })
          this.state.checkWinCondition()
          break
      }
    })

    // Handle leave game
    this.onMessage("leave_game", (client: Client) => {
      this.handlePlayerLeave(client.sessionId)
    })
  }

  private startReadyCheck() {
    this.readyCheckInterval = setInterval(() => {
      this.checkGameStart()
    }, 1000) // Check every second
  }

  private checkGameStart() {
    if (this.gameStarted || !this.state.canStartGame()) return

    const playerCount = this.state.getPlayerCount()
    const readyCount = this.state.getReadyPlayerCount()

    console.log(`🎯 BattleRoom: Ready check - ${readyCount}/${playerCount} players ready`)

    if (this.state.canStartGame()) {
      this.scheduleGameStart()
    }
  }

  private startGameLoop() {
    // 60 FPS game loop
    this.gameLoopInterval = setInterval(() => {
      const now = Date.now()
      const deltaTime = (now - this.lastUpdate) / 1000 // Convert to seconds
      this.lastUpdate = now

      this.updateGame(deltaTime)
    }, 1000 / 60) // 60 FPS
  }

  private updateGame(deltaTime: number) {
    // Update game time
    this.state.updateGameTime(deltaTime)

    // Update projectiles
    this.updateProjectiles(deltaTime)

    // Update player cooldowns
    this.state.players.forEach((player) => {
      player.updateCooldowns()
    })

    // Check win condition
    this.state.checkWinCondition()

    // Clean up inactive projectiles
    this.state.cleanupProjectiles()
  }

  private updateProjectiles(deltaTime: number) {
    const projectilesToRemove: string[] = []

    this.state.projectiles.forEach((projectile, id) => {
      if (!projectile.isActive) {
        projectilesToRemove.push(id)
        return
      }

      // Update projectile position
      projectile.update(deltaTime)

      // Check for collisions with players
      this.state.players.forEach((player) => {
        if (player.sessionId !== projectile.ownerId && player.isAlive) {
          const distance = this.calculateDistance(projectile.position, player.position)

          if (distance < player.radius) {
            // Hit detected
            const died = player.takeDamage(projectile.damage)

            if (died) {
              // Award kill to shooter
              const shooter = this.state.players.get(projectile.ownerId) as BattlePlayer
              if (shooter) {
                shooter.addKill()
              }

              this.broadcast("player_killed", {
                victimId: player.sessionId,
                killerId: projectile.ownerId,
                position: player.position,
              })
            }

            this.broadcast("player_hit", {
              playerId: player.sessionId,
              damage: projectile.damage,
              health: player.health,
              position: player.position,
            })

            // Remove projectile
            projectile.isActive = false
            projectilesToRemove.push(id)
          }
        }
      })
    })

    // Clean up inactive projectiles
    projectilesToRemove.forEach((id) => {
      this.state.removeProjectile(id)
    })
  }

  private calculateDistance(pos1: Vector3D, pos2: Vector3D): number {
    const dx = pos1.x - pos2.x
    const dy = pos1.y - pos2.y
    const dz = pos1.z - pos2.z
    return Math.sqrt(dx * dx + dy * dy + dz * dz)
  }

  private handlePlayerShoot(client: Client, message: any) {
    const player = this.state.players.get(client.sessionId) as BattlePlayer
    if (!player || !this.gameStarted) return

    // Create projectile using the method on BattleState
    const projectile = this.state.addProjectile(
      client.sessionId,
      message.position,
      message.direction,
      message.weaponType || "default",
    )

    // Broadcast to all players
    this.broadcast("player_shot", {
      playerId: client.sessionId,
      projectileId: projectile.id,
      position: message.position,
      direction: message.direction,
      weaponType: message.weaponType || "default",
      timestamp: Date.now(),
    })
  }

  private handlePlayerJump(client: Client, message: any) {
    const player = this.state.players.get(client.sessionId) as BattlePlayer
    if (!player || !this.gameStarted) return

    // Broadcast jump to all players
    this.broadcast(
      "player_jumped",
      {
        playerId: client.sessionId,
        position: message.position,
        velocity: message.velocity,
        timestamp: Date.now(),
      },
      { except: client },
    )
  }

  private getPlayersArray() {
    const players: any[] = []
    this.state.players.forEach((player, id) => {
      players.push({
        id: id,
        name: player.name,
        characterType: player.characterType,
        score: player.score,
        kills: player.kills,
        deaths: player.deaths,
        isAlive: player.isAlive,
        ready: player.ready,
        team: player.team,
      })
    })
    return players
  }

  private broadcastBattleStats() {
    const playerCount = this.state.players.size
    const readyCount = this.state.getReadyPlayerCount()

    this.broadcast("battle_room_stats_update", {
      totalPlayers: playerCount,
      readyPlayers: readyCount,
      gameStarted: this.gameStarted,
      gameMode: this.state.gameMode,
      timestamp: Date.now(),
    })

    // Also send player count update for compatibility
    this.broadcast("player_count_update", {
      count: playerCount,
      maxPlayers: this.maxClients,
      timestamp: Date.now(),
    })

    console.log(`📊 BattleRoom: Broadcasting stats - ${playerCount} players (${readyCount} ready), game started: ${this.gameStarted}`)
  }

  private handlePlayerLeave(sessionId: string) {
    const player = this.state.players.get(sessionId)
    if (player) {
      console.log(`👋 BattleRoom: Player ${player.name} leaving the battle`)
      
      // Remove player from battle state
      this.state.removePlayer(sessionId)

      // Broadcast player left
      this.broadcast("player_left_battle", {
        playerId: sessionId,
        playerName: player.name,
        timestamp: Date.now(),
      })

      // Check if game should end
      const remainingPlayers = this.state.players.size
      if (this.gameStarted && remainingPlayers < this.state.minPlayersToStart) {
        this.endGame("Not enough players")
      }
    }
  }

  private scheduleGameStart() {
    if (this.gameStartTimer) {
      clearTimeout(this.gameStartTimer)
    }

    console.log(`⏰ BattleRoom: Scheduling game start in 5 seconds...`)
    this.broadcast("game_starting_soon", {
      message: "Battle starting in 5 seconds!",
      countdown: 5,
      timestamp: Date.now(),
    })

    this.gameStartTimer = setTimeout(() => {
      this.startGame()
    }, 5000)
  }

  private startGame() {
    if (this.gameStarted) return

    this.gameStarted = true
    this.state.startGame()

    // Update metadata
    this.setMetadata({
      ...this.metadata,
      gameStarted: true,
    })

    console.log(`🎮 BattleRoom: Game started with ${this.state.players.size} players!`)

    // Broadcast game start to all players
    this.broadcast("game_started", {
      message: "Battle has begun!",
      gameMode: this.state.gameMode,
      playerCount: this.state.players.size,
      timestamp: Date.now(),
    })

    // Send game state to all players
    this.broadcast("game_state_update", {
      gameActive: this.state.gameActive,
      players: this.getPlayersArray(),
      timestamp: Date.now(),
    })
  }

  private endGame(reason: string) {
    if (!this.gameStarted) return

    this.gameStarted = false
    this.state.endGame()

    console.log(`🏁 BattleRoom: Game ended - ${reason}`)

    // Update metadata
    this.setMetadata({
      ...this.metadata,
      gameStarted: false,
    })

    // Broadcast game end
    this.broadcast("game_ended", {
      reason: reason,
      winner: this.state.winner,
      finalScores: this.getPlayersArray(),
      leaderboard: this.state.getLeaderboard(),
      timestamp: Date.now(),
    })

    // Clear game start timer if it exists
    if (this.gameStartTimer) {
      clearTimeout(this.gameStartTimer)
      this.gameStartTimer = null
    }

    // Reset game after a delay
    setTimeout(() => {
      this.resetGame()
    }, 10000) // 10 seconds
  }

  private resetGame() {
    console.log(`🔄 BattleRoom: Resetting game for new match`)
    this.state.resetGame()
    
    this.broadcast("game_reset", {
      message: "Game reset - ready up for next match!",
      timestamp: Date.now(),
    })
  }

  async onAuth(client: Client, options: any) {
    console.log(`🔐 BattleRoom: Authentication request from ${client.sessionId}`, options)

    try {
      if (!options || typeof options !== "object") {
        throw new Error("Invalid authentication options")
      }

      let username = options.username
      if (!username || typeof username !== "string" || username.trim() === "") {
        username = `Warrior_${client.sessionId.substring(0, 6)}`
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
        fromLobby: options.fromLobby || false,
      }
    } catch (error: any) {
      console.error(`❌ BattleRoom: Authentication failed for ${client.sessionId}:`, error.message)
      throw error
    }
  }

  onJoin(client: Client, options: any) {
    console.log(`🚪 BattleRoom: Player ${client.sessionId} (${options.username}) joined the battle`)

    try {
      const username = options.username || `Warrior_${client.sessionId.substring(0, 6)}`

      // Add player to battle state
      const player = this.state.addPlayer(
        client.sessionId,
        username,
        options.characterType || "default"
      )

      console.log(`✅ BattleRoom: Player ${username} added to battle state`)

      const playerCount = this.state.players.size

      // Send welcome message to new player
      client.send("battle_room_joined", {
        message: `Welcome to the battle, ${username}!`,
        playerId: client.sessionId,
        playerName: username,
        playerCount: playerCount,
        gameMode: this.state.gameMode,
        gameStarted: this.gameStarted,
        timestamp: Date.now(),
      })

      // Send current battle state to new player
      client.send("battle_state_update", {
        players: this.getPlayersArray(),
        gameStarted: this.gameStarted,
        gameMode: this.state.gameMode,
        playerCount: playerCount,
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
        { except: client }
      )

      // Broadcast updated stats to all players
      this.broadcastBattleStats()

      console.log(`📊 BattleRoom: Now has ${playerCount} players`)

      // Check if we can start the game
      this.checkGameStart()
    } catch (error: any) {
      console.error(`❌ BattleRoom: Error in onJoin for ${client.sessionId}:`, error)
      client.send("error", { message: "Failed to join battle room" })
    }
  }

  onLeave(client: Client, consented: boolean) {
    console.log(`👋 BattleRoom: Player ${client.sessionId} left the battle (consented: ${consented})`)

    try {
      this.handlePlayerLeave(client.sessionId)
      this.broadcastBattleStats()

      const remainingPlayers = this.state.players.size
      console.log(`📊 BattleRoom: Now has ${remainingPlayers} players`)
    } catch (error: any) {
      console.error(`❌ BattleRoom: Error in onLeave for ${client.sessionId}:`, error)
    }
  }

  onDispose() {
    console.log("⚔️ BattleRoom: Room disposed")
    if (this.gameStartTimer) {
      clearTimeout(this.gameStartTimer)
    }
    if (this.readyCheckInterval) {
      clearInterval(this.readyCheckInterval)
    }
    if (this.gameLoopInterval) {
      clearInterval(this.gameLoopInterval)
    }
  }

  onError(client: Client, error: any) {
    console.error(`❌ BattleRoom: Client ${client.sessionId} error:`, error)
  }
}
