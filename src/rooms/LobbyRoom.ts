import { Room, type Client } from "@colyseus/core"
import { LobbyState } from "../schemas/LobbyState"
import { gameType } from "../constants" // Declare the variable before using it

export class LobbyRoom extends Room<LobbyState> {
  maxClients = 50

  onCreate(options: any) {
    console.log("LobbyRoom created!", options)

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

    this.onMessage("get_active_lobbies", (client: Client, message: any) => {
      try {
        console.log(`Player ${client.sessionId} requesting active lobbies with filter:`, message)

        const { gameType } = message

        let activeLobbies
        if (gameType) {
          // Get lobbies for specific game type
          activeLobbies = this.state.getActiveLobbiesByGameType(gameType)
          console.log(`Found ${activeLobbies.length} active lobbies for game type: ${gameType}`)
        } else {
          // Get all active lobbies
          activeLobbies = this.state.getAllActiveLobbies()
          console.log(`Found ${activeLobbies.length} total active lobbies`)
        }

        // Send the filtered lobbies to the requesting client
        client.send("active_lobbies", {
          lobbies: activeLobbies,
          gameType: gameType || "all",
        })

        console.log(`Sent ${activeLobbies.length} active lobbies to player ${client.sessionId}`)
      } catch (error) {
        console.error(`Error getting active lobbies for ${client.sessionId}:`, error)
        client.send("active_lobbies", {
          lobbies: [],
          gameType: gameType || "all",
          error: "Failed to get active lobbies",
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
  }

  onJoin(client: Client, options: any) {
    console.log(`Player ${client.sessionId} joined the lobby`)
    this.state.addPlayer(client.sessionId, options.username || `Player_${client.sessionId.substring(0, 6)}`)

    // Send current state to the new player
    client.send("lobby_state", {
      players: this.state.players,
      availableGames: this.state.availableGames,
    })

    // Send current active lobbies to the new player
    const activeLobbies = this.state.getAllActiveLobbies()
    client.send("active_lobbies", {
      lobbies: activeLobbies,
      gameType: "all",
    })
  }

  onLeave(client: Client, consented: boolean) {
    console.log(`Player ${client.sessionId} left the lobby`)

    // Remove player from any games they were in
    this.state.removePlayerFromAllGames(client.sessionId)

    // Remove player from lobby
    this.state.removePlayer(client.sessionId)
  }

  onDispose() {
    console.log("Lobby room disposed")
  }
}
