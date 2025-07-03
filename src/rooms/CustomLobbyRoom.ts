import { Room, type Client, matchMaker } from "@colyseus/core"
import { LobbyState } from "../schemas/LobbyState"

export class CustomLobbyRoom extends Room<LobbyState> {
  maxClients = 50
  private gameSession: any = null
  private gameStartTimer: any = null
  private readyCheckInterval: any = null

  onCreate(options: any) {
    console.log("🏛️ CustomLobbyRoom created!", options)

    // Set metadata for room discovery
    this.setMetadata({
      name: options.roomName || `Lobby_${Date.now().toString().substring(8)}`,
      gameType: "lobby",
      isPublic: true,
      createdAt: Date.now(),
      maxPlayers: this.maxClients,
    })

    // Initialize the room state
    this.setState(new LobbyState())

    // Handle player ready status
    this.onMessage("set_ready", (client: Client, message: any) => {
      console.log(`🎯 Player ${client.sessionId} set ready status:`, message.ready)

      const player = this.state.players.get(client.sessionId)
      if (player) {
        player.setReady(message.ready)

        // Broadcast ready status change
        this.broadcast("player_ready_changed", {
          playerId: client.sessionId,
          playerName: player.name,
          ready: player.ready,
          timestamp: Date.now(),
        })

        // Check if we can start a game
        this.checkAndStartGameSession()

        console.log(`✅ Player ${player.name} ready status: ${player.ready}`)
      }
    })

    // Handle game type selection
    this.onMessage("select_game_type", (client: Client, message: any) => {
      console.log(`🎮 Player ${client.sessionId} selected game type:`, message.gameType)

      const player = this.state.players.get(client.sessionId)
      if (player) {
        player.selectGameType(message.gameType)

        // Broadcast game type selection
        this.broadcast("player_game_type_changed", {
          playerId: client.sessionId,
          playerName: player.name,
          gameType: player.selectedGameType,
          timestamp: Date.now(),
        })

        console.log(`🎯 Player ${player.name} selected: ${player.selectedGameType}`)
      }
    })

    // Handle create game session
    this.onMessage("create_game_session", (client: Client, message: any) => {
      console.log(`🚀 Player ${client.sessionId} wants to create game session:`, message)

      const { gameType, sessionName, maxPlayers } = message
      this.joinOrCreateGameSession(client, gameType, sessionName, maxPlayers)
    })

    // Handle join game session
    this.onMessage("join_game_session", (client: Client, message: any) => {
      console.log(`🎯 Player ${client.sessionId} wants to join game session:`, message.sessionId)

      const player = this.state.players.get(client.sessionId)
      if (player) {
        // Navigate to the specific game session
        client.send("navigate_to_game_session", {
          sessionId: message.sessionId,
          gameType: message.gameType,
          timestamp: Date.now(),
        })
      }
    })

    // Handle getting lobby stats
    this.onMessage("get_lobby_stats", (client: Client) => {
      const readyCount = this.getReadyPlayerCount()
      const totalPlayers = this.state.players.size

      client.send("lobby_stats", {
        totalPlayers: totalPlayers,
        readyPlayers: readyCount,
        canStartGame: readyCount >= 2,
        timestamp: Date.now(),
      })
    })

    // Handle test messages
    this.onMessage("test", (client: Client, message: any) => {
      console.log(`🧪 CustomLobbyRoom: Test message from ${client.sessionId}:`, message)

      const player = this.state.players.get(client.sessionId)
      client.send("test_response", {
        message: "Lobby test successful",
        playerId: client.sessionId,
        playerName: player?.name || "Unknown",
        isReady: player?.ready || false,
        selectedGameType: player?.selectedGameType || "none",
        totalPlayers: this.state.players.size,
        readyPlayers: this.getReadyPlayerCount(),
        timestamp: Date.now(),
      })
    })

    // Handle test message with enhanced response
    this.onMessage("test_message", (client: Client, message: any) => {
      console.log(`🧪 Lobby: Test message from ${client.sessionId}:`, message)

      const player = this.state.players.get(client.sessionId)
      const readyCount = this.getReadyPlayerCount()

      client.send("test_response", {
        message: "Lobby received your message!",
        timestamp: Date.now(),
        clientId: client.sessionId,
        roomId: this.roomId,
        playerFound: !!player,
        playerName: player?.name || "Unknown",
        isReady: player?.ready || false,
        selectedGameType: player?.selectedGameType || "none",
        totalPlayers: this.state.players.size,
        readyPlayers: readyCount,
        canStartGame: readyCount >= 2,
        connectedClients: this.clients.length,
      })

      // Also broadcast current stats
      this.broadcastLobbyStats()
    })

    // Handle ping/heartbeat messages
    this.onMessage("ping", (client: Client, message: any) => {
      client.send("pong", { timestamp: Date.now() })
    })

    // Set up periodic ready check
    this.readyCheckInterval = this.setSimulationInterval(() => {
      this.checkAndStartGameSession()
    }, 5000) // Check every 5 seconds

    // Periodic stats broadcast
    this.setSimulationInterval(() => {
      this.broadcastLobbyStats()
    }, 3000) // Every 3 seconds

    console.log("🌟 Custom lobby room fully initialized and ready for players!")
  }

