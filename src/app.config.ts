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
  },

  initializeExpress: (app) => {
    // Add health check endpoint
    app.get("/health", (req, res) => {
      res.json({ status: "ok", uptime: process.uptime() })
    })

    // Get all active game lobbies - works without being in a room
    app.get("/api/lobbies", async (req, res) => {
      try {
        const gameType = req.query.gameType as string
        const activeLobbies: any[] = []

        console.log(`API: Getting lobbies for gameType: ${gameType || "all"}`)

        // Import the matchMaker from the correct location in v16
        const { matchMaker } = await import("@colyseus/core")

        // Get all lobby rooms from the matchmaker
        const lobbyRooms = await matchMaker.query({ name: "lobby" })

        console.log(`API: Found ${lobbyRooms.length} lobby rooms`)

        // Process each lobby room
        for (const roomListingData of lobbyRooms) {
          try {
            // Get the actual room instance
            const room = matchMaker.getRoomById(roomListingData.roomId)

            if (room && room.state && room.state.availableGames) {
              console.log(`API: Processing lobby room ${room.roomId} with ${room.state.availableGames.size} games`)

              // Process each game in the lobby
              room.state.availableGames.forEach((game: any, gameId: string) => {
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
                      lobbyRoomId: room.roomId,
                    })
                    console.log(`API: Added lobby: ${game.name}`)
                  }
                }
              })
            } else {
              console.log(`API: No games found in lobby ${roomListingData.roomId}`)
            }
          } catch (roomError: any) {
            console.warn(`API: Error processing lobby room ${roomListingData.roomId}:`, roomError.message)
          }
        }

        console.log(`API: Found ${activeLobbies.length} total active lobbies`)

        // Sort by creation time (newest first)
        activeLobbies.sort((a, b) => b.createdAt - a.createdAt)

        res.json({
          success: true,
          lobbies: activeLobbies,
          gameType: gameType || "all",
          count: activeLobbies.length,
        })
      } catch (error: any) {
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
        const { matchMaker } = await import("@colyseus/core")
        const lobbyRooms: any[] = []

        // Find all lobby rooms using v16 API
        const rooms = await matchMaker.query({ name: "lobby" })

        for (const roomListingData of rooms) {
          try {
            const room = matchMaker.getRoomById(roomListingData.roomId)
            if (room) {
              lobbyRooms.push({
                roomId: room.roomId,
                clients: room.clients.length,
                maxClients: room.maxClients,
                createdAt: room.createdAt,
                gameCount: room.state?.availableGames?.size || 0,
              })
            }
          } catch (roomError: any) {
            console.warn(`API: Error accessing room ${roomListingData.roomId}:`, roomError.message)
          }
        }

        res.json({
          success: true,
          lobbyRooms: lobbyRooms,
          count: lobbyRooms.length,
        })
      } catch (error: any) {
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
    console.log("   GET /api/lobbies - Get all active game lobbies")
    console.log("   GET /api/lobbies?gameType=battle - Get lobbies by type")
    console.log("   GET /api/lobby-rooms - Get lobby room info")
    console.log("   GET /health - Health check")
    console.log("📡 Standard Colyseus endpoints:")
    console.log("   GET /matchmake/lobby - Get available lobby rooms")
    console.log("   POST /matchmake/joinOrCreate/lobby - Join or create lobby")
  },
})
