import config from "@colyseus/tools"
import { monitor } from "@colyseus/monitor"
import { WebSocketTransport } from "@colyseus/ws-transport"
import { matchMaker } from "@colyseus/core"
import { HubRoom } from "./rooms/HubRoom"
import { BattleRoom } from "./rooms/BattleRoom"
import { RaceRoom } from "./rooms/RaceRoom"
import { PlatformerRoom } from "./rooms/PlatformerRoom"
import { CustomLobbyRoom } from "./rooms/CustomLobbyRoom"

export default config({
  initializeTransport: (options) =>
    new WebSocketTransport({
      ...options,
      pingInterval: 5000,
      pingMaxRetries: 3,
    }),

  initializeGameServer: (gameServer) => {
    // Register the hub room first - this is the main entry point
    // Explicitly set maxClients to ensure it's not overridden
    gameServer.define("hub", HubRoom, {
      maxClients: 200,
    })

    // Register the custom lobby room for readiness system
    gameServer.define("lobby", CustomLobbyRoom, {
      maxClients: 50,
    })

    // Register game-specific rooms with real-time listing enabled
    gameServer
      .define("battle", BattleRoom, {
        maxClients: 16,
      })
      .enableRealtimeListing()

    gameServer
      .define("race", RaceRoom, {
        maxClients: 8,
      })
      .enableRealtimeListing()

    gameServer
      .define("platformer", PlatformerRoom, {
        maxClients: 4,
      })
      .enableRealtimeListing()

    gameServer.onShutdown(() => {
      console.log("🛑 Game server shutting down...")
    })

    console.log("🎮 Game server initialized with room definitions")
    console.log("🏠 Hub room: maxClients = 200")
    console.log("🏛️ Lobby room: maxClients = 50")
    console.log("⚔️ Battle room: maxClients = 16")
    console.log("🏁 Race room: maxClients = 8")
    console.log("🎮 Platformer room: maxClients = 4")
    console.log("🔄 Real-time listing enabled for game rooms")
  },

  initializeExpress: (app) => {
    // Health check endpoint
    app.get("/health", (req, res) => {
      res.json({
        status: "ok",
        uptime: process.uptime(),
        timestamp: Date.now(),
        hubAvailable: true,
      })
    })

    // Get hub room status
    app.get("/api/hub", async (req, res) => {
      try {
        res.json({
          success: true,
          hubStatus: "online",
          message: "Hub room is available",
          timestamp: Date.now(),
        })
      } catch (error: any) {
        console.error("API: Error getting hub status:", error)
        res.status(500).json({
          success: false,
          error: error.message,
          hubStatus: "error",
        })
      }
    })

    // Get available rooms using official Colyseus matchMaker API
    app.get("/api/rooms", async (req, res) => {
      try {
        const gameTypeFilter = req.query.gameType as string
        console.log("🔍 API: Searching for rooms using matchMaker.query()")
        console.log("🔍 API: Requested game type filter:", gameTypeFilter || "all")

        let rooms: any[] = []

        if (gameTypeFilter) {
          // Query for specific room type
          console.log(`🔍 API: Querying for rooms with name: ${gameTypeFilter}`)
          rooms = await matchMaker.query({ name: gameTypeFilter })
        } else {
          // Query for all supported room types
          const roomTypes = ["hub", "lobby", "battle", "race", "platformer"]
          const allRoomQueries = roomTypes.map(async (roomType) => {
            try {
              const roomsOfType = await matchMaker.query({ name: roomType })
              return roomsOfType
            } catch (error) {
              console.log(`No rooms found for type: ${roomType}`)
              return []
            }
          })

          const roomResults = await Promise.all(allRoomQueries)
          rooms = roomResults.flat()
        }

        console.log(`📊 API: matchMaker.query() returned ${rooms.length} rooms`)

        // Transform and filter results
        const formattedRooms = rooms
          .filter((room) => {
            // Only include rooms that are joinable (not locked and not full)
            const isJoinable = !room.locked && room.clients < room.maxClients
            console.log(
              `🔍 API: Room ${room.roomId} (${room.name}) - locked: ${room.locked}, clients: ${room.clients}/${room.maxClients}, joinable: ${isJoinable}`,
            )
            return isJoinable
          })
          .map((room: any) => ({
            roomId: room.roomId,
            name: room.metadata?.name || `${room.name}_${room.roomId.substring(0, 8)}`,
            type: room.name,
            clients: room.clients || 0,
            maxClients: room.maxClients || 50,
            locked: room.locked || false,
            private: room.private || false,
            createdAt: room.createdAt || Date.now(),
            metadata: room.metadata || {},
          }))

        console.log(`📊 API: Returning ${formattedRooms.length} joinable rooms`)

        formattedRooms.forEach((room, index) => {
          console.log(
            `📋 API Room ${index + 1}: ${room.name} (${room.type}) - ${room.clients}/${room.maxClients} players - ID: ${room.roomId}`,
          )
        })

        res.json(formattedRooms)
      } catch (error: any) {
        console.error("❌ API: Error in /api/rooms endpoint:", error)
        res.status(500).json({
          error: "Failed to get rooms",
          details: error.message,
          rooms: [],
        })
      }
    })

    // Debug endpoint using official matchMaker API
    app.get("/api/debug", async (req, res) => {
      try {
        const debug: any = {
          matchMakerExists: !!matchMaker,
          timestamp: Date.now(),
        }

        // Get matchMaker stats
        try {
          if (matchMaker.stats) {
            debug.localStats = {
              ccu: matchMaker.stats.local.ccu,
              roomCount: matchMaker.stats.local.roomCount,
            }

            try {
              const globalStats = await matchMaker.stats.fetchAll()
              debug.globalStats = globalStats
            } catch (globalError: any) {
              debug.globalStatsError = globalError.message
            }
          }
        } catch (statsError: any) {
          debug.statsError = statsError.message
        }

        // Test matchMaker.query for each room type
        const roomTypes = ["hub", "lobby", "battle", "race", "platformer"]
        debug.roomQueries = {}

        for (const roomType of roomTypes) {
          try {
            const rooms = await matchMaker.query({ name: roomType })
            debug.roomQueries[roomType] = {
              count: rooms.length,
              rooms: rooms.map((r: any) => ({
                id: r.roomId,
                name: r.name,
                clients: r.clients,
                maxClients: r.maxClients,
                locked: r.locked,
              })),
            }
          } catch (queryError: any) {
            debug.roomQueries[roomType] = {
              error: queryError.message,
              count: 0,
              rooms: [],
            }
          }
        }

        res.json(debug)
      } catch (error: any) {
        res.status(500).json({
          error: "Debug failed",
          details: error.message,
        })
      }
    })

    // Test specific matchMaker methods
    app.get("/api/matchmaker-test", async (req, res) => {
      try {
        const results: any = {
          timestamp: Date.now(),
          tests: {},
        }

        // Test 1: Query all rooms
        try {
          const allRooms = await matchMaker.query({})
          results.tests.queryAll = {
            success: true,
            count: allRooms.length,
            rooms: allRooms.map((r: any) => ({ id: r.roomId, name: r.name, clients: r.clients })),
          }
        } catch (error: any) {
          results.tests.queryAll = { success: false, error: error.message }
        }

        // Test 2: Query hub rooms specifically
        try {
          const hubRooms = await matchMaker.query({ name: "hub" })
          results.tests.queryHub = {
            success: true,
            count: hubRooms.length,
            rooms: hubRooms.map((r: any) => ({
              id: r.roomId,
              name: r.name,
              clients: r.clients,
              maxClients: r.maxClients,
              locked: r.locked,
            })),
          }
        } catch (error: any) {
          results.tests.queryHub = { success: false, error: error.message }
        }

        // Test 3: Find one available hub room
        try {
          const availableRoom = await matchMaker.findOneRoomAvailable("hub", {})
          results.tests.findOneAvailable = {
            success: true,
            room: availableRoom
              ? {
                  id: availableRoom.roomId,
                  name: availableRoom.name,
                  clients: availableRoom.clients,
                  maxClients: availableRoom.maxClients,
                  locked: availableRoom.locked,
                }
              : null,
          }
        } catch (error: any) {
          results.tests.findOneAvailable = { success: false, error: error.message }
        }

        // Test 4: Get global CCU
        try {
          const globalCCU = await matchMaker.stats.getGlobalCCU()
          results.tests.globalCCU = {
            success: true,
            ccu: globalCCU,
          }
        } catch (error: any) {
          results.tests.globalCCU = { success: false, error: error.message }
        }

        res.json(results)
      } catch (error: any) {
        res.status(500).json({
          error: "MatchMaker test failed",
          details: error.message,
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
    console.log("🏠 Hub room will be the main entry point for all players (maxClients: 200)")
    console.log("🏛️ Using built-in LobbyRoom for automatic room discovery (maxClients: 50)")
    console.log("📡 API endpoints available:")
    console.log("   GET /api/hub - Get hub status")
    console.log("   GET /api/rooms - Get available rooms (using matchMaker.query)")
    console.log("   GET /api/debug - Debug server state and test matchMaker")
    console.log("   GET /api/matchmaker-test - Test specific matchMaker methods")
    console.log("   GET /health - Health check")
    console.log("📡 Standard Colyseus endpoints:")
    console.log("   GET /matchmake/hub - Get available hub rooms")
    console.log("   POST /matchmake/joinOrCreate/hub - Join the main hub")
    console.log("   POST /matchmake/joinOrCreate/lobby - Join the built-in lobby for room discovery")
  },
})
