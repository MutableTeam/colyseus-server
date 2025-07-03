import { Room, type Client } from "@colyseus/core"
import { LobbyState } from "../schemas/LobbyState"
import type { Player } from "../schemas/Player"

export class CustomLobbyRoom extends Room<LobbyState> {
  maxClients = 8
  private countdownTimer: any = null
  private gameStartTimer: any = null
  private gameSession: any = null

  onCreate(options: any) {
    console.log("🏛️ CustomLobbyRoom created!", options)

    // Set metadata for room discovery
    this.setMetadata({
      name: options.lobbyName || `Lobby_${Date.now().toString().substring(8)}`,
      gameType: options.gameType || "battle",
      gameMode: options.gameMode || "deathmatch",
      mapTheme: options.mapTheme || "default",
      maxPlayers: options.maxPlayers || 8,
      isPublic: options.isPublic !== false,
      createdAt: Date.now(),
    })

    // Initialize lobby state
    this.setState(new LobbyState())
    this.state.lobbyName = options.lobbyName || `Lobby_${Date.now().toString().substring(8)}`
    this.state.gameType = options.gameType || "battle"
    this.state.gameMode = options.gameMode || "deathmatch"
    this.state.mapTheme = options.mapTheme || "default"
    this.state.maxPlayers = options.maxPlayers || 8
    this.state.isPublic = options.isPublic !== false

    // Set up message handlers
    this.setupMessageHandlers()

    console.log(`🏛️ CustomLobbyRoom ${this.roomId} ready for players!`)
  }

  private setupMessageHandlers() {
    // Handle player ready toggle
    this.onMessage("toggle_ready", (client: Client, message: any) => {
      const player = this.state.players.get(client.sessionId) as Player
      if (player) {
        const newReadyState = !player.ready
        player.setReady(newReadyState)

        console.log(`🎯 Player ${player.name} is now ${newReadyState ? "ready" : "not ready"}`)

        this.broadcast("player_ready_changed", {
          playerId: client.sessionId,
          playerName: player.name,
          ready: player.ready,
          timestamp: Date.now(),
        })

        // Check if all players are ready
        if (this.state.areAllPlayersReady() && this.state.getPlayerCount() >= 2) {
          this.startCountdown()
        } else {
          this.cancelCountdown()
        }
      }
    })

    // Handle game type selection
    this.onMessage("select_game_type", (client: Client, message: any) => {
      const player = this.state.players.get(client.sessionId) as Player
      if (player && message.gameType) {
        player.selectGameType(message.gameType)
        this.state.setGameType(message.gameType)

        console.log(`🎮 Game type changed to: ${message.gameType}`)

        this.broadcast("game_type_changed", {
          gameType: message.gameType,
          changedBy: player.name,
          timestamp: Date.now(),
        })
      }
    })

    // Handle game mode selection
    this.onMessage("select_game_mode", (client: Client, message: any) => {
      if (message.gameMode) {
        this.state.setGameMode(message.gameMode)

        console.log(`⚔️ Game mode changed to: ${message.gameMode}`)

        this.broadcast("game_mode_changed", {
          gameMode: message.gameMode,
          timestamp: Date.now(),
        })
      }
    })

    // Handle map theme selection
    this.onMessage("select_map_theme", (client: Client, message: any) => {
      if (message.mapTheme) {
        this.state.setMapTheme(message.mapTheme)

        console.log(`🗺️ Map theme changed to: ${message.mapTheme}`)

        this.broadcast("map_theme_changed", {
          mapTheme: message.mapTheme,
          timestamp: Date.now(),
        })
      }
    })

    // Handle force start game
    this.onMessage("force_start_game", (client: Client, message: any) => {
      const player = this.state.players.get(client.sessionId) as Player
      if (player && client.sessionId === this.state.hostId) {
        console.log(`🚀 Host ${player.name} force starting the game`)
        this.startGame()
      }
    })

    // Handle ping/heartbeat messages
    this.onMessage("ping", (client: Client, message: any) => {
      client.send("pong", { timestamp: Date.now() })
    })

    // Handle test message for debugging
    this.onMessage("test_message", (client: Client, message: any) => {
      console.log(`🧪 CustomLobbyRoom: Test message from ${client.sessionId}:`, message)

      const player = this.state.players.get(client.sessionId) as Player
      const playerCount = this.state.getPlayerCount()
      const readyCount = this.state.getReadyPlayers().length

      client.send("test_response", {
        message: "Lobby test response",
        timestamp: Date.now(),
        clientId: client.sessionId,
        roomId: this.roomId,
        playerFound: !!player,
        playerName: player?.name || "Unknown",
        totalPlayers: playerCount,
        readyPlayers: readyCount,
        canStartGame: this.state.canStartGame(),
        gameType: this.state.gameType,
        gameMode: this.state.gameMode,
        mapTheme: this.state.mapTheme,
        isHost: client.sessionId === this.state.hostId,
        connectedClients: this.clients.length,
      })

      // Also broadcast current lobby stats to all players
      this.broadcastLobbyStats()
    })
  }

