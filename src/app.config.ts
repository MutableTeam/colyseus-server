import config from "@colyseus/tools"
import { monitor } from "@colyseus/monitor"
import { WebSocketTransport } from "@colyseus/ws-transport"
import { LobbyRoom } from "./rooms/LobbyRoom"
import { BattleRoom } from "./rooms/BattleRoom"
import { RaceRoom } from "./rooms/RaceRoom"
import { PlatformerRoom } from "./rooms/PlatformerRoom"
import type { Server } from "@colyseus/core"

let gameServerInstance: Server

export default config({
  initializeTransport: (options) =>
    new WebSocketTransport({
      ...options,
      pingInterval: 5000,
      pingMaxRetries: 3,
    }),

  initializeGameServer: (gameServer) => {
    // Store the game server instance
    gameServerInstance = gameServer

    // Register your room handlers
    gameServer.define("lobby", LobbyRoom)
    gameServer.define("battle", BattleRoom)
    gameServer.define("race", RaceRoom)
    gameServer.define("platformer", PlatformerRoom)
  },

  initializeExpress: (app) => {
    // Add health check endpoint
    app.get("/health", (req, res) => {
      res.json({ status: "ok", uptime: process.uptime() })
    })

    // Get all active lobbies - works without being in a room
    app.get("/lobbies", async (req, res) => {
      try {
        const gameType = req.query.gameType as string
        const activeLobbies: any[] = []

        if (!gameServerInstance) {
          return res.status(503).json({
            success: false,
            error: "Game server not initialized",
            lobbies: [],
          })
        }

        console.log(`API: Getting lobbies, total rooms: ${gameServerInstance.rooms.size}`)

        // Iterate through all rooms to find lobby rooms
        for (const [roomId, room] of gameServerInstance.rooms) {
          if (room.roomName === "lobby" && room.state) {
            console.log(`API: Processing lobby room ${roomId}`)

            try {
              const lobbyState = room.state as any

              if (lobbyState.availableGames && lobbyState.availableGames.size > 0) {
                console.log(`API: Found ${lobbyState.availableGames.size} games in lobby ${roomId}`)

                // Process each game in the lobby
                for (const [gameId, game] of lobbyState.availableGames) {
                  console.log(`API: Processing game ${gameId}: ${game.name} (${game.type})`)

                  // Only include games that aren't locked and have space
                  if (!game.locked && game.currentPlayers < game.maxPlayers) {
                    // Filter by game type if specified
                    if (!gameType || game.type === gameType) {
                      activeLobbies.push({
                        id: game.id,
                        name: game.name,
                        type: game.type,
                        currentPlayers: game.currentPlayers,
                        maxPlayers: game.maxPlayers,
                        creatorId: game.creatorId,
                        createdAt: game.createdAt,
                        lobbyRoomId: roomId,
                      })
                      console.log(`API: Added lobby: ${game.name}`)
                    }
                  }
                }
              } else {
                console.log(`API: No games found in lobby ${roomId}`)
              }
            } catch (roomError: any) {
              console.warn(`API: Error processing lobby room ${roomId}:`, roomError.message)
            }
          }
        }

        console.log(`API: Found ${activeLobbies.length} total active lobbies`)

        // Sort by creation time (newest first)
        activeLobbies.sort((a, b) => b.createdAt - a.createdAt)

        res.json({
          success: true,
          lobbies: activeLobbies,
          gameType: gameType || "all",
          count: activeLobbies.length,
        })
      } catch (error: any) {
        console.error("API: Error getting lobbies:", error)
        res.status(500).json({
          success: false,
          error: error.message,
          lobbies: [],
        })
      }
    })

    // Get lobby room information (for debugging)
    app.get("/lobby-rooms", async (req, res) => {
      try {
        if (!gameServerInstance) {
          return res.status(503).json({
            success: false,
            error: "Game server not initialized",
            lobbyRooms: [],
          })
        }

        const lobbyRooms: any[] = []

        // Find all lobby rooms
        for (const [roomId, room] of gameServerInstance.rooms) {
          if (room.roomName === "lobby") {
            lobbyRooms.push({
              roomId: roomId,
              clients: room.clients.length,
              maxClients: room.maxClients,
              createdAt: room.createdAt,
              gameCount: room.state?.availableGames?.size || 0,
            })
          }
        }

        res.json({
          success: true,
          lobbyRooms: lobbyRooms,
          count: lobbyRooms.length,
        })
      } catch (error: any) {
        console.error("API: Error getting lobby rooms:", error)
        res.status(500).json({
          success: false,
          error: error.message,
          lobbyRooms: [],
        })
      }
    })

    // Add Colyseus Monitor
    app.use("/colyseus", monitor())

    // Add Colyseus Playground only in development
    if (process.env.NODE_ENV !== "production") {
      try {
        const { playground } = require("@colyseus/playground")
        app.use("/playground", playground())
      } catch (e) {
        console.log("Playground not available in this environment")
      }
    }
  },

  beforeListen: () => {
    console.log("🎮 Colyseus server starting...")
    console.log("📡 API endpoints available:")
    console.log("   GET /lobbies - Get all active lobbies")
    console.log("   GET /lobbies?gameType=battle - Get lobbies by type")
    console.log("   GET /lobby-rooms - Get lobby room info")
    console.log("   GET /health - Health check")
  },
})
