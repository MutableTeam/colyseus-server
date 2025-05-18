import config from "@colyseus/tools";
import { monitor } from "@colyseus/monitor";
import { playground } from "@colyseus/playground";

// Import game rooms
import { LobbyRoom } from "./rooms/LobbyRoom";
import { BattleRoom } from "./rooms/BattleRoom";
import { RaceRoom } from "./rooms/RaceRoom";
import { PlatformerRoom } from "./rooms/PlatformerRoom";

export default config({
  id: "colyseus-server",
  
  // In v0.16, port is a top-level property, not inside options
  port: Number(process.env.PORT || 2567),
  
  initializeGameServer: (gameServer) => {
    // Register your room handlers
    gameServer.define("lobby", LobbyRoom);
    gameServer.define("battle", BattleRoom);
    gameServer.define("race", RaceRoom);
    gameServer.define("platformer", PlatformerRoom);
  },

  initializeExpress: (app) => {
    // Add health check endpoint
    app.get("/health", (req, res) => {
      res.json({ status: "ok", uptime: process.uptime() });
    });

    // Add Colyseus Monitor
    app.use("/colyseus", monitor());
    
    // Add Colyseus Playground (optional, for development)
    if (process.env.NODE_ENV !== "production") {
      app.use("/playground", playground);
    }
  }
});