  async onAuth(client: Client, options: any) {
    console.log(`🔐 CustomLobbyRoom: Authentication request from ${client.sessionId}`, options)

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
        throw new Error("Lobby is full")
      }

      console.log(`✅ CustomLobbyRoom: Authentication successful for ${client.sessionId} (${username})`)
      return {
        username: username,
        authenticated: true,
        joinTime: Date.now(),
        characterType: options.characterType || "default",
      }
    } catch (error: any) {
      console.error(`❌ CustomLobbyRoom: Authentication failed for ${client.sessionId}:`, error.message)
      throw error
    }
  }

  onJoin(client: Client, options: any) {
    console.log(`🚪 CustomLobbyRoom: Player ${client.sessionId} (${options.username}) joined the lobby`)

    try {
      const username = options.username || `Player_${client.sessionId.substring(0, 6)}`

      // Set host if this is the first player
      if (this.state.getPlayerCount() === 0) {
        this.state.hostId = client.sessionId
        console.log(`👑 ${username} is now the host`)
      }

      // Add player to lobby state
      const player = this.state.addPlayer(client.sessionId, username, options.characterType || "default")

      console.log(`✅ CustomLobbyRoom: Player ${username} added to lobby state`)

      const playerCount = this.state.getPlayerCount()

      // Send welcome message to new player
      client.send("lobby_joined", {
        message: `Welcome to the lobby, ${username}!`,
        playerId: client.sessionId,
        playerName: username,
        playerCount: playerCount,
        isHost: client.sessionId === this.state.hostId,
        gameType: this.state.gameType,
        gameMode: this.state.gameMode,
        mapTheme: this.state.mapTheme,
        timestamp: Date.now(),
      })

      // Send current lobby state to new player
      client.send("lobby_state_update", {
        players: this.getPlayersArray(),
        gameType: this.state.gameType,
        gameMode: this.state.gameMode,
        mapTheme: this.state.mapTheme,
        hostId: this.state.hostId,
        canStartGame: this.state.canStartGame(),
        timestamp: Date.now(),
      })

      // Broadcast player joined to all other players
      this.broadcast(
        "player_joined_lobby",
        {
          playerId: client.sessionId,
          playerName: username,
          playerCount: playerCount,
          timestamp: Date.now(),
        },
        { except: client },
      )

      // Broadcast updated lobby stats to all players
      this.broadcastLobbyStats()

      console.log(`📊 CustomLobbyRoom: Now has ${playerCount} players`)
    } catch (error: any) {
      console.error(`❌ CustomLobbyRoom: Error in onJoin for ${client.sessionId}:`, error)
      client.send("error", { message: "Failed to join lobby" })
    }
  }

  private startCountdown() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer)
    }

    console.log(`⏰ CustomLobbyRoom: Starting countdown...`)
    this.state.startCountdown(5)

    this.broadcast("game_countdown_started", {
      message: "All players ready! Game starting soon...",
      countdown: this.state.countdown,
      timestamp: Date.now(),
    })

    this.countdownTimer = setInterval(() => {
      const finished = this.state.updateCountdown()

      this.broadcast("game_countdown_update", {
        countdown: this.state.countdown,
        timestamp: Date.now(),
      })

      if (finished) {
        clearInterval(this.countdownTimer)
        this.countdownTimer = null
        this.startGame()
      }
    }, 1000)
  }

  private cancelCountdown() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer)
      this.countdownTimer = null
      this.state.resetCountdown()

      console.log(`❌ CustomLobbyRoom: Countdown cancelled`)

      this.broadcast("game_countdown_cancelled", {
        message: "Not all players are ready. Countdown cancelled.",
        timestamp: Date.now(),
      })
    }
  }

  private async startGame() {
    if (this.state.gameStarted) return

    console.log(`🎮 CustomLobbyRoom: Starting game with ${this.state.getPlayerCount()} players!`)

    this.state.startGame()

    // Prepare game options
    const gameOptions = {
      gameType: this.state.gameType,
      gameMode: this.state.gameMode,
      mapTheme: this.state.mapTheme,
      fromLobby: true,
      lobbyId: this.roomId,
      players: this.getPlayersArray(),
    }

    // Broadcast game start to all players
    this.broadcast("game_starting", {
      message: "Game is starting! Transitioning to game room...",
      gameOptions: gameOptions,
      timestamp: Date.now(),
    })

    try {
      // Create game room based on game type
      let gameRoomName = ""
      switch (this.state.gameType) {
        case "battle":
          gameRoomName = "BattleRoom"
          break
        case "platformer":
          gameRoomName = "PlatformerRoom"
          break
        case "race":
          gameRoomName = "RaceRoom"
          break
        default:
          gameRoomName = "BattleRoom"
      }

      // Create the game room
      const gameRoom = await this.presence.create(gameRoomName, {
        ...gameOptions,
        roomName: `${this.state.gameType}_${Date.now().toString().substring(8)}`,
      })

      console.log(`✅ CustomLobbyRoom: Created ${gameRoomName} with ID: ${gameRoom.roomId}`)

      // Send game room info to all players
      this.broadcast("game_room_created", {
        roomId: gameRoom.roomId,
        roomName: gameRoomName,
        gameOptions: gameOptions,
        message: `Join game room: ${gameRoom.roomId}`,
        timestamp: Date.now(),
      })

      // Schedule lobby cleanup after players have time to join the game room
      this.gameStartTimer = setTimeout(() => {
        console.log(`🧹 CustomLobbyRoom: Cleaning up lobby after game start`)
        this.disconnect()
      }, 30000) // 30 seconds
    } catch (error: any) {
      console.error(`❌ CustomLobbyRoom: Failed to create game room:`, error)

      this.broadcast("game_start_failed", {
        message: "Failed to create game room. Please try again.",
        error: error.message,
        timestamp: Date.now(),
      })

      // Reset game state
      this.state.resetGame()
    }
  }

  private getPlayersArray() {
    const players: any[] = []
    this.state.players.forEach((player, id) => {
      players.push({
        id: id,
        name: player.name,
        characterType: player.characterType,
        ready: player.ready,
        selectedGameType: player.selectedGameType,
        isHost: id === this.state.hostId,
      })
    })
    return players
  }

  private broadcastLobbyStats() {
    const stats = this.state.getLobbyStats()

    this.broadcast("lobby_stats_update", {
      ...stats,
      hostId: this.state.hostId,
      timestamp: Date.now(),
    })

    this.broadcast("player_count_update", {
      count: stats.totalPlayers,
      ready: stats.readyPlayers,
      maxPlayers: this.maxClients,
      timestamp: Date.now(),
    })

    console.log(`📊 CustomLobbyRoom: Broadcasting stats - ${stats.totalPlayers} players, ${stats.readyPlayers} ready`)
  }

  onLeave(client: Client, consented: boolean) {
    console.log(`👋 CustomLobbyRoom: Player ${client.sessionId} left the lobby (consented: ${consented})`)

    try {
      // Remove player from lobby state
      const removed = this.state.removePlayer(client.sessionId)

      if (removed) {
        console.log(`✅ CustomLobbyRoom: Player ${client.sessionId} removed from lobby state`)

        this.broadcast("player_left_lobby", {
          playerId: client.sessionId,
          timestamp: Date.now(),
        })
      }

      // Handle host leaving
      if (client.sessionId === this.state.hostId) {
        const remainingPlayers = this.state.getAllPlayers()
        if (remainingPlayers.length > 0) {
          // Transfer host to first remaining player
          this.state.hostId = remainingPlayers[0].sessionId
          console.log(`👑 Host transferred to ${remainingPlayers[0].name}`)

          this.broadcast("host_changed", {
            newHostId: this.state.hostId,
            newHostName: remainingPlayers[0].name,
            timestamp: Date.now(),
          })
        }
      }

      // Cancel countdown if not enough players or not all ready
      if (!this.state.canStartGame()) {
        this.cancelCountdown()
      }

      // Broadcast updated stats
      this.broadcastLobbyStats()

      const remainingPlayers = this.state.getPlayerCount()
      console.log(`📊 CustomLobbyRoom: Now has ${remainingPlayers} players`)

      // Close lobby if empty
      if (remainingPlayers === 0) {
        console.log(`🏛️ CustomLobbyRoom: Lobby is empty, scheduling cleanup...`)
        setTimeout(() => {
          this.disconnect()
        }, 5000)
      }
    } catch (error: any) {
      console.error(`❌ CustomLobbyRoom: Error in onLeave for ${client.sessionId}:`, error)
    }
  }

  onDispose() {
    console.log("🏛️ CustomLobbyRoom: Room disposed")
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer)
    }
    if (this.gameStartTimer) {
      clearTimeout(this.gameStartTimer)
    }
  }

  onError(client: Client, error: any) {
    console.error(`❌ CustomLobbyRoom: Client ${client.sessionId} error:`, error)
  }

  private joinOrCreateGameSession(client: Client, gameType: string) {
    console.log(`🎮 Player ${client.sessionId} joining/creating game session for ${gameType}`)

    if (!this.gameSession) {
      // Create new game session
      this.gameSession = {
        gameType: gameType,
        players: new Map(),
        createdAt: Date.now(),
      }
    }

    // Add player to game session
    this.gameSession.players.set(client.sessionId, {
      sessionId: client.sessionId,
      ready: false,
      joinedAt: Date.now(),
    })

    // Update player's selected game type in lobby state
    const player = this.state.players.get(client.sessionId) as Player
    if (player) {
      player.selectGameType(gameType)
    }

    // Notify client about joining game session
    client.send("game_session_joined", {
      gameType: gameType,
      sessionPlayers: this.gameSession.players.size,
    })

    this.broadcastLobbyStats()
  }

  private removePlayerFromGameSession(sessionId: string) {
    if (this.gameSession && this.gameSession.players.has(sessionId)) {
      this.gameSession.players.delete(sessionId)

      // If no players left in game session, remove it
      if (this.gameSession.players.size === 0) {
        this.gameSession = null
      }

      this.broadcastLobbyStats()
    }
  }

  private checkAndStartGameSession() {
    if (!this.gameSession) return

    const readyPlayers = Array.from(this.gameSession.players.values()).filter((p: any) => p.ready)

    if (readyPlayers.length >= 2) {
      console.log(`🚀 Starting game session with ${readyPlayers.length} ready players`)

      // Notify all ready players to join the actual game room
      readyPlayers.forEach((player: any) => {
        const client = this.clients.find((c) => c.sessionId === player.sessionId)
        if (client) {
          client.send("start_game", {
            gameType: this.gameSession.gameType,
            playerCount: readyPlayers.length,
          })
        }
      })

      // Clear the game session
      this.gameSession = null
      this.broadcastLobbyStats()
    }
  }
}
