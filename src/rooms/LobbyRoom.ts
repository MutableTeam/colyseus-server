import { Room, type Client } from "@colyseus/core"
import { LobbyState } from "../schemas/LobbyState"

export class LobbyRoom extends Room<LobbyState> {
  maxClients = 50

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

    // Handle ready state
    this.onMessage("ready", (client: Client, message: any) => {
      console.log(`Player ${client.sessionId} ready state changed to: ${message.ready}`)

      const player = this.state.players.get(client.sessionId)
      if (!player) return

      // Update player ready state
      player.ready = message.ready

      // Broadcast ready state change to all clients
      this.broadcast("player_ready_changed", {
        playerId: client.sessionId,
        ready: message.ready,
      })

      // Check if all players are ready
      let allReady = true
      let playerCount = 0

      this.state.players.forEach((p) => {
        playerCount++
        if (!p.ready) {
          allReady = false
        }
      })

      // If all players are ready, broadcast it
      if (allReady && playerCount > 0) {
        this.broadcast("all_players_ready", {
          playerCount: playerCount,
          timestamp: Date.now(),
        })
      }
    })

    // Add test message handler for debugging
    this.onMessage("test_message", (client: Client, message: any) => {
      console.log(`Test message received from ${client.sessionId}:`, message)
      client.send("test_response", {
        message: "Test message received successfully",
        timestamp: Date.now(),
        clientId: client.sessionId,
      })
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
    console.log(`Player ${client.sessionId} joined the lobby`)
    this.state.addPlayer(client.sessionId, options.username || `Player_${client.sessionId.substr(0, 6)}`)

    // Send current state to the new player
    client.send("lobby_state", {
      players: this.state.players,
      availableGames: this.state.availableGames,
      lobbyId: this.roomId,
      metadata: this.metadata,
    })

    // Broadcast updated player count for discovery
    this.broadcast("player_count_update", {
      count: this.clients.length,
      maxPlayers: this.maxClients,
      timestamp: Date.now(),
    })
  }

  onLeave(client: Client, consented: boolean) {
    console.log(`Player ${client.sessionId} left the lobby`)

    // Remove player from any games they were in
    this.state.removePlayerFromAllGames(client.sessionId)

    // Remove player from lobby
    this.state.removePlayer(client.sessionId)

    // Broadcast updated player count
    this.broadcast("player_count_update", {
      count: this.clients.length,
      maxPlayers: this.maxClients,
      timestamp: Date.now(),
    })
  }

  onDispose() {
    console.log("Lobby room disposed")
  }
}
