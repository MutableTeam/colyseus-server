import config from "@colyseus/tools";
import { monitor } from "@colyseus/monitor";
import { playground } from "@colyseus/playground";
import { LobbyRoom } from "./rooms/LobbyRoom";
import { BattleRoom } from "./rooms/BattleRoom";
import { RaceRoom } from "./rooms/RaceRoom";
import { PlatformerRoom } from "./rooms/PlatformerRoom";

export default config({
  server: {
    // Transport options
    transport: {
      pingInterval: 5000,
      pingMaxRetries: 3,
    }
  },
  
  express: {
    // Express configuration
    middleware: [
      // CORS and JSON middleware will be added automatically
    ],
    
    routes: {
      // Add health check endpoint
      "GET /health": (req, res) => {
        res.json({ status: "ok", uptime: process.uptime() });
      },
      
      // Add Colyseus Monitor
      "use /colyseus": monitor(),
      
      // Add Colyseus Playground (optional, for development)
      ...(process.env.NODE_ENV !== "production" ? {
        "use /playground": playground
      } : {})
    }
  },
  
  gameServer: {
    // Register your room handlers
    rooms: {
      lobby: LobbyRoom,
      battle: BattleRoom,
      race: RaceRoom,
      platformer: PlatformerRoom
    }
  }
});