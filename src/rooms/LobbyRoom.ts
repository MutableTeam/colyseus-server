import { Room, type Client } from "@colyseus/core"
import { LobbyState } from "../schemas/LobbyState"

export class LobbyRoom extends Room<LobbyState> {
  maxClients = 50
  private gameSession: any = null

  onCreate(options: any) {
    console.log("🏠 LobbyRoom created!", options)

    // Set metadata to help with room discovery
    this.setMetadata({
      name: options.lobbyName || `Lobby_${Date.now().toString().substring(8)}`,
      gameType: "lobby",
      isPublic: true,
      createdAt: Date.now(),
    })

    // Initialize the room state
    this.setState(new LobbyState())

    // Handle player joining a game
    this.onMessage("join_game", (client: Client, message: any) => {
      const { gameId, gameType } = message
      console.log(`Player ${client.sessionId} requesting to join game ${gameId} of type ${gameType}`)

      // Notify client about available games
      this.broadcast("available_games", this.state.availableGames)
    })

    // Handle player creating a game
    this.onMessage("create_game", (client: Client, message: any) => {
      const { gameType, gameName, maxPlayers } = message
      console.log(`Player ${client.sessionId} creating a game of type ${gameType}`)

      const gameId = `${gameType}_${Date.now()}`
      this.state.createGame(gameId, gameType, gameName, maxPlayers, client.sessionId)

      // Notify all clients about the new game
      this.broadcast("game_created", {
        gameId,
        gameType,
        gameName,
        maxPlayers,
        creatorId: client.sessionId,
      })
    })

    // Handle player leaving a game
    this.onMessage("leave_game", (client: Client, message: any) => {
      const { gameId } = message
      this.state.removePlayerFromGame(gameId, client.sessionId)

      // Notify all clients about the player leaving
      this.broadcast("player_left_game", {
        gameId,
        playerId: client.sessionId,
      })
    })

    // Handle request for active lobbies by game type
    this.onMessage("get_active_lobbies", (client: Client, message: any) => {
      console.log(`Player ${client.sessionId} requesting active lobbies with filter:`, message)

      const { gameType } = message

      let activeLobbies
      if (gameType) {
        // Get lobbies for specific game type from local state
        activeLobbies = this.state.getActiveLobbiesByGameType(gameType)
        console.log(`Found ${activeLobbies.length} active lobbies for game type: ${gameType}`)
      } else {
        // Get all active lobbies from local state
        activeLobbies = this.state.getAllActiveLobbies()
        console.log(`Found ${activeLobbies.length} total active lobbies`)
      }

      // Send the filtered lobbies to the requesting client
      client.send("active_lobbies", {
        lobbies: activeLobbies,
        gameType: gameType || "all",
      })

      console.log(`Sent ${activeLobbies.length} active lobbies to player ${client.sessionId}`)
    })

    // Handle player ready state - NEW READY SYSTEM
    this.onMessage("ready", (client: Client, message: any) => {
      try {
        console.log(`🎯 LobbyRoom: Player ${client.sessionId} ready state message:`, message)

        const player = this.state.players.get(client.sessionId)
        if (!player) {
          console.log(`❌ LobbyRoom: Player ${client.sessionId} not found in state`)
          client.send("error", { message: "Player not found in lobby" })
          return
        }

        // Validate message
        if (typeof message.ready !== "boolean") {
          console.log(`❌ LobbyRoom: Invalid ready state from ${client.sessionId}:`, message.ready)
          client.send("error", { message: "Invalid ready state" })
          return
        }

        // Update player ready state
        const oldReadyState = player.ready
        player.ready = message.ready

        console.log(
          `✅ LobbyRoom: Player ${client.sessionId} ready state changed from ${oldReadyState} to ${player.ready}`,
        )

        // Broadcast ready state change to all clients
        this.broadcast("player_ready_changed", {
          playerId: client.sessionId,
          playerName: player.name,
          ready: player.ready,
          timestamp: Date.now(),
        })

        // Check if all players are ready
        this.checkAndStartGameSession()
      } catch (error) {
        console.error(`❌ LobbyRoom: Error handling ready message from ${client.sessionId}:`, error)
        client.send("error", { message: "Failed to process ready state" })
      }
    })

    // Handle game type selection for ready sessions
    this.onMessage("select_game_type", (client: Client, message: any) => {
      const { gameType } = message
      console.log(`🎮 Player ${client.sessionId} selected game type: ${gameType}`)

      // Start or join a game session for this game type
      this.joinOrCreateGameSession(client, gameType)
    })

    // Handle leaving game session
    this.onMessage("leave_game_session", (client: Client) => {
      this.removePlayerFromGameSession(client.sessionId)
    })

    // Add test message handler for debugging
    this.onMessage("test_message", (client: Client, message: any) => {
      console.log(`🧪 LobbyRoom: Test message received from ${client.sessionId}:`, message)
      client.send("test_response", {
        message: "Test message received successfully",
        timestamp: Date.now(),
        clientId: client.sessionId,
        roomId: this.roomId,
      })
    })

    // Handle ping/heartbeat messages
    this.onMessage("ping", (client: Client, message: any) => {
      client.send("pong", { timestamp: Date.now() })
    })

    // Set up periodic cleanup of stale games
    this.setSimulationInterval(() => {
      this.state.cleanupStaleGames()
    }, 30000) // Check every 30 seconds

    // Broadcast room presence for discovery
    this.broadcast("lobby_available", {
      id: this.roomId,
      name: this.metadata.name,
      clients: this.clients.length,
      maxClients: this.maxClients,
      timestamp: Date.now(),
    })

    console.log(`🏠 LobbyRoom ${this.roomId} is now discoverable with metadata:`, this.metadata)
  }