  async onAuth(client: Client, options: any) {
    console.log(`🔐 CustomLobbyRoom: Authentication request from ${client.sessionId}`, options)

    try {
      if (!options) {
        options = {}
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

      // Add player to lobby state
      const player = this.state.addPlayer(client.sessionId, username)

      console.log(`✅ CustomLobbyRoom: Player ${username} added to lobby state`)

      const playerCount = this.state.players.size

      // Send welcome message to new player
      client.send("lobby_joined", {
        message: `Welcome to the lobby, ${username}!`,
        playerId: client.sessionId,
        playerName: username,
        playerCount: playerCount,
        timestamp: Date.now(),
      })

      // Send current lobby state to new player
      client.send("lobby_state_update", {
        players: this.getPlayersArray(),
        readyPlayers: this.getReadyPlayerCount(),
        totalPlayers: playerCount,
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

      // Broadcast updated stats to all players
      this.broadcastLobbyStats()

      console.log(`📊 CustomLobbyRoom: Now has ${playerCount} players`)
    } catch (error: any) {
      console.error(`❌ CustomLobbyRoom: Error in onJoin for ${client.sessionId}:`, error)
      client.send("error", { message: "Failed to join lobby" })
    }
  }

  onLeave(client: Client, consented: boolean) {
    console.log(`👋 CustomLobbyRoom: Player ${client.sessionId} left the lobby (consented: ${consented})`)

    try {
      // Remove player from lobby state
      const removed = this.state.removePlayer(client.sessionId)

      if (removed) {
        console.log(`✅ CustomLobbyRoom: Player ${client.sessionId} removed from lobby state`)

        // Broadcast player left
        this.broadcast("player_left_lobby", {
          playerId: client.sessionId,
          timestamp: Date.now(),
        })
      }

      // Broadcast updated stats
      this.broadcastLobbyStats()

      const remainingPlayers = this.state.players.size
      console.log(`📊 CustomLobbyRoom: Now has ${remainingPlayers} players`)
    } catch (error: any) {
      console.error(`❌ CustomLobbyRoom: Error in onLeave for ${client.sessionId}:`, error)
    }
  }

  onDispose() {
    console.log("🏛️ CustomLobbyRoom: Room disposed")
    if (this.gameStartTimer) {
      clearTimeout(this.gameStartTimer)
    }
    if (this.readyCheckInterval) {
      clearInterval(this.readyCheckInterval)
    }
  }

  private broadcastLobbyStats() {
    const readyCount = this.getReadyPlayerCount()
    const totalPlayers = this.state.players.size

    this.broadcast("lobby_stats_update", {
      totalPlayers: totalPlayers,
      readyPlayers: readyCount,
      canStartGame: readyCount >= 2,
      timestamp: Date.now(),
    })

    // Also send player count update for compatibility
    this.broadcast("player_count_update", {
      count: totalPlayers,
      maxPlayers: this.maxClients,
      timestamp: Date.now(),
    })

    console.log(`📊 CustomLobbyRoom: Broadcasting stats - ${totalPlayers} players, ${readyCount} ready`)
  }

  private getReadyPlayerCount(): number {
    let readyCount = 0
    this.state.players.forEach((player) => {
      if (player.ready) {
        readyCount++
      }
    })
    return readyCount
  }

  private getPlayersArray() {
    const players: any[] = []
    this.state.players.forEach((player, id) => {
      players.push({
        id: id,
        name: player.name,
        ready: player.ready,
        selectedGameType: player.selectedGameType,
        joinedAt: player.joinedAt,
        status: player.status,
      })
    })
    return players
  }

  private async checkAndStartGameSession() {
    const readyCount = this.getReadyPlayerCount()
    const totalPlayers = this.state.players.size

    // Need at least 2 ready players to start a game
    if (readyCount >= 2 && totalPlayers >= 2) {
      console.log(`🎮 CustomLobbyRoom: ${readyCount} players ready, checking for game start...`)

      // Get the most common game type selection
      const gameTypeVotes = new Map<string, number>()
      this.state.players.forEach((player) => {
        if (player.ready && player.selectedGameType) {
          const current = gameTypeVotes.get(player.selectedGameType) || 0
          gameTypeVotes.set(player.selectedGameType, current + 1)
        }
      })

      if (gameTypeVotes.size > 0) {
        // Find the game type with the most votes
        let selectedGameType = "battle" // default
        let maxVotes = 0

        gameTypeVotes.forEach((votes, gameType) => {
          if (votes > maxVotes) {
            maxVotes = votes
            selectedGameType = gameType
          }
        })

        console.log(`🎯 CustomLobbyRoom: Starting ${selectedGameType} game with ${readyCount} players`)

        // Start the game session
        this.startGameSession(selectedGameType)
      }
    }
  }

  private async startGameSession(gameType: string) {
    try {
      console.log(`🚀 CustomLobbyRoom: Starting ${gameType} game session...`)

      // Get ready players
      const readyPlayers: any[] = []
      this.state.players.forEach((player) => {
        if (player.ready) {
          readyPlayers.push({
            sessionId: player.sessionId,
            name: player.name,
            username: player.username,
          })
        }
      })

      // Create the game room
      const gameRoomName = this.getGameRoomName(gameType)
      const gameRoom = await matchMaker.createRoom(gameRoomName, {
        roomName: `${gameType}_${Date.now().toString().substring(8)}`,
        gameMode: "multiplayer",
        maxPlayers: readyPlayers.length,
        fromLobby: true,
        lobbyId: this.roomId,
      })

      console.log(`✅ CustomLobbyRoom: Created ${gameType} room ${gameRoom.roomId}`)

      // Notify all ready players to join the game room
      this.state.players.forEach((player) => {
        if (player.ready) {
          const client = this.clients.find((c) => c.sessionId === player.sessionId)
          if (client) {
            client.send("game_session_created", {
              gameType: gameType,
              roomId: gameRoom.roomId,
              message: `${gameType} game starting! Joining room...`,
              timestamp: Date.now(),
            })

            // Reset player ready status
            player.setReady(false)
          }
        }
      })

      // Broadcast to all players that a game session started
      this.broadcast("game_session_started", {
        gameType: gameType,
        roomId: gameRoom.roomId,
        playerCount: readyPlayers.length,
        timestamp: Date.now(),
      })

      console.log(`🎮 CustomLobbyRoom: Game session started with ${readyPlayers.length} players`)
    } catch (error: any) {
      console.error(`❌ CustomLobbyRoom: Error starting game session:`, error)

      // Notify players of the error
      this.broadcast("game_session_error", {
        message: "Failed to start game session",
        error: error.message,
        timestamp: Date.now(),
      })
    }
  }

  private getGameRoomName(gameType: string): string {
    switch (gameType.toLowerCase()) {
      case "battle":
        return "battle"
      case "race":
        return "race"
      case "platformer":
        return "platformer"
      default:
        return "battle" // Default to battle
    }
  }

  private async joinOrCreateGameSession(client: Client, gameType: string, sessionName?: string, maxPlayers?: number) {
    try {
      const player = this.state.players.get(client.sessionId)
      if (!player) {
        client.send("error", { message: "Player not found in lobby" })
        return
      }

      console.log(`🎯 CustomLobbyRoom: Creating ${gameType} session for ${player.name}`)

      const gameRoomName = this.getGameRoomName(gameType)
      const gameRoom = await matchMaker.createRoom(gameRoomName, {
        roomName: sessionName || `${gameType}_${Date.now().toString().substring(8)}`,
        gameMode: "multiplayer",
        maxPlayers: maxPlayers || 16,
        fromLobby: true,
        lobbyId: this.roomId,
        createdBy: player.name,
      })

      console.log(`✅ CustomLobbyRoom: Created ${gameType} room ${gameRoom.roomId} for ${player.name}`)

      // Send room details to the requesting player
      client.send("game_session_created", {
        gameType: gameType,
        roomId: gameRoom.roomId,
        sessionName: sessionName,
        message: `${gameType} session created! You can now join.`,
        timestamp: Date.now(),
      })

      // Optionally broadcast to other players that a new session is available
      this.broadcast(
        "new_game_session_available",
        {
          gameType: gameType,
          roomId: gameRoom.roomId,
          sessionName: sessionName,
          createdBy: player.name,
          timestamp: Date.now(),
        },
        { except: client },
      )
    } catch (error: any) {
      console.error(`❌ CustomLobbyRoom: Error creating game session:`, error)
      client.send("game_session_error", {
        message: "Failed to create game session",
        error: error.message,
        timestamp: Date.now(),
      })
    }
  }

  onError(client: Client, error: any) {
    console.error(`❌ CustomLobbyRoom: Client ${client.sessionId} error:`, error)
  }
}
