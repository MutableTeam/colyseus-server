// src/arena.config.ts
import { monitor } from "@colyseus/monitor";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { RedisPresence } from "@colyseus/redis-presence";
import { RedisDriver } from "@colyseus/redis-driver";
import { LobbyRoom } from "./rooms/LobbyRoom";
import { BattleRoom } from "./rooms/BattleRoom";
import { RaceRoom } from "./rooms/RaceRoom";
import { PlatformerRoom } from "./rooms/PlatformerRoom";

const port = Number(process.env.PORT || 2567);

export default function() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  
  // Add health check endpoint
  app.get("/health", (req, res) => {
    res.json({ status: "ok", uptime: process.uptime() });
  });
  
  // Add Colyseus Monitor
  app.use("/colyseus", monitor());
  
  // Add Colyseus Playground only in development
  if (process.env.NODE_ENV !== "production") {
    try {
      const { playground } = require("@colyseus/playground");
      app.use("/playground", playground);
    } catch (e) {
      console.log("Playground not available in this environment");
    }
  }
  
  const server = createServer(app);
  
  // Create Colyseus server with Redis components
  // Redis connection details are automatically provided by Colyseus Cloud
  const gameServer = new Server({
    transport: new WebSocketTransport({
      server,
      pingInterval: 5000,
      pingMaxRetries: 3,
    }),
    presence: new RedisPresence(),
    driver: new RedisDriver()
  });
  
  // Register your room handlers
  gameServer.define("lobby", LobbyRoom);
  gameServer.define("battle", BattleRoom);
  gameServer.define("race", RaceRoom);
  gameServer.define("platformer", PlatformerRoom);
  
  gameServer.listen(port);
  
  console.log(`Listening on port ${port}`);
  
  return gameServer;
}