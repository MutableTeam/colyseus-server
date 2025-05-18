// colyseus.config.ts
import { ServerConfig } from "@colyseus/tools";
import { monitor } from "@colyseus/monitor";
import cors from "cors";
import express from "express";

// Import game rooms
import { LobbyRoom } from "./src/rooms/LobbyRoom";
import { BattleRoom } from "./src/rooms/BattleRoom";
import { RaceRoom } from "./src/rooms/RaceRoom";
import { PlatformerRoom } from "./src/rooms/PlatformerRoom";

export default <ServerConfig>{
  initialize: (gameServer) => {
    // Define rooms
    gameServer.define("lobby", LobbyRoom);
    gameServer.define("battle", BattleRoom);
    gameServer.define("race", RaceRoom);
    gameServer.define("platformer", PlatformerRoom);

    // Optional express setup
    const app = gameServer.express;
    app.use(cors());
    app.use(express.json());

    app.get("/health", (req, res) => {
      res.json({ status: "ok", uptime: process.uptime() });
    });

    app.use("/colyseus", monitor());
  },

  // Optional logger config
  logger: {
    level: "info",
    transports: [{ type: "console" }]
  }
};
