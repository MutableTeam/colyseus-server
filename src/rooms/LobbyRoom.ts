import { Room, type Client } from "colyseus"
import { LobbyState } from "../schemas/LobbyState"

export class LobbyRoom extends Room<LobbyState> {
  maxClients = 50

  onCreate(options: any) {
    console.log("LobbyRoom created!", options)
    this.setState(new LobbyState())

    // Handle player joining a game
    this.onMessage("join_game", (client, message) => {
      const { gameId, gameType } = message
      console.log(`Player ${client.sessionId} requesting to join game ${gameId} of type ${gameType}`)

      // Notify client about available games
      this.broadcast("available_games", this.state.availableGames)
    })

    // Handle player creating a game
    this.onMessage("create_game", (client, message) => {
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
    this.onMessage("leave_game", (client, message) => {
      const { gameId } = message
      this.state.removePlayerFromGame(gameId, client.sessionId)

      // Notify all clients about the player leaving
      this.broadcast("player_left_game", {
        gameId,
        playerId: client.sessionId,
      })
    })

    // Set up periodic cleanup of stale games
    this.setSimulationInterval(() => {
      this.state.cleanupStaleGames()
    }, 30000) // Check every 30 seconds
  }

  onJoin(client: Client, options: any) {
    console.log(`Player ${client.sessionId} joined the lobby`)
    this.state.addPlayer(client.sessionId, options.username || `Player_${client.sessionId.substr(0, 6)}`)

    // Send current state to the new player
    client.send("lobby_state", {
      players: this.state.players,
      availableGames: this.state.availableGames,
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
