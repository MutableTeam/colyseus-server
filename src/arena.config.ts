// src/arena.config.ts
import { monitor } from "@colyseus/monitor";
import { playground } from "@colyseus/playground";
import { LobbyRoom } from "./rooms/LobbyRoom";
import { BattleRoom } from "./rooms/BattleRoom";
import { RaceRoom } from "./rooms/RaceRoom";
import { PlatformerRoom } from "./rooms/PlatformerRoom";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "colyseus";

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
  
  // Add Colyseus Playground (optional, for development)
  if (process.env.NODE_ENV !== "production") {
    app.use("/playground", playground);
  }
  
  const server = createServer(app);
  
  const gameServer = new Server({
    transport: {
      pingInterval: 5000,
      pingMaxRetries: 3,
    }
  });
  
  // Attach WebSocket server to HTTP server
  gameServer.attach({ server });
  
  // Register your room handlers
  gameServer.define("lobby", LobbyRoom);
  gameServer.define("battle", BattleRoom);
  gameServer.define("race", RaceRoom);
  gameServer.define("platformer", PlatformerRoom);
  
  gameServer.listen(port);
  
  console.log(`Listening on port ${port}`);
  
  return gameServer;
}// src/arena.config.ts
import { monitor } from "@colyseus/monitor";
import { playground } from "@colyseus/playground";
import { LobbyRoom } from "./rooms/LobbyRoom";
import { BattleRoom } from "./rooms/BattleRoom";
import { RaceRoom } from "./rooms/RaceRoom";
import { PlatformerRoom } from "./rooms/PlatformerRoom";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "colyseus";

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
  
  // Add Colyseus Playground (optional, for development)
  if (process.env.NODE_ENV !== "production") {
    app.use("/playground", playground);
  }
  
  const server = createServer(app);
  
  const gameServer = new Server({
    transport: {
      pingInterval: 5000,
      pingMaxRetries: 3,
    }
  });
  
  // Attach WebSocket server to HTTP server
  gameServer.attach({ server });
  
  // Register your room handlers
  gameServer.define("lobby", LobbyRoom);
  gameServer.define("battle", BattleRoom);
  gameServer.define("race", RaceRoom);
  gameServer.define("platformer", PlatformerRoom);
  
  gameServer.listen(port);
  
  console.log(`Listening on port ${port}`);
  
  return gameServer;
}