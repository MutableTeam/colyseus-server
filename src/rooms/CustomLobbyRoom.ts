import { Room, type Client } from "@colyseus/core"
import { LobbyState } from "../schemas/LobbyState"
import type { Player } from "../schemas/Player" // Ensure Player is imported

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

        const player = this.state.players.get(client.sessionId) as Player // Cast to Player
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
        player.setReady(message.ready) // Use the setReady method

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

      const player = this.state.players.get(client.sessionId) as Player // Cast to Player
      if (player) {
        player.selectGameType(gameType) // Use the selectGameType method
      }

      // Start or join a game session for this game type
      this.joinOrCreateGameSession(client, gameType)
    })

    // Handle leaving game session
    this.onMessage("leave_game_session", (client: Client) => {
      this.removePlayerFromGameSession(client.sessionId)
    })

    // Add test message handler for debugging with enhanced response
    this.onMessage("test_message", (client: Client, message: any) => {
      console.log(`🧪 LobbyRoom: Test message received from ${client.sessionId}:`, message)

      const player = this.state.players.get(client.sessionId) as Player // Cast to Player
      const playerCount = this.state.players.size
      let readyCount = 0

      this.state.players.forEach((p) => {
        if (p.ready) readyCount++
      })

      // Send comprehensive test response
      client.send("test_response", {
        message: "Lobby test message received successfully",
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
        connectedClients: this.clients.length,
      })

      // Also send current lobby stats
      this.broadcastLobbyStats()

      console.log(
        `📊 Lobby: Sent test response with ${playerCount} total, ${readyCount} ready players to ${client.sessionId}`,
      )
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

    console.log(`🏛️ LobbyRoom ${this.roomId} is now ready for players!`)
  }

  onJoin(client: Client, options: any) {
    console.log(`${client.sessionId} joined CustomLobbyRoom with options:`, options)

    // Add player to state
    const username = options.username || `Player_${client.sessionId.substring(0, 6)}`
    this.state.addPlayer(client.sessionId, username, client.sessionId) // Pass sessionId as third argument

    // Welcome the new player
    client.send("lobby_welcome", {
      message: "Welcome to the Lobby!",
      playerCount: this.clients.length,
      sessionId: client.sessionId,
    })

    // Broadcast updated stats
    this.broadcastLobbyStats()
  }

  onLeave(client: Client, consented: boolean) {
    console.log(`${client.sessionId} left CustomLobbyRoom (consented: ${consented})`)

    // Remove player from state
    this.state.removePlayer(client.sessionId)

    // Remove from game session if they were in one
    this.removePlayerFromGameSession(client.sessionId)

    // Broadcast updated stats
    this.broadcastLobbyStats()
  }

  onDispose() {
    console.log("CustomLobbyRoom disposed")
  }

  private broadcastLobbyStats() {
    let readyCount = 0
    this.state.players.forEach((player) => {
      if (player.ready) readyCount++
    })

    const stats = {
      totalPlayers: this.clients.length,
      readyPlayers: readyCount,
      gameSessionActive: !!this.gameSession,
      gameSessionType: this.gameSession?.gameType || null,
      timestamp: Date.now(),
    }

    this.broadcast("lobby_stats_update", stats)
  }

  private getReadyPlayerCount(): number {
    let readyCount = 0
    this.state.players.forEach((player) => {
      if (player.ready) readyCount++
    })
    return readyCount
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
    const player = this.state.players.get(client.sessionId) as Player // Cast to Player
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
