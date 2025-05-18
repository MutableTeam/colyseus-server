import { listen } from "@colyseus/tools";
import { Server } from "@colyseus/core";

// Import game rooms
import { LobbyRoom } from "./rooms/LobbyRoom";
import { BattleRoom } from "./rooms/BattleRoom";
import { RaceRoom } from "./rooms/RaceRoom";
import { PlatformerRoom } from "./rooms/PlatformerRoom";

// Create and export your arena
export default listen({
  // When using @colyseus/tools, we need to define the server creation function
  initializeGameServer: (app) => {
    const server = new Server({
      pingInterval: 5000,
      pingMaxRetries: 3,
    });

    // Register your room handlers
    server.define("lobby", LobbyRoom);
    server.define("battle", BattleRoom);
    server.define("race", RaceRoom);
    server.define("platformer", PlatformerRoom);

    return server;
  },

  // Optional express configuration
  initializeExpress: (app) => {
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
  },

  // Port to listen on
  port: Number(process.env.PORT || 2567)
});