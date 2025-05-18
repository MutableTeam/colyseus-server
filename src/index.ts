import { monitor } from "@colyseus/monitor"
import express from "express"
import cors from "cors"
import { Server } from "colyseus"
import { WebSocketTransport } from "@colyseus/ws-transport"
import http from "http"

// Import game rooms
import { LobbyRoom } from "./rooms/LobbyRoom"
import { BattleRoom } from "./rooms/BattleRoom"
import { RaceRoom } from "./rooms/RaceRoom"
import { PlatformerRoom } from "./rooms/PlatformerRoom"

const port = Number(process.env.PORT || 2567)

// Create the Express app
const app = express()
app.use(cors())
app.use(express.json())

// Create HTTP server
const server = http.createServer(app)

// Create the Colyseus server
const gameServer = new Server({
  transport: new WebSocketTransport({
    server,
    pingInterval: 5000,
    pingMaxRetries: 3,
  }),
})

// Register your room handlers
gameServer.define("lobby", LobbyRoom)
gameServer.define("battle", BattleRoom)
gameServer.define("race", RaceRoom)
gameServer.define("platformer", PlatformerRoom)

// Register Colyseus Monitor
app.use("/colyseus", monitor())

// Register a simple health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime() })
})

// Start the server
server.listen(port, () => {
  console.log(`🚀 Game server started on port ${port}`)
})

// Export for Vercel serverless functions
export default app