  onJoin(client: Client, options: any) {
    console.log(`🚪 LobbyRoom: Player ${client.sessionId} joined the lobby`)

    try {
      const username = options.username || `Player_${client.sessionId.substr(0, 6)}`
      this.state.addPlayer(client.sessionId, username)

      console.log(`✅ LobbyRoom: Player ${username} (${client.sessionId}) added to state`)

      // Send current state to the new player
      const playersArray: Array<{ id: string; name: string; ready: boolean }> = []
      this.state.players.forEach((player: any, id: string) => {
        playersArray.push({
          id: id,
          name: player.name,
          ready: player.ready,
        })
      })

      const gamesArray: Array<{ id: string; name: string; type: string; currentPlayers: number; maxPlayers: number }> =
        []
      this.state.availableGames.forEach((game: any, id: string) => {
        gamesArray.push({
          id: id,
          name: game.name,
          type: game.type,
          currentPlayers: game.currentPlayers,
          maxPlayers: game.maxPlayers,
        })
      })

      // Send comprehensive lobby state
      client.send("lobby_state", {
        players: playersArray,
        availableGames: gamesArray,
        lobbyId: this.roomId,
        metadata: this.metadata,
        playerCount: playersArray.length,
        timestamp: Date.now(),
      })

      // Send welcome message
      client.send("lobby_welcome", {
        message: `Welcome to ${this.metadata.name}!`,
        playerId: client.sessionId,
        playerName: username,
        playerCount: playersArray.length,
        timestamp: Date.now(),
      })

      // Broadcast updated player count for discovery
      this.broadcast("player_count_update", {
        count: this.clients.length,
        maxPlayers: this.maxClients,
        playerCount: playersArray.length,
        timestamp: Date.now(),
      })

      // Broadcast lobby stats update
      this.broadcast("lobby_stats_update", {
        totalPlayers: playersArray.length,
        availableGames: gamesArray.length,
        timestamp: Date.now(),
      })

      console.log(`📊 LobbyRoom: Now has ${this.clients.length} clients, ${playersArray.length} players`)
    } catch (error) {
      console.error(`❌ LobbyRoom: Error in onJoin for ${client.sessionId}:`, error)
      client.send("error", { message: "Failed to join lobby" })
    }
  }

  private checkAndStartGameSession() {
    if (!this.gameSession) return

    let allReady = true
    let readyCount = 0
    const totalPlayers = this.gameSession.players.size

    this.gameSession.players.forEach((playerId: string) => {
      const player = this.state.players.get(playerId)
      if (player) {
        if (player.ready) {
          readyCount++
        } else {
          allReady = false
        }
      }
    })

    console.log(`📊 LobbyRoom Game Session: Ready status - ${readyCount}/${totalPlayers} players ready`)

    // Broadcast ready count update with more detailed info
    this.broadcast("lobby_ready_update", {
      readyCount,
      totalPlayers,
      allReady,
      gameType: this.gameSession.gameType,
      sessionPlayers: Array.from(this.gameSession.players),
      timestamp: Date.now(),
    })

    // Also broadcast general lobby stats
    this.broadcast("lobby_stats_update", {
      totalPlayers: this.state.players.size,
      readyPlayers: readyCount,
      gameSessionActive: true,
      timestamp: Date.now(),
    })

    // If all players are ready and we have minimum players, create battle room
    if (allReady && totalPlayers >= 2) {
      console.log(`🎉 LobbyRoom: All ${totalPlayers} players are ready! Creating battle room...`)
      this.createBattleRoomForSession()
    }
  }

