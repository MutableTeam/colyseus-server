import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { monitor } from "@colyseus/monitor";
import cors from "cors";
import express from "express";

// Import game rooms
import { LobbyRoom } from "./rooms/LobbyRoom";
import { BattleRoom } from "./rooms/BattleRoom";
import { RaceRoom } from "./rooms/RaceRoom";
import { PlatformerRoom } from "./rooms/PlatformerRoom";

// Define your app configuration
export default {
  // Port to listen on
  port: Number(process.env.PORT || 2567),

  // When using @colyseus/tools, we need to define the server creation function
  initializeGameServer: (app) => {
    // Create the Colyseus server with WebSocketTransport
    const server = new Server({
      transport: new WebSocketTransport({
        pingInterval: 5000,
        pingMaxRetries: 3,
      }),
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
    app.use(cors());
    app.use(express.json());
    
    // Add health check endpoint
    app.get("/health", (req, res) => {
      res.json({ status: "ok", uptime: process.uptime() });
    });

    // Add Colyseus Monitor
    app.use("/colyseus", monitor());
  }
};