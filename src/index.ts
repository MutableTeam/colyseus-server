import { listen } from "@colyseus/tools";

// Import game rooms
import { LobbyRoom } from "./rooms/LobbyRoom";
import { BattleRoom } from "./rooms/BattleRoom";
import { RaceRoom } from "./rooms/RaceRoom";
import { PlatformerRoom } from "./rooms/PlatformerRoom";

// Create and export your arena
export default listen({
  port: Number(process.env.PORT || 2567),
  
  // Define your room handlers
  rooms: {
    lobby: LobbyRoom,
    battle: BattleRoom,
    race: RaceRoom,
    platformer: PlatformerRoom
  },
  
  // Optional settings
  options: {
    pingInterval: 5000,
    pingMaxRetries: 3,
  },
  
  // Optional express configuration
  express: {
    // Express middleware can be configured here
    beforeListen: (app) => {
      // Add CORS and JSON middleware
      const cors = require("cors");
      app.use(cors());
      app.use(require("express").json());
      
      // Add health check endpoint
      app.get("/health", (req, res) => {
        res.json({ status: "ok", uptime: process.uptime() });
      });
    }
  }
});
