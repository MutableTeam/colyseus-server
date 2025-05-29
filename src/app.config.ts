import config from "@colyseus/tools"
import { monitor } from "@colyseus/monitor"
import { WebSocketTransport } from "@colyseus/ws-transport"
import { LobbyRoom } from "./rooms/LobbyRoom"
import { BattleRoom } from "./rooms/BattleRoom"
import { RaceRoom } from "./rooms/RaceRoom"
import { PlatformerRoom } from "./rooms/PlatformerRoom"

export default config({
  initializeTransport: (options) =>
    new WebSocketTransport({
      ...options,
      pingInterval: 5000,
      pingMaxRetries: 3,
    }),

  initializeGameServer: (gameServer) => {
    // Register your room handlers
    gameServer.define("lobby", LobbyRoom)
    gameServer.define("battle", BattleRoom)
    gameServer.define("race", RaceRoom)
    gameServer.define("platformer", PlatformerRoom)

    // Store game server reference globally for API access
    global.gameServer = gameServer
  },

  initializeExpress: (app) => {
    // Add health check endpoint
    app.get("/health", (req, res) => {
      res.json({ status: "ok", uptime: process.uptime() })
    })

    // Get all active lobbies
    app.get("/api/lobbies", async (req, res) => {
      try {
        const gameType = req.query.gameType as string
        const activeLobbies: any[] = []

        // Access the global game server instance
        const gameServer = global.gameServer

        if (!gameServer) {
          return res.status(503).json({
            success: false,
            error: "Game server not initialized",
            lobbies: [],
          })
        }

        console.log(`API: Getting lobbies, total rooms: ${gameServer.rooms.size}`)

        // Iterate through all rooms to find lobby rooms
        gameServer.rooms.forEach((room, roomId) => {
          if (room.roomName === "lobby" && room.state) {
            console.log(`API: Processing lobby room ${roomId}`)

            try {
              const lobbyState = room.state

              if (lobbyState.availableGames && lobbyState.availableGames.size > 0) {
                console.log(`API: Found ${lobbyState.availableGames.size} games in lobby ${roomId}`)

                // Process each game in the lobby
                lobbyState.availableGames.forEach((game, gameId) => {
                  console.log(`API: Processing game ${gameId}: ${game.name} (${game.type})`)

                  // Only include games that aren't locked and have space
                  if (!game.locked && game.currentPlayers < game.maxPlayers) {
                    // Filter by game type if specified
                    if (!gameType || game.type === gameType) {
                      activeLobbies.push({
                        id: game.id,
                        name: game.name,
                        type: game.type,
                        currentPlayers: game.currentPlayers,
                        maxPlayers: game.maxPlayers,
                        creatorId: game.creatorId,
                        createdAt: game.createdAt,
                        lobbyRoomId: roomId,
                      })
                      console.log(`API: Added lobby: ${game.name}`)
                    }
                  }
                })
              } else {
                console.log(`API: No games found in lobby ${roomId}`)
              }
            } catch (roomError) {
              console.warn(`API: Error processing lobby room ${roomId}:`, roomError.message)
            }
          }
        })

        console.log(`API: Found ${activeLobbies.length} total active lobbies`)

        // Sort by creation time (newest first)
        activeLobbies.sort((a, b) => b.createdAt - a.createdAt)

        res.json({
          success: true,
          lobbies: activeLobbies,
          gameType: gameType || "all",
          count: activeLobbies.length,
        })
      } catch (error) {
        console.error("API: Error getting lobbies:", error)
        res.status(500).json({
          success: false,
          error: error.message,
          lobbies: [],
        })
      }
    })

    // Get lobby room information (for debugging)
    app.get("/api/lobby-rooms", async (req, res) => {
      try {
        const gameServer = global.gameServer

        if (!gameServer) {
          return res.status(503).json({
            success: false,
            error: "Game server not initialized",
            lobbyRooms: [],
          })
        }

        const lobbyRooms: any[] = []

        // Find all lobby rooms
        gameServer.rooms.forEach((room, roomId) => {
          if (room.roomName === "lobby") {
            lobbyRooms.push({
              roomId: roomId,
              clients: room.clients.length,
              maxClients: room.maxClients,
              createdAt: room.createdAt,
              gameCount: room.state?.availableGames?.size || 0,
            })
          }
        })

        res.json({
          success: true,
          lobbyRooms: lobbyRooms,
          count: lobbyRooms.length,
        })
      } catch (error) {
        console.error("API: Error getting lobby rooms:", error)
        res.status(500).json({
          success: false,
          error: error.message,
          lobbyRooms: [],
        })
      }
    })

    // Add Colyseus Monitor
    app.use("/colyseus", monitor())

    // Add Colyseus Playground only in development
    if (process.env.NODE_ENV !== "production") {
      try {
        const { playground } = require("@colyseus/playground")
        app.use("/playground", playground())
      } catch (e) {
        console.log("Playground not available in this environment")
      }
    }
  },

  beforeListen: () => {
    console.log("🎮 Colyseus server starting...")
    console.log("📡 API endpoints available:")
    console.log("   GET /api/lobbies - Get all active lobbies")
    console.log("   GET /api/lobbies?gameType=battle - Get lobbies by type")
    console.log("   GET /api/lobby-rooms - Get lobby room info")
    console.log("   GET /health - Health check")
  },
})
