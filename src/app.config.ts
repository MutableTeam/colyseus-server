import { Server } from "@colyseus/core"
import { createServer } from "http"
import { WebSocketTransport } from "@colyseus/ws-transport"
import { monitor } from "@colyseus/monitor"
import { playground } from "@colyseus/playground"
import express from "express"
import cors from "cors"

// Import custom rooms
import { HubRoom } from "./rooms/HubRoom"
import { CustomLobbyRoom } from "./rooms/CustomLobbyRoom"
import { BattleRoom } from "./rooms/BattleRoom"
import { RaceRoom } from "./rooms/RaceRoom"
import { PlatformerRoom } from "./rooms/PlatformerRoom"

const port = Number(process.env.PORT || 2567)
const app = express()

// Enable CORS for all routes
app.use(cors())
app.use(express.json())

// Create HTTP server
const server = createServer(app)

// Create game server with WebSocket transport
const gameServer = new Server({
  transport: new WebSocketTransport({
    server: server,
    pingInterval: 30000,
    pingMaxRetries: 3,
  }),
  presence: undefined, // Use default local presence for simplicity
})

// Register room handlers with detailed logging
console.log("🔧 Registering room handlers...")

try {
  // Register Hub Room for player discovery
  gameServer.define("hub", HubRoom).filterBy(["region"])
  console.log("✅ Registered HubRoom as 'hub'")

  // Register Custom Lobby Room (renamed to avoid conflict with built-in LobbyRoom)
  gameServer.define("lobby", CustomLobbyRoom).filterBy(["region"])
  console.log("✅ Registered CustomLobbyRoom as 'lobby'")

  // Register Battle Room for Three.js multiplayer battles
  gameServer.define("battle", BattleRoom).filterBy(["gameMode", "mapTheme"])
  console.log("✅ Registered BattleRoom as 'battle'")

  // Register Race Room
  gameServer.define("race", RaceRoom).filterBy(["trackType", "difficulty"])
  console.log("✅ Registered RaceRoom as 'race'")

  // Register Platformer Room
  gameServer.define("platformer", PlatformerRoom).filterBy(["levelType", "difficulty"])
  console.log("✅ Registered PlatformerRoom as 'platformer'")

  console.log("🎮 All rooms registered successfully!")
} catch (error) {
  console.error("❌ Error registering rooms:", error)
  process.exit(1)
}

// API Routes for testing and room discovery
app.get("/", (req, res) => {
  res.send(`
    <h1>🎮 Colyseus Battle Server</h1>
    <p>Server is running with Three.js battle support!</p>
    <ul>
      <li><a href="/api/rooms">Available Rooms</a></li>
      <li><a href="/api/matchmaker-test">Matchmaker Test</a></li>
      <li><a href="/colyseus">Monitor</a></li>
      <li><a href="/playground">Playground</a></li>
    </ul>
  `)
})

// Get available rooms
app.get("/api/rooms", async (req, res) => {
  try {
    const rooms = await gameServer.matchMaker.query({})
    console.log(`📊 API: Found ${rooms.length} available rooms`)

    const roomsData = rooms.map((room) => ({
      roomId: room.roomId,
      name: room.metadata?.name || `${room.name} Room`,
      type: room.name,
      clients: room.clients,
      maxClients: room.maxClients,
      metadata: room.metadata,
    }))

    res.json(roomsData)
  } catch (error) {
    console.error("❌ API: Error querying rooms:", error)
    res.status(500).json({ error: "Failed to get rooms" })
  }
})

// Matchmaker testing endpoint
app.get("/api/matchmaker-test", async (req, res) => {
  const tests = {
    queryAll: { success: false, count: 0, error: null },
    queryLobby: { success: false, count: 0, error: null },
  }

  try {
    // Test 1: Query all rooms
    const allRooms = await gameServer.matchMaker.query({})
    tests.queryAll.success = true
    tests.queryAll.count = allRooms.length
    console.log(`🧪 API Test: Found ${allRooms.length} total rooms`)
  } catch (error) {
    tests.queryAll.error = error.message
    console.error("🧪 API Test: Query all rooms failed:", error)
  }

  try {
    // Test 2: Query lobby rooms specifically
    const lobbyRooms = await gameServer.matchMaker.query({ name: "lobby" })
    tests.queryLobby.success = true
    tests.queryLobby.count = lobbyRooms.length
    console.log(`🧪 API Test: Found ${lobbyRooms.length} lobby rooms`)
  } catch (error) {
    tests.queryLobby.error = error.message
    console.error("🧪 API Test: Query lobby rooms failed:", error)
  }

  res.json({ tests, timestamp: new Date().toISOString() })
})

// Add Colyseus monitor
app.use("/colyseus", monitor())

// Add Colyseus playground in development
if (process.env.NODE_ENV !== "production") {
  app.use("/playground", playground)
  console.log("🎮 Playground available at /playground")
}

// Start the server
gameServer.listen(port).then(() => {
  console.log(`🚀 Colyseus Server listening on http://localhost:${port}`)
  console.log(`📊 Monitor available at http://localhost:${port}/colyseus`)
  if (process.env.NODE_ENV !== "production") {
    console.log(`🎮 Playground available at http://localhost:${port}/playground`)
  }
  console.log("⚔️ Battle Room with Three.js support ready!")
  console.log("🏛️ CustomLobbyRoom ready for player matching!")
})

export default app
