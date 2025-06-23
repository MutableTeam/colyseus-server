import { Room, type Client } from "@colyseus/core"
import { LobbyState } from "../schemas/LobbyState"

export class CustomLobbyRoom extends Room<LobbyState> {
  maxClients = 50
  private gameSession: any = null

  onCreate(options: any) {
    console.log("🏛️ CustomLobbyRoom created - Readiness system active!", options)

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
      console.log(`🎮 Player ${client.sessionId} requesting to join game ${gameId} of type ${gameType}`)

      // Notify client about available games
      this.broadcast("available_games", this.state.availableGames)
    })

    // Handle player creating a game
    this.onMessage("create_game", (client: Client, message: any) => {
      const { gameType, gameName, maxPlayers } = message
      console.log(`🎮 Player ${client.sessionId} creating a game of type ${gameType}`)

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
      console.log(`🔍 Player ${client.sessionId} requesting active lobbies with filter:`, message)

      const { gameType } = message

      let activeLobbies
      if (gameType) {
        // Get lobbies for specific game type from local state
        activeLobbies = this.state.getActiveLobbiesByGameType(gameType)
        console.log(`🔍 Found ${activeLobbies.length} active lobbies for game type: ${gameType}`)
      } else {
        // Get all active lobbies from local state
        activeLobbies = this.state.getAllActiveLobbies()
        console.log(`🔍 Found ${activeLobbies.length} total active lobbies`)
      }

      // Send the filtered lobbies to the requesting client
      client.send("active_lobbies", {
        lobbies: activeLobbies,
        gameType: gameType || "all",
      })

      console.log(`📤 Sent ${activeLobbies.length} active lobbies to player ${client.sessionId}`)
    })

    // CORE READINESS SYSTEM - Handle player ready state
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
          `✅ LobbyRoom: Player ${client.sessionId} (${player.name}) ready state changed from ${oldReadyState} to ${player.ready}`,
        )

        // Broadcast ready state change to all clients
        this.broadcast("player_ready_changed", {
          playerId: client.sessionId,
          playerName: player.name,
          ready: player.ready,
          timestamp: Date.now(),
        })

        // Check if all players in game session are ready
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

      const player = this.state.players.get(client.sessionId)
      const playerCount = this.state.players.size
      let readyCount = 0

      this.state.players.forEach((p) => {
        if (p.ready) readyCount++
      })

      client.send("test_response", {
        message: "Test message received successfully",
        timestamp: Date.now(),
        clientId: client.sessionId,
        roomId: this.roomId,
        playerFound: !!player,
        playerName: player?.name || "Unknown",
        playerReady: player?.ready || false,
        totalPlayers: playerCount,
        readyPlayers: readyCount,
        gameSessionActive: !!this.gameSession,
        gameSessionType: this.gameSession?.gameType || null,
        gameSessionPlayers: this.gameSession?.players.size || 0,
      })

      // Also send current lobby stats
      this.broadcastLobbyStats()
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

    console.log(`🏛️ LobbyRoom ${this.roomId} is now discoverable with readiness system active`)
  }

  async onAuth(client: Client, options: any) {
    console.log(`🔐 CustomLobbyRoom: Authentication attempt from ${client.sessionId}`)
    console.log(`🔍 Auth options received:`, JSON.stringify(options, null, 2))
    console.log(`📊 Current room status: ${this.clients.length}/${this.maxClients} clients`)

    try {
      // Validate basic options structure
      if (!options || typeof options !== "object") {
        console.log(`⚠️ CustomLobbyRoom: Invalid or missing options, creating default for ${client.sessionId}`)
        options = {}
      }

      // PUBLIC SERVER: Very permissive username handling
      let username = options.username
      if (!username || typeof username !== "string" || username.trim() === "") {
        username = `Player_${client.sessionId.substring(0, 6)}`
        console.log(`🔧 CustomLobbyRoom: Generated default username: ${username}`)
      } else {
        // Sanitize but keep original intent
        username = username.trim().substring(0, 20)
        // Remove potentially problematic characters but keep it readable
        username = username.replace(/[<>"'&]/g, "_")
        console.log(`🔧 CustomLobbyRoom: Sanitized username: ${username}`)
      }

      // FIXED: Check capacity properly - don't count current client as it's not in clients array yet during onAuth
      const currentClientCount = this.clients.length
      console.log(`📊 CustomLobbyRoom: Capacity check - ${currentClientCount} current clients, max ${this.maxClients}`)

      if (currentClientCount >= this.maxClients) {
        console.log(`❌ CustomLobbyRoom: Room is full (${currentClientCount}/${this.maxClients})`)
        throw new Error("Lobby is full - please try again later")
      }

      // Create authentication result
      const authResult = {
        username: username,
        authenticated: true,
        joinTime: Date.now(),
        playerType: "lobby_player",
        sessionId: client.sessionId,
      }

      console.log(`✅ CustomLobbyRoom: Authentication SUCCESS for ${client.sessionId}`)
      console.log(`👤 User: ${username}`)
      console.log(`📊 Room will have: ${currentClientCount + 1}/${this.maxClients} clients after join`)

      return authResult
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`❌ CustomLobbyRoom: Authentication FAILED for ${client.sessionId}: ${errorMessage}`)
      console.error(`🔍 Failed auth options:`, JSON.stringify(options, null, 2))
      throw error
    }
  }

  onJoin(client: Client, options: any) {
    console.log(
      `🚪 CustomLobbyRoom: Player ${client.sessionId} joining with options:`,
      JSON.stringify(options, null, 2),
    )

    try {
      const username = options.username || `Player_${client.sessionId.substr(0, 6)}`

      console.log(`🔧 Adding player ${username} (${client.sessionId}) to lobby state...`)
      this.state.addPlayer(client.sessionId, username)

      console.log(`✅ LobbyRoom: Player ${username} (${client.sessionId}) added to state successfully`)

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

      console.log(
        `📊 LobbyRoom: Sending state to ${client.sessionId} - ${playersArray.length} players, ${gamesArray.length} games`,
      )

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

      // Broadcast lobby stats update immediately after join
      this.broadcastLobbyStats()

      console.log(`📊 LobbyRoom: Now has ${this.clients.length} clients, ${playersArray.length} players`)

      // Send immediate stats update to the new player
      setTimeout(() => {
        this.broadcastLobbyStats()
      }, 500)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`❌ LobbyRoom: Error in onJoin for ${client.sessionId}: ${errorMessage}`)
      client.send("error", { message: "Failed to join lobby" })
    }
  }

  // CORE READINESS LOGIC - Check if all players in game session are ready
  private checkAndStartGameSession() {
    if (!this.gameSession) {
      console.log(`🔍 LobbyRoom: No active game session to check readiness`)
      return
    }

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

    // Broadcast ready count update with detailed info
    this.broadcast("lobby_ready_update", {
      readyCount,
      totalPlayers,
      allReady,
      gameType: this.gameSession.gameType,
      sessionPlayers: Array.from(this.gameSession.players),
      timestamp: Date.now(),
    })

    // Broadcast general lobby stats
    this.broadcastLobbyStats(readyCount)

    // CRITICAL: If all players are ready and we have minimum players, create battle room
    if (allReady && totalPlayers >= 2) {
      console.log(`🎉 LobbyRoom: All ${totalPlayers} players are ready! Creating battle room...`)
      this.createBattleRoomForSession()
    } else if (allReady && totalPlayers < 2) {
      console.log(`⚠️ LobbyRoom: All players ready but need at least 2 players (have ${totalPlayers})`)
    } else {
      console.log(`⏳ LobbyRoom: Waiting for more players to be ready (${readyCount}/${totalPlayers})`)
    }
  }

  // CORE BATTLE ROOM CREATION - Only triggered from lobby when all ready
  private async createBattleRoomForSession() {
    if (!this.gameSession) {
      console.error(`❌ LobbyRoom: Cannot create battle room - no active game session`)
      return
    }

    try {
      console.log(`🎮 LobbyRoom: Creating battle room for ${this.gameSession.players.size} ready players`)

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

      // Create battle room options with lobby context
      const battleRoomOptions = {
        roomName: `Battle ${Date.now().toString().substring(8)}`,
        gameMode: "deathmatch",
        mapTheme: "default",
        maxPlayers: 16,
        fromLobby: true, // CRITICAL: Mark as created from lobby
        lobbyId: this.roomId,
        preReadyPlayers: Array.from(this.gameSession.players), // Pass ready players
      }

      console.log(`🎮 LobbyRoom: Battle room options:`, battleRoomOptions)

      // Send battle room connection info to all ready players
      this.gameSession.players.forEach((playerId: string) => {
        const client = this.clients.find((c) => c.sessionId === playerId)
        const player = this.state.players.get(playerId)
        if (client && player) {
          console.log(`📤 LobbyRoom: Sending battle room join message to ${player.name}`)
          client.send("join_battle_room", {
            gameType: "battle",
            options: {
              username: player.name,
              fromLobby: true, // CRITICAL: Mark as from lobby
              lobbyId: this.roomId,
              characterType: "default",
              playerType: "battle_player",
              timestamp: Date.now(),
            },
            timestamp: Date.now(),
          })
        }
      })

      // Clear the game session after battle room creation
      console.log(`🧹 LobbyRoom: Clearing game session after battle room creation`)
      this.gameSession = null

      // Broadcast session cleared
      this.broadcast("game_session_update", {
        gameType: null,
        playerCount: 0,
        players: [],
        timestamp: Date.now(),
      })

      console.log(`✅ LobbyRoom: Battle room creation initiated for ready players`)
    } catch (error) {
      console.error(`❌ LobbyRoom: Failed to create battle room:`, error)

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
      console.log(`🎮 LobbyRoom: Created new game session for ${gameType}`)
    }

    // Add player to session
    this.gameSession.players.add(client.sessionId)

    // Reset player ready state when joining session
    const player = this.state.players.get(client.sessionId)
    if (player) {
      player.ready = false
      console.log(`🔄 LobbyRoom: Reset ready state for ${player.name} when joining session`)
    }

    console.log(
      `🎯 LobbyRoom: Player ${client.sessionId} joined game session (${this.gameSession.players.size} players)`,
    )

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

    // Broadcast updated lobby stats
    this.broadcastLobbyStats()
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
      console.log(`🔄 LobbyRoom: Reset ready state for player ${playerId} when leaving session`)
    }

    console.log(
      `🚪 LobbyRoom: Player ${playerId} left game session (${this.gameSession.players.size} players remaining)`,
    )

    // Remove session if empty
    if (this.gameSession.players.size === 0) {
      this.gameSession = null
      console.log(`🗑️ LobbyRoom: Game session removed (no players remaining)`)

      this.broadcast("game_session_update", {
        gameType: null,
        playerCount: 0,
        players: [],
        timestamp: Date.now(),
      })

      this.broadcastLobbyStats()
      return
    }

    // Broadcast session update for active session
    this.broadcast("game_session_update", {
      gameType: this.gameSession.gameType,
      playerCount: this.gameSession.players.size,
      players: Array.from(this.gameSession.players),
      timestamp: Date.now(),
    })

    // Check readiness after player leaves
    this.checkAndStartGameSession()
  }

  private broadcastLobbyStats(readyPlayers?: number) {
    let calculatedReadyPlayers = readyPlayers ?? 0 // Use nullish coalescing to ensure it's never undefined

    if (readyPlayers === undefined) {
      calculatedReadyPlayers = 0
      this.state.players.forEach((player) => {
        if (player.ready) calculatedReadyPlayers++
      })
    }

    this.broadcast("lobby_stats_update", {
      totalPlayers: this.state.players.size,
      readyPlayers: calculatedReadyPlayers, // Now guaranteed to be a number
      gameSessionActive: !!this.gameSession,
      timestamp: Date.now(),
    })
  }

  onLeave(client: Client, consented: boolean) {
    console.log(`👋 CustomLobbyRoom: Player ${client.sessionId} left the lobby (consented: ${consented})`)

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

      // Broadcast updated lobby stats
      this.broadcastLobbyStats()

      console.log(`📊 CustomLobbyRoom: Now has ${this.clients.length} players`)
    } catch (error) {
      console.error(`❌ CustomLobbyRoom: Error in onLeave for ${client.sessionId}:`, error)
    }
  }

  onDispose() {
    console.log("🏛️ CustomLobbyRoom: Room disposed")
  }

  onError(client: Client, error: any) {
    console.error(`❌ CustomLobbyRoom: Client ${client.sessionId} error:`, error)
  }

  // Disable auto-dispose to keep lobby persistent
  autoDispose = false
}
