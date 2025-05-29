import { Room, type Client } from "@colyseus/core"
import { LobbyState } from "../schemas/LobbyState"

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

      // Try to add player to the game
      const success = this.state.addPlayerToGame(gameId, client.sessionId)

      if (success) {
        // Notify client about successful join
        client.send("join_game_success", {
          gameId,
          gameType: this.state.availableGames.get(gameId)?.type || gameType,
        })

        // Notify all clients about the player joining
        this.broadcast("player_joined_game", {
          gameId,
          playerId: client.sessionId,
          currentPlayers: this.state.availableGames.get(gameId)?.currentPlayers || 0,
        })
      } else {
        // Notify client about failed join
        client.send("join_game_failed", {
          gameId,
          reason: "Game is full, locked, or doesn't exist",
        })
      }

      // Notify all clients about available games
      this.broadcast("available_games", this.state.availableGames)
    })

    // Handle player creating a game
    this.onMessage("create_game", (client: Client, message: any) => {
      const { gameType, gameName, maxPlayers } = message
      console.log(`Player ${client.sessionId} creating a game of type ${gameType}`)

      const gameId = `${gameType}_${Date.now()}`
      const game = this.state.createGame(
        gameId,
        gameType,
        gameName || `${gameType} Game`,
        maxPlayers || 4,
        client.sessionId,
      )

      // Notify all clients about the new game
      this.broadcast("game_created", {
        gameId,
        gameType,
        gameName: game.name,
        maxPlayers: game.maxPlayers,
        creatorId: client.sessionId,
      })

      // Notify client about successful creation
      client.send("create_game_success", {
        gameId,
        gameType,
        gameName: game.name,
      })
    })

    // Handle player leaving a game
    this.onMessage("leave_game", (client: Client, message: any) => {
      const { gameId } = message
      const success = this.state.removePlayerFromGame(gameId, client.sessionId)

      if (success) {
        // Notify all clients about the player leaving
        this.broadcast("player_left_game", {
          gameId,
          playerId: client.sessionId,
        })

        // Notify client about successful leave
        client.send("leave_game_success", { gameId })
      } else {
        // Notify client about failed leave
        client.send("leave_game_failed", {
          gameId,
          reason: "You are not in this game or the game doesn't exist",
        })
      }
    })

    // Handle request for active lobbies by game type
    this.onMessage("get_active_lobbies", (client: Client, message: any) => {
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
    })

    // Handle player ready state
    this.onMessage("ready", (client: Client, message: any) => {
      const { ready } = message
      const player = this.state.players.get(client.sessionId)

      if (player) {
        player.ready = ready === true

        // Find which game this player is in
        let playerGameId: string | null = null

        this.state.availableGames.forEach((game, gameId) => {
          if (game.playerIds.has(client.sessionId)) {
            playerGameId = gameId
          }
        })

        if (playerGameId) {
          // Broadcast player ready state
          this.broadcast("player_ready", {
            gameId: playerGameId,
            playerId: client.sessionId,
            ready: player.ready,
          })

          // Check if all players in the game are ready
          const game = this.state.availableGames.get(playerGameId)
          if (game) {
            let allReady = true
            let playerCount = 0

            // Check if all players in this game are ready
            game.playerIds.forEach((_, playerId) => {
              const gamePlayer = this.state.players.get(playerId)
              playerCount++
              if (gamePlayer && !gamePlayer.ready) {
                allReady = false
              }
            })

            // If all players are ready and there are at least 2 players, start the game
            if (allReady && playerCount >= 2) {
              // Lock the game so no more players can join
              game.locked = true

              // Notify all players in the game that the game is starting
              game.playerIds.forEach((_, playerId) => {
                const gameClient = this.clients.find((c) => c.sessionId === playerId)
                if (gameClient) {
                  gameClient.send("game_starting", {
                    gameId: playerGameId,
                    gameType: game.type,
                    players: Array.from(game.playerIds.keys()),
                  })
                }
              })

              // Broadcast that the game is no longer available
              this.broadcast("game_started", {
                gameId: playerGameId,
                gameType: game.type,
              })

              console.log(`Game ${playerGameId} is starting with ${playerCount} players`)
            }
          }
        }
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
