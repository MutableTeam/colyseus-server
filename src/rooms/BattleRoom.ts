import { Room, type Client, updateLobby } from "@colyseus/core"
import { BattleState } from "../schemas/BattleState"
import { BattlePlayer } from "../schemas/BattlePlayer"

export class BattleRoom extends Room<BattleState> {
  maxClients = 16
  private gameTimer: any = null
  private gameStarted = false

  onCreate(options: any) {
    console.log("⚔️ BattleRoom created!", options)

    // Set metadata for room discovery with real-time listing
    this.setMetadata({
      name: options.roomName || `Battle_${Date.now().toString().substring(8)}`,
      roomName: options.roomName || `Battle_${Date.now().toString().substring(8)}`,
      gameType: "battle",
      gameMode: options.gameMode || "deathmatch",
      mapTheme: options.mapTheme || "default",
      maxPlayers: options.maxPlayers || 16,
      isPublic: options.isPublic !== false,
      hostName: options.hostName || options.username || "Unknown",
      createdAt: Date.now(),
      currentPlayers: 0,
      fromLobby: options.fromLobby || false,
      lobbyId: options.lobbyId || null,
    }).then(() => {
      // Update lobby after setting metadata
      updateLobby(this)
    })

    this.setState(new BattleState())
    this.state.gameMode = options.gameMode || "deathmatch"
    this.state.mapTheme = options.mapTheme || "default"
    this.state.maxPlayers = options.maxPlayers || 16

    // Set up message handlers
    this.setupMessageHandlers()

    console.log(`⚔️ BattleRoom ${this.roomId} ready for combat!`)
  }

  private setupMessageHandlers() {
    this.onMessage("player_action", (client: Client, message: any) => {
      const player = this.state.players.get(client.sessionId) as BattlePlayer
      if (player && message.action) {
        console.log(`⚔️ Player ${player.name} performed action: ${message.action}`)

        // Handle different battle actions
        switch (message.action) {
          case "attack":
            this.handleAttack(client, message)
            break
          case "move":
            this.handleMove(client, message)
            break
          case "use_ability":
            this.handleAbility(client, message)
            break
        }
      }
    })

    this.onMessage("ready", (client: Client, message: any) => {
      const player = this.state.players.get(client.sessionId) as BattlePlayer
      if (player) {
        player.ready = !player.ready
        console.log(`⚔️ Player ${player.name} is ${player.ready ? "ready" : "not ready"}`)

        this.broadcast("player_ready_changed", {
          playerId: client.sessionId,
          ready: player.ready,
          timestamp: Date.now(),
        })

        // Check if all players are ready to start
        if (this.areAllPlayersReady() && this.state.players.size >= 2) {
          this.startBattle()
        }
      }
    })

    // Handle test message for debugging
    this.onMessage("test_message", (client: Client, message: any) => {
      console.log(`🧪 BattleRoom: Test message from ${client.sessionId}:`, message)

      const player = this.state.players.get(client.sessionId)
      const totalPlayers = this.state.players.size

      client.send("test_response", {
        message: "Battle room test response",
        timestamp: Date.now(),
        clientId: client.sessionId,
        roomId: this.roomId,
        playerFound: !!player,
        playerName: player?.name || "Unknown",
        totalPlayers: totalPlayers,
        gameMode: this.state.gameMode,
        mapTheme: this.state.mapTheme,
        connectedClients: this.clients.length,
      })

      this.broadcastBattleStats()
    })

    this.onMessage("ping", (client: Client, message: any) => {
      client.send("pong", { timestamp: Date.now() })
    })
  }

  private handleAttack(client: Client, message: any) {
    const attacker = this.state.players.get(client.sessionId) as BattlePlayer
    if (!attacker || !this.gameStarted) return

    // Basic attack logic
    const damage = Math.floor(Math.random() * 20) + 10

    this.broadcast("player_attacked", {
      attackerId: client.sessionId,
      attackerName: attacker.name,
      damage: damage,
      timestamp: Date.now(),
    })

    console.log(`⚔️ ${attacker.name} attacked for ${damage} damage`)
  }

  private handleMove(client: Client, message: any) {
    const player = this.state.players.get(client.sessionId) as BattlePlayer
    if (!player) return

    if (message.x !== undefined) player.x = message.x
    if (message.y !== undefined) player.y = message.y

    this.broadcast(
      "player_moved",
      {
        playerId: client.sessionId,
        x: player.x,
        y: player.y,
        timestamp: Date.now(),
      },
      { except: client },
    )
  }

  private handleAbility(client: Client, message: any) {
    const player = this.state.players.get(client.sessionId) as BattlePlayer
    if (!player || !this.gameStarted) return

    console.log(`⚔️ ${player.name} used ability: ${message.ability}`)

    this.broadcast("player_used_ability", {
      playerId: client.sessionId,
      playerName: player.name,
      ability: message.ability,
      timestamp: Date.now(),
    })
  }

