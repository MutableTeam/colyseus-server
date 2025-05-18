// Import from @colyseus/tools as recommended
import { listen } from "@colyseus/tools";

// Import your room handlers
import { LobbyRoom } from "./rooms/LobbyRoom";
import { BattleRoom } from "./rooms/BattleRoom";
import { RaceRoom } from "./rooms/RaceRoom";
import { PlatformerRoom } from "./rooms/PlatformerRoom";

export default listen({
  // Port setting
  port: Number(process.env.PORT || 2567),

  // Define your rooms directly in the rooms object
  // This is the format shown in their documentation
  rooms: {
    lobby: LobbyRoom,
    battle: BattleRoom,
    race: RaceRoom,
    platformer: PlatformerRoom
  },

  // Express app configuration
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

      // Add Colyseus Monitor
      const { monitor } = require("@colyseus/monitor");
      app.use("/colyseus", monitor());
    }
  }
});