import { monitor } from "@colyseus/monitor"
import { playground } from "@colyseus/playground"
// Corrected import: Use 'Room' for server-side room listings and 'MatchMaker' for matchMaker property
import type { Server as GameServer, Room, MatchMaker } from "@colyseus/core"
import { LobbyRoom } from "@colyseus/core"
import type * as Express from "express" // Import Express types

/**
 * Import your Room files
 */
import { HubRoom } from "./rooms/HubRoom"
import { BattleRoom } from "./rooms/BattleRoom"
import { RaceRoom } from "./rooms/RaceRoom"
import { PlatformerRoom } from "./rooms/PlatformerRoom"

export default {
  options: {
    devMode: true, // Enable development mode for more verbose logging
  },

  initializeGameServer: (gameServer: GameServer) => {
    /**
     * Define your room handlers:
     */
    gameServer.define("hub", HubRoom)

    // Define the built-in LobbyRoom
    gameServer.define("lobby", LobbyRoom)

    // Define BattleRoom and enable realtime listing for it
    gameServer.define("battle", BattleRoom).enableRealtimeListing()

    // Define RaceRoom and enable realtime listing for it
    gameServer.define("race", RaceRoom).enableRealtimeListing()

    // Define PlatformerRoom and enable realtime listing for it
    gameServer.define("platformer", PlatformerRoom).enableRealtimeListing()
  },

  initializeExpress: (app: Express.Application) => {
    // Colyseus adds the gameServer instance to the Express app object.
    // We assert its type here to include the 'matchMaker' property.
    const colyseusGameServer: GameServer & { matchMaker: MatchMaker } = (app as any).gameServer

    /**
     * Bind your custom express routes here:
     * Read more: https://expressjs.com/en/starter/basic-routing.html
     */
    app.get("/api/matchmaker-test", async (req: Express.Request, res: Express.Response) => {
      try {
        // Use colyseusGameServer with matchMaker
        const allRooms = await colyseusGameServer.matchMaker.query({})
        const battleRooms = await colyseusGameServer.matchMaker.query({ name: "battle" })

        res.json({
          message: "Matchmaker API test successful!",
          tests: {
            queryAll: {
              success: true,
              count: allRooms.length,
              rooms: allRooms.map((r: Room) => ({ roomId: r.roomId, name: r.name, clients: r.clients })), // Use Room type
            },
            queryLobby: {
              success: true,
              count: battleRooms.length,
              rooms: battleRooms.map((r: Room) => ({ roomId: r.roomId, name: r.name, clients: r.clients })), // Use Room type
            },
          },
        })
      } catch (error: unknown) {
        console.error("API Test Error:", error)
        res.status(500).json({ message: "API Test Failed", error: (error as Error).message })
      }
    })

    app.get("/api/rooms", async (req: Express.Request, res: Express.Response) => {
      try {
        // Use colyseusGameServer with matchMaker
        const rooms = await colyseusGameServer.matchMaker.query({})
        res.json(
          rooms.map((room: Room) => ({
            // Use Room type
            roomId: room.roomId,
            name: room.metadata?.name || room.name,
            type: room.name,
            clients: room.clients,
            maxClients: room.maxClients,
            locked: room.locked,
          })),
        )
      } catch (error: unknown) {
        console.error("Error fetching rooms:", error)
        res.status(500).json({ message: "Failed to fetch rooms", error: (error as Error).message })
      }
    })

    /**
     * Use @colyseus/playground
     * (It is not recommended to expose this in a production environment)
     */
    if (process.env.NODE_ENV !== "production") {
      app.use("/", playground)
    }

    /**
     * Use @colyseus/monitor
     * It is recommended to protect this route with an authentication middleware.
     * Read more: https://docs.colyseus.io/tools/monitor/#protecting-the-monitor
     */
    app.use("/colyseus", monitor())
  },

  beforeListen: () => {
    /**
     * Before before gameServer.listen() is called.
     */
  },
}
// Removed 'as AppConfig' here, as the type is usually inferred or globally available
// and the explicit import was causing the TS2614 error.
