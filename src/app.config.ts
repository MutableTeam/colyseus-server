import config from "@colyseus/tools";
import { monitor } from "@colyseus/monitor";
import { playground } from "@colyseus/playground";
import cors from "cors";
import express from "express";

// Import game rooms
import { LobbyRoom } from "./rooms/LobbyRoom";
import { BattleRoom } from "./rooms/BattleRoom";
import { RaceRoom } from "./rooms/RaceRoom";
import { PlatformerRoom } from "./rooms/PlatformerRoom";

export default config({
  id: "colyseus-server",
  
  options: {
    // Port to listen on
    port: Number(process.env.PORT || 2567),
  },

  initializeGameServer: (gameServer) => {
    // Register your room handlers
    gameServer.define("lobby", LobbyRoom);
    gameServer.define("battle", BattleRoom);
    gameServer.define("race", RaceRoom);
    gameServer.define("platformer", PlatformerRoom);
  },

  initializeExpress: (app) => {
    app.use(cors());
    app.use(express.json());
    
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