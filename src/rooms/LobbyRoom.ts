import { Room, type Client, matchMaker } from "@colyseus/core"
import { LobbyState, type GameSession } from "../schemas/LobbyState"

export class LobbyRoom extends Room<LobbyState> {
  maxClients = 50

  onCreate(options: any) {
    console.log("🏠 LobbyRoom created with ready-up system!", options)

    // Set metadata to help with room discovery
    this.setMetadata({
      name: options.lobbyName || `Lobby_${Date.now().toString().substring(8)}`,
      gameType: "lobby",
      isPublic: true,
      createdAt: Date.now(),
    })

    // Initialize the room state
    this.setState(new LobbyState())

    // Handle creating a game session (ready-up group)
    this.onMessage("create_game_session", (client: Client, message: any) => {
      const { gameType, sessionName, maxPlayers } = message
      console.log(`🎮 Player ${client.sessionId} creating game session: ${sessionName} (${gameType})`)

      const sessionId = `${gameType}_session_${Date.now()}`
      const session = this.state.createGameSession(sessionId, gameType, sessionName, maxPlayers || 16, client.sessionId)

      // Broadcast new session created
      this.broadcast("game_session_created", {
        sessionId,
        gameType,
        sessionName,
        maxPlayers,
        creatorId: client.sessionId,
        timestamp: Date.now(),
      })

      // Send confirmation to creator
      client.send("session_created", {
        sessionId,
        session: this.serializeSession(session),
      })
    })

    // Handle joining a game session
    this.onMessage("join_game_session", (client: Client, message: any) => {
      const { sessionId } = message
      console.log(`🎯 Player ${client.sessionId} joining game session: ${sessionId}`)

      const success = this.state.joinGameSession(sessionId, client.sessionId)

      if (success) {
        const session = this.state.gameSessions.get(sessionId)

        // Broadcast player joined session
        this.broadcast("player_joined_session", {
          sessionId,
          playerId: client.sessionId,
          playerName: this.state.players.get(client.sessionId)?.name,
          currentPlayers: session?.currentPlayers,
          timestamp: Date.now(),
        })

        client.send("session_joined", {
          sessionId,
          session: session ? this.serializeSession(session) : null,
        })
      } else {
        client.send("session_join_failed", {
          sessionId,
          reason: "Session full or not available",
        })
      }
    })

    // Handle leaving a game session
    this.onMessage("leave_game_session", (client: Client, message: any) => {
      const { sessionId } = message
      console.log(`🚪 Player ${client.sessionId} leaving game session: ${sessionId}`)

      const success = this.state.leaveGameSession(sessionId, client.sessionId)

      if (success) {
        this.broadcast("player_left_session", {
          sessionId,
          playerId: client.sessionId,
          timestamp: Date.now(),
        })
      }
    })

    // Handle ready state changes - MAIN READY-UP LOGIC
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

        // Update player ready state and get their session
        const session = this.state.setPlayerReady(client.sessionId, message.ready)

        if (!session) {
          client.send("error", { message: "Player not in any game session" })
          return
        }

        console.log(`✅ LobbyRoom: Player ${client.sessionId} (${player.name}) ready state: ${message.ready}`)

        // Broadcast ready state change to all clients
        this.broadcast("player_ready_changed", {
          playerId: client.sessionId,
          playerName: player.name,
          ready: message.ready,
          sessionId: session.id,
          timestamp: Date.now(),
        })

        // Check if all players in session are ready
        let readyCount = 0
        let totalPlayers = 0

        session.players.forEach((p) => {
          totalPlayers++
          if (p.ready) readyCount++
        })

        console.log(`📊 LobbyRoom Session ${session.id}: ${readyCount}/${totalPlayers} players ready`)

        // Broadcast session ready update
        this.broadcast("session_ready_update", {
          sessionId: session.id,
          readyCount,
          totalPlayers,
          allReady: session.allReady,
          timestamp: Date.now(),
        })

        // If all players are ready, create battle room and transition
        if (session.allReady && session.status === "ready") {
          console.log(`🎉 LobbyRoom Session ${session.id}: All players ready! Creating battle room...`)
          this.createBattleRoomAndTransition(session)
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
        console.error(`❌ LobbyRoom: Error handling ready message from ${client.sessionId}:`, error)
        client.send("error", { message: "Failed to process ready state" })
      }
    })

    // Handle getting available sessions
    this.onMessage("get_game_sessions", (client: Client, message: any) => {
      const { gameType } = message
      const sessions: any[] = []

      this.state.gameSessions.forEach((session) => {
        if (!gameType || session.gameType === gameType) {
          sessions.push(this.serializeSession(session))
        }
      })

      client.send("game_sessions", {
        sessions,
        gameType: gameType || "all",
        timestamp: Date.now(),
      })
    })

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

    // Set up periodic cleanup of stale sessions
    this.setSimulationInterval(() => {
      this.cleanupStaleSessions()
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
    console.log(`🏠 LobbyRoom ${this.roomId} ready with game session management`)
  }

  private async createBattleRoomAndTransition(session: GameSession) {
    try {
      console.log(`🚀 Creating battle room for session ${session.id}`)

      // Update session status
      session.status = "starting"

      // Prepare battle room options
      const battleRoomOptions = {
        roomName: session.sessionName,
        gameMode: "deathmatch",
        mapTheme: "default",
        maxPlayers: session.maxPlayers,
        sessionId: session.id,
        lobbyRoomId: this.roomId,
      }

      // Create the battle room - Fixed: Use proper SeatReservation type
      const seatReservation = await matchMaker.create("battle", battleRoomOptions)
      session.battleRoomId = seatReservation.room.roomId
      session.status = "started"

      console.log(`✅ Battle room created: ${seatReservation.room.roomId}`)

      // Prepare player data for transition
      const playersData: any[] = []
      session.players.forEach((player) => {
        playersData.push({
          id: player.id,
          name: player.name,
          characterType: player.characterType,
          ready: player.ready,
        })
      })

      // Notify all players in the session to transition to battle room
      session.players.forEach((player) => {
        const client = this.clients.find((c) => c.sessionId === player.id)
        if (client) {
          client.send("transition_to_battle", {
            battleRoomId: seatReservation.room.roomId,
            sessionId: session.id,
            playersData,
            battleRoomOptions,
            timestamp: Date.now(),
          })
        }
      })

      // Broadcast to all lobby clients that session started
      this.broadcast("session_started", {
        sessionId: session.id,
        battleRoomId: seatReservation.room.roomId,
        playersData,
        timestamp: Date.now(),
      })

      // Schedule session cleanup after players have transitioned
      this.clock.setTimeout(() => {
        this.cleanupCompletedSession(session.id)
      }, 30000) // 30 seconds to transition
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
      console.error(`❌ Failed to create battle room for session ${session.id}:`, error)

      // Reset session status on failure
      session.status = "waiting"
      session.players.forEach((player) => {
        player.ready = false
      })

      // Notify players of failure
      session.players.forEach((player) => {
        const client = this.clients.find((c) => c.sessionId === player.id)
        if (client) {
          client.send("battle_room_creation_failed", {
            sessionId: session.id,
            error: errorMessage,
            timestamp: Date.now(),
          })
        }
      })
    }
  }

  private serializeSession(session: GameSession) {
    const playersArray: any[] = []
    session.players.forEach((player) => {
      playersArray.push({
        id: player.id,
        name: player.name,
        characterType: player.characterType,
        ready: player.ready,
        joinedAt: player.joinedAt,
      })
    })

    return {
      id: session.id,
      gameType: session.gameType,
      sessionName: session.sessionName,
      maxPlayers: session.maxPlayers,
      currentPlayers: session.currentPlayers,
      allReady: session.allReady,
      status: session.status,
      createdAt: session.createdAt,
      battleRoomId: session.battleRoomId,
      players: playersArray,
    }
  }

  private cleanupStaleSessions() {
    const now = Date.now()
    const staleThreshold = 30 * 60 * 1000 // 30 minutes

    this.state.gameSessions.forEach((session, sessionId) => {
      if (
        now - session.createdAt > staleThreshold ||
        (session.status === "started" && now - session.createdAt > 5 * 60 * 1000)
      ) {
        // 5 min for started sessions
        console.log(`🧹 Cleaning up stale session: ${sessionId}`)
        this.state.gameSessions.delete(sessionId)
      }
    })
  }

  private cleanupCompletedSession(sessionId: string) {
    console.log(`🧹 Cleaning up completed session: ${sessionId}`)
    this.state.gameSessions.delete(sessionId)
  }

  onJoin(client: Client, options: any) {
    console.log(`🚪 LobbyRoom: Player ${client.sessionId} joined the lobby`)

    try {
      const username = options.username || `Player_${client.sessionId.substr(0, 6)}`
      this.state.addPlayer(client.sessionId, username)

      console.log(`✅ LobbyRoom: Player ${username} (${client.sessionId}) added to state`)

      // Send current state to the new player
      const playersArray: Array<{ id: string; name: string; ready: boolean; selectedGameType: string }> = []
      this.state.players.forEach((player, id) => {
        playersArray.push({
          id: id,
          name: player.name,
          ready: player.ready,
          selectedGameType: player.selectedGameType,
        })
      })

      const sessionsArray: any[] = []
      this.state.gameSessions.forEach((session) => {
        sessionsArray.push(this.serializeSession(session))
      })

      client.send("lobby_state", {
        players: playersArray,
        gameSessions: sessionsArray,
        lobbyId: this.roomId,
        metadata: this.metadata,
        timestamp: Date.now(),
      })

      // Send welcome message
      client.send("lobby_welcome", {
        message: `Welcome to ${this.metadata.name}! Join a game session to ready up.`,
        playerId: client.sessionId,
        playerName: username,
        timestamp: Date.now(),
      })

      console.log(`📊 LobbyRoom: Now has ${this.clients.length} players`)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
      console.error(`❌ LobbyRoom: Error in onJoin for ${client.sessionId}:`, error)
      client.send("error", { message: "Failed to join lobby" })
    }
  }

  onLeave(client: Client, consented: boolean) {
    console.log(`👋 LobbyRoom: Player ${client.sessionId} left the lobby (consented: ${consented})`)

    try {
      // Remove player from lobby and any sessions
      const removed = this.state.removePlayer(client.sessionId)

      if (removed) {
        console.log(`✅ LobbyRoom: Player ${client.sessionId} removed from state`)

        // Broadcast player left
        this.broadcast("player_left", {
          playerId: client.sessionId,
          timestamp: Date.now(),
        })
      }

      console.log(`📊 LobbyRoom: Now has ${this.clients.length} players`)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
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
