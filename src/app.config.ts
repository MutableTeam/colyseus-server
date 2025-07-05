import config from "@colyseus/tools"
import { monitor } from "@colyseus/monitor"
import { playground } from "@colyseus/playground"

// Import your custom room files
import { HubRoom } from "./rooms/HubRoom"
import { CustomLobbyRoom } from "./rooms/CustomLobbyRoom"
import { BattleRoom } from "./rooms/BattleRoom"
import { PlatformerRoom } from "./rooms/PlatformerRoom"
import { RaceRoom } from "./rooms/RaceRoom"

export default config({
  initializeGameServer: (gameServer) => {
    console.log("🚀 Initializing Game Server...")

    // Define all room types with real-time listing enabled
    gameServer.define("hub", HubRoom).enableRealtimeListing()

    gameServer.define("custom_lobby", CustomLobbyRoom).enableRealtimeListing()

    gameServer.define("battle", BattleRoom).enableRealtimeListing()

    gameServer.define("platformer", PlatformerRoom).enableRealtimeListing()

    gameServer.define("race", RaceRoom).enableRealtimeListing()

    console.log("✅ All room types registered with real-time listing enabled")
  },

  initializeExpress: (app) => {
    console.log("🌐 Initializing Express server...")

    // Basic health check endpoint
    app.get("/health", (req, res) => {
      res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      })
    })

    // Custom lobbies API endpoint
    app.get("/api/lobbies", async (req, res) => {
      try {
        console.log("📡 API: Fetching custom lobbies...")

        // This would typically query your matchmaker for custom lobby rooms
        // For now, return a basic response
        const lobbies = []

        res.json({
          success: true,
          lobbies: lobbies,
          timestamp: Date.now(),
        })
      } catch (error: any) {
        console.error("❌ API: Error fetching lobbies:", error)
        res.status(500).json({
          success: false,
          error: error.message,
          timestamp: Date.now(),
        })
      }
    })

    // Development tools
    if (process.env.NODE_ENV !== "production") {
      app.use("/colyseus", monitor())
      app.use("/playground", playground)
      console.log("🛠️ Development tools enabled: /colyseus and /playground")
    }

    console.log("✅ Express server configured")
  },

  beforeListen: () => {
    console.log("🎯 Server starting...")
    console.log("📋 Available room types:")
    console.log("  - hub: Main hub for player connections")
    console.log("  - custom_lobby: Custom lobby rooms with ready system")
    console.log("  - battle: Battle/combat rooms")
    console.log("  - platformer: Platformer game rooms")
    console.log("  - race: Racing game rooms")
    console.log("🔄 All rooms have real-time listing enabled")
  },
})
