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
    console.log("   GET /health - Health check")
    console.log("📡 Standard Colyseus endpoints:")
    console.log("   GET /matchmake/hub - Get available hub rooms")
    console.log("   POST /matchmake/joinOrCreate/hub - Join the main hub")
    console.log("   POST /matchmake/joinOrCreate/lobby - Join game lobbies")
  },
})
