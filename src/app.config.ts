import config from "@colyseus/tools"
import { monitor } from "@colyseus/monitor"
import { WebSocketTransport } from "@colyseus/ws-transport"
import { HubRoom } from "./rooms/HubRoom"
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
    // Register the hub room first - this is the main entry point
    gameServer.define("hub", HubRoom)

    // Register game-specific rooms
    gameServer.define("lobby", LobbyRoom)
    gameServer.define("battle", BattleRoom)
    gameServer.define("race", RaceRoom)
    gameServer.define("platformer", PlatformerRoom)

    // Create a persistent hub room on server start
    gameServer.onShutdown(() => {
      console.log("🛑 Game server shutting down...")
    })
  },

  initializeExpress: (app) => {
    // Add health check endpoint
    app.get("/health", (req, res) => {
      res.json({
        status: "ok",
        uptime: process.uptime(),
        timestamp: Date.now(),
        hubAvailable: true,
      })
    })

    // Get hub room status
    app.get("/api/hub", async (req, res) => {
      try {
        res.json({
          success: true,
          hubStatus: "online",
          message: "Hub room is available",
          timestamp: Date.now(),
        })
      } catch (error: any) {
        console.error("API: Error getting hub status:", error)
        res.status(500).json({
          success: false,
          error: error.message,
          hubStatus: "error",
        })
      }
    })

    // Add API endpoint to get available rooms
    app.get("/api/rooms", (req, res) => {
      try {
        const rooms: any[] = []

        // Access the matchmaker from the app locals
        const matchMaker = (app as any).locals?.matchMaker

        if (matchMaker && matchMaker.rooms) {
          for (const [roomId, room] of matchMaker.rooms) {
            // Only include rooms that are joinable
            if (!room.locked && room.clients.size < room.maxClients) {
              rooms.push({
                roomId: roomId,
                name: room.roomName,
                type: room.roomName,
                clients: room.clients.size,
                maxClients: room.maxClients,
                locked: room.locked || false,
                private: room.private || false,
                createdAt: room.createdAt || new Date().toISOString(),
                metadata: room.metadata || {},
              })
            }
          }
        }

        console.log(`📊 API: Found ${rooms.length} available rooms`)
        res.json(rooms)
      } catch (error: any) {
        console.error("❌ API: Error getting rooms:", error)
        res.status(500).json({ error: "Failed to get rooms" })
      }
    })

    // Store matchmaker reference for API access
    app.use((req, res, next) => {
      if (!app.locals.matchMaker && (global as any).matchMaker) {
        app.locals.matchMaker = (global as any).matchMaker
      }
      next()
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
    console.log("🏠 Hub room will be the main entry point for all players")
    console.log("📡 API endpoints available:")
    console.log("   GET /api/hub - Get hub status")
    console.log("   GET /api/rooms - Get available rooms")
    console.log("   GET /health - Health check")
    console.log("📡 Standard Colyseus endpoints:")
    console.log("   GET /matchmake/hub - Get available hub rooms")
    console.log("   POST /matchmake/joinOrCreate/hub - Join the main hub")
    console.log("   POST /matchmake/joinOrCreate/lobby - Join game lobbies")
  },
})
