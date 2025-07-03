import { Room, type Client } from "@colyseus/core"
import { BattleState } from "../schemas/BattleState"
import { AbilityManager } from "../managers/AbilityManager"
import { CollisionManager } from "../managers/CollisionManager"

export class BattleRoom extends Room<BattleState> {
  maxClients = 16
  private gameStarted = false
  private gameStartTimer: any = null
  private abilityManager: AbilityManager = new AbilityManager()
  private collisionManager: CollisionManager = new CollisionManager()

  onCreate(options: any) {
    console.log("⚔️ BattleRoom created with Three.js support!", options)

    // Set metadata for room discovery
    this.setMetadata({
      name: options.roomName || `Battle_${Date.now().toString().substring(8)}`,
      gameType: "battle",
      gameMode: options.gameMode || "deathmatch",
      mapTheme: options.mapTheme || "default",
      isPublic: true,
      createdAt: Date.now(),
      gameStarted: this.gameStarted,
      fromLobby: options.fromLobby || false,
    })

    // Initialize battle state
    this.setState(new BattleState())
    this.state.gameMode = options.gameMode || "deathmatch"
    this.state.mapTheme = options.mapTheme || "default"
    this.state.gameStarted = false

    // Handle test message for debugging
    this.onMessage("test_message", (client: Client, message: any) => {
      console.log(`🧪 BattleRoom: Test message from ${client.sessionId}:`, message)

      const player = this.state.players.get(client.sessionId)
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
        mapTheme: this.state.mapTheme,
        connectedClients: this.clients.length, // Added connectedClients
      })

      // Also broadcast current stats
      this.broadcastBattleStats()
    })

    // Handle ping/heartbeat messages
    this.onMessage("ping", (client: Client, message: any) => {
      client.send("pong", { timestamp: Date.now() })
    })

    // Handle player movement (for Three.js)
    this.onMessage("player_move", (client: Client, message: any) => {
      const player = this.state.players.get(client.sessionId)
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
      const player = this.state.players.get(client.sessionId)
      const abilityType = message.abilityType // Moved this line to the top level
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
            this.handlePlayerAbility(client, abilityType) // Updated to use abilityType
            break
        }
      }
    })

    console.log(`⚔️ BattleRoom ${this.roomId} ready for Three.js multiplayer combat!`)
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
      // Explicitly type error as any
      console.error(`❌ BattleRoom: Authentication failed for ${client.sessionId}:`, error.message)
      throw error
    }
  }

  onJoin(client: Client, options: any) {
    console.log(`🚪 BattleRoom: Player ${client.sessionId} (${options.username}) joined the battle`)

    try {
      const username = options.username || `Warrior_${client.sessionId.substring(0, 6)}`

      // Add player to battle state using the method on BattleState
      const player = this.state.addPlayer(
        client.sessionId,
        username,
        options.characterType || "default",
        options.fromLobby || false,
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
        mapTheme: this.state.mapTheme,
        gameStarted: this.gameStarted,
        timestamp: Date.now(),
      })

      // Send current battle state to new player
      client.send("battle_state_update", {
        players: this.getPlayersArray(),
        gameStarted: this.gameStarted,
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

      // Broadcast updated stats to all players
      this.broadcastBattleStats()

      console.log(`📊 BattleRoom: Now has ${playerCount} players`)

      // Auto-start game if we have enough players and came from lobby
      if (options.fromLobby && playerCount >= 2 && !this.gameStarted) {
        this.scheduleGameStart()
      }
    } catch (error: any) {
      // Explicitly type error as any
      console.error(`❌ BattleRoom: Error in onJoin for ${client.sessionId}:`, error)
      client.send("error", { message: "Failed to join battle room" })
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
    this.state.gameStarted = true

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
      mapTheme: this.state.mapTheme,
      playerCount: this.state.players.size,
      timestamp: Date.now(),
    })

    // Initialize Three.js scene data for all players
    this.broadcast("initialize_scene", {
      mapTheme: this.state.mapTheme,
      players: this.getPlayersArray(),
      timestamp: Date.now(),
    })
  }

  private handlePlayerShoot(client: Client, message: any) {
    const player = this.state.players.get(client.sessionId)
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
    const player = this.state.players.get(client.sessionId)
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

  private handlePlayerAbility(client: Client, abilityType: any) {
    // Updated parameter type to any
    const player = this.state.players.get(client.sessionId)
    // Use the method on BattleState
    const success = player && this.gameStarted ? this.state.usePlayerAbility(client.sessionId, abilityType) : false

    if (success) {
      // Broadcast ability use to all players
      this.broadcast("player_used_ability", {
        playerId: client.sessionId,
        abilityType: abilityType,
        position: player.position, // Added position for context
        timestamp: Date.now(),
      })
    } else {
      // Send failure message to player
      client.send("ability_failed", {
        abilityType: abilityType,
        reason: "Cooldown or insufficient resources",
        timestamp: Date.now(),
      })
    }
  }

  private getPlayersArray() {
    const players: any[] = []
    this.state.players.forEach((player, id) => {
      players.push({
        id: id,
        name: player.name,
        characterType: player.characterType,
        position: {
          x: player.position.x,
          y: player.position.y,
          z: player.position.z,
        },
        rotation: {
          x: player.rotation.x,
          y: player.rotation.y,
          z: player.rotation.z,
          w: player.rotation.w,
        },
        health: player.health,
        score: player.score, // Access score property
        isAlive: player.isAlive, // Access isAlive property
      })
    })
    return players
  }

  private broadcastBattleStats() {
    const playerCount = this.state.players.size

    this.broadcast("battle_room_stats_update", {
      totalPlayers: playerCount,
      gameStarted: this.gameStarted,
      gameMode: this.state.gameMode,
      mapTheme: this.state.mapTheme,
      timestamp: Date.now(),
    })

    // Also send player count update for compatibility
    this.broadcast("player_count_update", {
      count: playerCount,
      maxPlayers: this.maxClients,
      timestamp: Date.now(),
    })

    console.log(`📊 BattleRoom: Broadcasting stats - ${playerCount} players, game started: ${this.gameStarted}`)
  }

  onLeave(client: Client, consented: boolean) {
    console.log(`👋 BattleRoom: Player ${client.sessionId} left the battle (consented: ${consented})`)

    try {
      // Remove player from battle state using the method on BattleState
      const removed = this.state.removePlayer(client.sessionId)

      if (removed) {
        console.log(`✅ BattleRoom: Player ${client.sessionId} removed from battle state`)

        // Broadcast player left
        this.broadcast("player_left_battle", {
          playerId: client.sessionId,
          timestamp: Date.now(),
        })
      }

      // Broadcast updated stats
      this.broadcastBattleStats()

      const remainingPlayers = this.state.players.size
      console.log(`📊 BattleRoom: Now has ${remainingPlayers} players`)

      // End game if not enough players remain
      if (this.gameStarted && remainingPlayers < 2) {
        this.endGame("Not enough players")
      }
    } catch (error: any) {
      // Explicitly type error as any
      console.error(`❌ BattleRoom: Error in onLeave for ${client.sessionId}:`, error)
    }
  }

  private endGame(reason: string) {
    if (!this.gameStarted) return

    this.gameStarted = false
    this.state.gameStarted = false

    console.log(`🏁 BattleRoom: Game ended - ${reason}`)

    // Update metadata
    this.setMetadata({
      ...this.metadata,
      gameStarted: false,
    })

    // Broadcast game end
    this.broadcast("game_ended", {
      reason: reason,
      finalScores: this.getPlayersArray(),
      timestamp: Date.now(),
    })

    // Clear game start timer if it exists
    if (this.gameStartTimer) {
      clearTimeout(this.gameStartTimer)
      this.gameStartTimer = null
    }
  }

  onDispose() {
    console.log("⚔️ BattleRoom: Room disposed")
    if (this.gameStartTimer) {
      clearTimeout(this.gameStartTimer)
    }
  }

  onError(client: Client, error: any) {
    // Explicitly type error as any
    console.error(`❌ BattleRoom: Client ${client.sessionId} error:`, error)
  }
}