  private areAllPlayersReady(): boolean {
    let allReady = true
    this.state.players.forEach((player) => {
      if (!player.ready) {
        allReady = false
      }
    })
    return allReady
  }

  private startBattle() {
    if (this.gameStarted) return

    this.gameStarted = true
    console.log(`⚔️ Battle starting with ${this.state.players.size} players!`)

    this.broadcast("battle_started", {
      message: "Battle has begun!",
      playerCount: this.state.players.size,
      timestamp: Date.now(),
    })

    // Update metadata to reflect game started
    this.setMetadata({
      ...this.metadata,
      gameStarted: true,
      startedAt: Date.now(),
    }).then(() => {
      updateLobby(this)
    })

    // Set up game timer (example: 5 minute battles)
    this.gameTimer = setTimeout(
      () => {
        this.endBattle()
      },
      5 * 60 * 1000,
    )
  }

  private endBattle() {
    if (!this.gameStarted) return

    console.log(`⚔️ Battle ended in room ${this.roomId}`)

    this.broadcast("battle_ended", {
      message: "Battle has ended!",
      timestamp: Date.now(),
    })

    this.gameStarted = false

    // Reset all players
    this.state.players.forEach((player) => {
      player.ready = false
      player.health = 100
    })

    if (this.gameTimer) {
      clearTimeout(this.gameTimer)
      this.gameTimer = null
    }

    // Update metadata
    this.setMetadata({
      ...this.metadata,
      gameStarted: false,
      lastGameEndedAt: Date.now(),
    }).then(() => {
      updateLobby(this)
    })
  }

  private async updateMetadataAndLobby() {
    const playerCount = this.state.players.size

    // Update metadata
    await this.setMetadata({
      ...this.metadata,
      currentPlayers: playerCount,
      lastUpdate: Date.now(),
    })

    // Trigger lobby update for real-time listing
    try {
      await updateLobby(this)
      console.log(`🔄 Updated battle room metadata: ${playerCount} players`)
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

      // Create battle player
      const player = new BattlePlayer()
      player.sessionId = client.sessionId
      player.name = username
      player.characterType = options.characterType || "default"
      player.health = 100
      player.energy = 100
      player.level = 1
      player.x = Math.random() * 800
      player.y = Math.random() * 600
      player.ready = false

      this.state.players.set(client.sessionId, player)

      console.log(`✅ BattleRoom: Player ${username} added to battle state`)

      const playerCount = this.state.players.size

      // Update metadata and lobby listing
      await this.updateMetadataAndLobby()

      // Send welcome message to new player
      client.send("battle_room_joined", {
        message: `Welcome to the battle, ${username}!`,
        playerId: client.sessionId,
        playerName: username,
        playerCount: playerCount,
        gameMode: this.state.gameMode,
        mapTheme: this.state.mapTheme,
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

      // Broadcast updated battle stats to all players
      this.broadcastBattleStats()

      console.log(`📊 BattleRoom: Now has ${playerCount} players`)
    } catch (error: any) {
      console.error(`❌ BattleRoom: Error in onJoin for ${client.sessionId}:`, error)
      client.send("error", { message: "Failed to join battle room" })
    }
  }

  private broadcastBattleStats() {
    const playerCount = this.state.players.size

    this.broadcast("battle_room_stats_update", {
      totalPlayers: playerCount,
      maxPlayers: this.maxClients,
      gameMode: this.state.gameMode,
      mapTheme: this.state.mapTheme,
      timestamp: Date.now(),
    })

    this.broadcast("player_count_update", {
      count: playerCount,
      maxPlayers: this.maxClients,
      timestamp: Date.now(),
    })

    console.log(`📊 BattleRoom: Broadcasting stats - ${playerCount} players`)
  }

  async onLeave(client: Client, consented: boolean) {
    console.log(`👋 BattleRoom: Player ${client.sessionId} left the battle (consented: ${consented})`)

    try {
      const removed = this.state.players.delete(client.sessionId)

      if (removed) {
        console.log(`✅ BattleRoom: Player ${client.sessionId} removed from battle state`)

        // Update metadata and lobby listing
        await this.updateMetadataAndLobby()

        this.broadcast("player_left_battle", {
          playerId: client.sessionId,
          timestamp: Date.now(),
        })
      }

      // Broadcast updated stats
      this.broadcastBattleStats()

      const remainingPlayers = this.state.players.size
      console.log(`📊 BattleRoom: Now has ${remainingPlayers} players`)

      // Close battle room if empty
      if (remainingPlayers === 0) {
        console.log(`⚔️ BattleRoom: Battle room is empty, scheduling cleanup...`)
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
  }

  onError(client: Client, error: any) {
    console.error(`❌ BattleRoom: Client ${client.sessionId} error:`, error)
  }
}