  private async createBattleRoomForSession() {
    if (!this.gameSession) return

    try {
      console.log(`🎮 Creating battle room for ${this.gameSession.players.size} players`)

      // Create battle room with ready players
      const battleRoomOptions = {
        roomName: `Battle ${Date.now().toString().substring(8)}`,
        gameMode: "deathmatch",
        mapTheme: "default",
        maxPlayers: 16,
        lobbyId: this.roomId,
        preReadyPlayers: Array.from(this.gameSession.players),
      }

      // Notify all session players that battle room is being created
      this.gameSession.players.forEach((playerId: string) => {
        const client = this.clients.find((c) => c.sessionId === playerId)
        if (client) {
          client.send("battle_room_creating", {
            message: "Battle room is being created...",
            gameType: this.gameSession.gameType,
            playerCount: this.gameSession.players.size,
            timestamp: Date.now(),
          })
        }
      })

      // Use matchMaker to create the battle room
      const battleRoom = await this.presence.hset(
        "battle_rooms",
        `battle_${Date.now()}`,
        JSON.stringify(battleRoomOptions),
      )

      // Send battle room connection info to all ready players
      this.gameSession.players.forEach((playerId: string) => {
        const client = this.clients.find((c) => c.sessionId === playerId)
        const player = this.state.players.get(playerId)
        if (client && player) {
          client.send("join_battle_room", {
            gameType: "battle",
            options: {
              username: player.name,
              fromLobby: true,
              lobbyId: this.roomId,
            },
            timestamp: Date.now(),
          })
        }
      })

      // Clear the game session
      this.gameSession = null

      console.log(`✅ Battle room creation initiated for ready players`)
    } catch (error) {
      console.error(`❌ Failed to create battle room:`, error)

      // Notify players of the error
      if (this.gameSession) {
        this.gameSession.players.forEach((playerId: string) => {
          const client = this.clients.find((c) => c.sessionId === playerId)
          if (client) {
            client.send("error", {
              message: "Failed to create battle room. Please try again.",
              timestamp: Date.now(),
            })
          }
        })
      }
    }
  }

  private joinOrCreateGameSession(client: Client, gameType: string) {
    // Create new game session if none exists
    if (!this.gameSession) {
      this.gameSession = {
        gameType: gameType,
        players: new Set(),
        createdAt: Date.now(),
      }
      console.log(`🎮 Created new game session for ${gameType}`)
    }

    // Add player to session
    this.gameSession.players.add(client.sessionId)

    // Reset player ready state when joining session
    const player = this.state.players.get(client.sessionId)
    if (player) {
      player.ready = false
    }

    console.log(`🎯 Player ${client.sessionId} joined game session (${this.gameSession.players.size} players)`)

    // Broadcast session update
    this.broadcast("game_session_update", {
      gameType: this.gameSession.gameType,
      playerCount: this.gameSession.players.size,
      players: Array.from(this.gameSession.players),
      timestamp: Date.now(),
    })

    // Send confirmation to client
    client.send("joined_game_session", {
      gameType: gameType,
      playerCount: this.gameSession.players.size,
      timestamp: Date.now(),
    })
  }

  private removePlayerFromGameSession(playerId: string) {
    if (!this.gameSession) {
      return
    }

    this.gameSession.players.delete(playerId)

    // Reset player ready state
    const player = this.state.players.get(playerId)
    if (player) {
      player.ready = false
    }

    console.log(`🚪 Player ${playerId} left game session (${this.gameSession.players.size} players remaining)`)

    // Remove session if empty
    if (this.gameSession.players.size === 0) {
      this.gameSession = null
      console.log(`🗑️ Game session removed (no players remaining)`)

      this.broadcast("game_session_update", {
        gameType: null,
        playerCount: 0,
        players: [],
        timestamp: Date.now(),
      })
      return
    }

    // Broadcast session update for active session
    this.broadcast("game_session_update", {
      gameType: this.gameSession.gameType,
      playerCount: this.gameSession.players.size,
      players: Array.from(this.gameSession.players),
      timestamp: Date.now(),
    })
  }

  onLeave(client: Client, consented: boolean) {
    console.log(`👋 LobbyRoom: Player ${client.sessionId} left the lobby (consented: ${consented})`)

    try {
      // Remove from game session if in one
      this.removePlayerFromGameSession(client.sessionId)

      // Remove player from any games they were in
      this.state.removePlayerFromAllGames(client.sessionId)

      // Remove player from lobby
      const removed = this.state.removePlayer(client.sessionId)

      if (removed) {
        console.log(`✅ LobbyRoom: Player ${client.sessionId} removed from state`)

        // Broadcast player left
        this.broadcast("player_left", {
          playerId: client.sessionId,
          timestamp: Date.now(),
        })
      }

      // Broadcast updated player count
      this.broadcast("player_count_update", {
        count: this.clients.length,
        maxPlayers: this.maxClients,
        timestamp: Date.now(),
      })

      console.log(`📊 LobbyRoom: Now has ${this.clients.length} players`)
    } catch (error) {
      console.error(`❌ LobbyRoom: Error in onLeave for ${client.sessionId}:`, error)
    }
  }

  onDispose() {
    console.log("🏠 LobbyRoom: Room disposed")
  }

  onError(client: Client, error: any) {
    console.error(`❌ LobbyRoom: Client ${client.sessionId} error:`, error)
  }
}
