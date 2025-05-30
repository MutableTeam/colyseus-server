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

    // Handle ready state - FIXED VERSION
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
        let allReady = true
        let readyCount = 0
        let totalPlayers = 0

        this.state.players.forEach((p) => {
          totalPlayers++
          if (p.ready) {
            readyCount++
          } else {
            allReady = false
          }
        })

        console.log(`📊 LobbyRoom: Ready status - ${readyCount}/${totalPlayers} players ready`)

        // Broadcast ready count update
        this.broadcast("lobby_ready_update", {
          readyCount,
          totalPlayers,
          allReady,
          timestamp: Date.now(),
        })

        // If all players are ready, broadcast it
        if (allReady && totalPlayers > 0) {
          console.log(`🎉 LobbyRoom: All ${totalPlayers} players are ready!`)
          this.broadcast("all_players_ready", {
            playerCount: totalPlayers,
            readyCount,
            timestamp: Date.now(),
          })
        }
      } catch (error) {
        console.error(`❌ LobbyRoom: Error handling ready message from ${client.sessionId}:`, error)
        client.send("error", { message: "Failed to process ready state" })
      }
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
      client.send("lobby_state", {
        players: Array.from(this.state.players.entries()).map(([id, player]) => ({
          id,
          name: player.name,
          ready: player.ready,
        })),
        availableGames: Array.from(this.state.availableGames.entries()).map(([id, game]) => ({
          id,
          name: game.name,
          type: game.type,
          currentPlayers: game.currentPlayers,
          maxPlayers: game.maxPlayers,
        })),
        lobbyId: this.roomId,
        metadata: this.metadata,
        timestamp: Date.now(),
      })

      // Send welcome message
      client.send("lobby_welcome", {
        message: `Welcome to ${this.metadata.name}!`,
        playerId: client.sessionId,
        playerName: username,
        timestamp: Date.now(),
      })

      // Broadcast updated player count for discovery
      this.broadcast("player_count_update", {
        count: this.clients.length,
        maxPlayers: this.maxClients,
        timestamp: Date.now(),
      })

      console.log(`📊 LobbyRoom: Now has ${this.clients.length} players`)
    } catch (error) {
      console.error(`❌ LobbyRoom: Error in onJoin for ${client.sessionId}:`, error)
      client.send("error", { message: "Failed to join lobby" })
    }
  }

  onLeave(client: Client, consented: boolean) {
    console.log(`👋 LobbyRoom: Player ${client.sessionId} left the lobby (consented: ${consented})`)

    try {
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
