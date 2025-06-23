import { Room, type Client, matchMaker, ServerError } from "@colyseus/core"
import { HubState } from "../schemas/HubState"

export class HubRoom extends Room<HubState> {
  maxClients = 200 // Default, but will be overridden by app.config.ts or Cloud dashboard
  private lobbyUpdateInterval: any

  onCreate(options: any) {
    console.log(`🏠 HubRoom ${this.roomId}: CREATED. Options:`, options)
    console.log(`🏠 HubRoom ${this.roomId}: Initial maxClients from class: ${this.maxClients}`)
    // Note: The actual maxClients might be set by gameServer.define() options or Colyseus Cloud dashboard.

    try {
      this.setState(new HubState())
      this.state.serverStatus = "online"
      console.log(`🏠 HubRoom ${this.roomId}: State initialized. Current clients: ${this.clients.length}`)
    } catch (e: any) {
      console.error(`❌ HubRoom ${this.roomId}: CRITICAL ERROR during setState: ${e.message}`, e.stack)
      // If setState fails, the room is likely unusable.
      // Depending on Colyseus version, this might lead to room disposal or connection issues.
      throw new ServerError(500, `HubRoom state initialization failed: ${e.message}`)
    }

    // Handle request for available lobbies
    this.onMessage("get_lobbies", async (client: Client, message: any) => {
      console.log(`🏠 HubRoom ${this.roomId}: Client ${client.sessionId} requested 'get_lobbies'. Message:`, message)
      const { gameType } = message
      try {
        let lobbies: any[] = []
        if (gameType) {
          const rooms = await matchMaker.query({ name: gameType })
          lobbies = this.formatRooms(rooms)
        } else {
          const roomTypes = ["lobby", "battle", "race", "platformer"]
          const allRoomQueries = roomTypes.map(async (type) => {
            try {
              const rooms = await matchMaker.query({ name: type })
              return this.formatRooms(rooms)
            } catch {
              return []
            }
          })
          lobbies = (await Promise.all(allRoomQueries)).flat()
        }
        console.log(
          `🏠 HubRoom ${this.roomId}: Found ${lobbies.length} lobbies for client ${client.sessionId}. Type: ${gameType || "all"}`,
        )
        client.send("lobbies_update", { lobbies, gameType: gameType || "all", timestamp: Date.now() })
      } catch (e: any) {
        console.error(
          `❌ HubRoom ${this.roomId}: Error in 'get_lobbies' for ${client.sessionId}: ${e.message}`,
          e.stack,
        )
        client.send("lobbies_update", {
          lobbies: [],
          gameType: gameType || "all",
          error: e.message,
          timestamp: Date.now(),
        })
      }
    })

    this.onMessage("join_lobby", (client: Client, message: any) => {
      console.log(`🏠 HubRoom ${this.roomId}: Client ${client.sessionId} requested 'join_lobby'. Message:`, message)
      client.send("navigate_to_lobby", { ...message, action: "join_lobby", timestamp: Date.now() })
    })

    this.onMessage("create_lobby", (client: Client, message: any) => {
      console.log(`🏠 HubRoom ${this.roomId}: Client ${client.sessionId} requested 'create_lobby'. Message:`, message)
      client.send("navigate_to_lobby", { ...message, action: "create_lobby", timestamp: Date.now() })
    })

    this.onMessage("test_message", (client: Client, message: any) => {
      console.log(`🏠 HubRoom ${this.roomId}: Client ${client.sessionId} sent 'test_message'. Message:`, message)
      client.send("test_response", {
        message: "Hub received your message!",
        timestamp: Date.now(),
        clientId: client.sessionId,
        hubStatus: this.state.serverStatus,
      })
    })

    try {
      this.lobbyUpdateInterval = this.setSimulationInterval(() => this.discoverAvailableLobbies(), 10000)
      this.discoverAvailableLobbies() // Initial discovery
    } catch (e: any) {
      console.error(`❌ HubRoom ${this.roomId}: Error setting up lobby discovery: ${e.message}`, e.stack)
    }

    console.log(
      `🌟 HubRoom ${this.roomId}: Fully initialized. Current clients: ${this.clients.length}. Effective maxClients: ${this.maxClients}`,
    )
  }

  private formatRooms(rooms: any[]): any[] {
    return rooms
      .filter((room) => room && !room.locked && room.clients < room.maxClients)
      .map((room) => ({
        id: room.roomId,
        name: room.metadata?.name || `${room.name}_${room.roomId.substring(0, 8)}`,
        type: room.name,
        currentPlayers: room.clients || 0,
        maxPlayers: room.maxClients || 0, // Ensure maxClients is present
        createdAt: room.createdAt || Date.now(),
        locked: room.locked || false,
        private: room.private || false,
      }))
  }

  async discoverAvailableLobbies() {
    try {
      // console.log(`🏠 HubRoom ${this.roomId}: Discovering available lobbies...`)
      const roomTypes = ["lobby", "battle", "race", "platformer"]
      const allRoomQueries = roomTypes.map(async (type) => {
        try {
          const rooms = await matchMaker.query({ name: type })
          return this.formatRooms(rooms)
        } catch {
          return []
        }
      })
      const activeRooms = (await Promise.all(allRoomQueries)).flat()

      this.state.updateAvailableLobbies(activeRooms)
      // console.log(`🏠 HubRoom ${this.roomId}: Discovered ${activeRooms.length} lobbies.`)

      if (activeRooms.length > 0) {
        this.broadcast("lobbies_discovered", { lobbies: activeRooms, timestamp: Date.now() })
      }
    } catch (e: any) {
      console.error(`❌ HubRoom ${this.roomId}: Error in 'discoverAvailableLobbies': ${e.message}`, e.stack)
    }
  }

  async onAuth(client: Client, options: any) {
    console.log(
      `🔐 HubRoom ${this.roomId}: AUTH request from ${client.sessionId}. Current clients: ${this.clients.length}. Effective maxClients: ${this.maxClients}. Options:`,
      options,
    )

    // The `this.maxClients` here reflects the value set by `gameServer.define()` or Colyseus Cloud.
    if (this.clients.length >= this.maxClients) {
      console.warn(
        `⚠️ HubRoom ${this.roomId}: AUTH REJECTED for ${client.sessionId} - Room is actually full based on current client count (${this.clients.length}/${this.maxClients}).`,
      )
      throw new ServerError(4002, "Hub room is full (checked in onAuth).")
    }

    let username = options?.username
    if (!username || typeof username !== "string" || username.trim() === "") {
      username = `Player_${client.sessionId.substring(0, 6)}`
      console.log(`⚠️ HubRoom ${this.roomId}: No valid username for ${client.sessionId}, using default: ${username}`)
    }
    username = username.trim().substring(0, 20)

    console.log(
      `✅ HubRoom ${this.roomId}: AUTH successful for ${client.sessionId} (${username}). Clients before join: ${this.clients.length}.`,
    )
    return { username, authenticated: true, joinTime: Date.now() }
  }

  onJoin(client: Client, options: any) {
    console.log(
      `🚪 HubRoom ${this.roomId}: JOIN ${client.sessionId} (${options.username}). Clients before adding to state: ${this.clients.length}. Effective maxClients: ${this.maxClients}`,
    )
    try {
      const username = options.username // Already validated in onAuth

      const totalPlayers = this.state.addPlayer(client.sessionId, username)
      console.log(
        `🏠 HubRoom ${this.roomId}: Player ${username} (${client.sessionId}) added to state. Total players in state: ${totalPlayers}. Current clients: ${this.clients.length}`,
      )

      client.send("hub_welcome", {
        message: "Welcome to the game hub!",
        totalPlayers,
        serverStatus: this.state.serverStatus,
        availableLobbies: this.state.getAllAvailableLobbies(),
        timestamp: Date.now(),
      })

      this.broadcast("player_count_update", { totalPlayers, timestamp: Date.now() }, { except: client })

      // Send full state to joining client
      client.send("hub_state_update", {
        totalPlayers: this.state.totalPlayers,
        serverStatus: this.state.serverStatus,
        discoveredLobbies: this.state.getAllAvailableLobbies(), // Send current lobbies
        timestamp: Date.now(),
      })

      console.log(
        `✅ HubRoom ${this.roomId}: JOIN complete for ${client.sessionId}. Total players in state: ${this.state.players.size}. Current clients: ${this.clients.length}`,
      )
    } catch (e: any) {
      console.error(
        `❌ HubRoom ${this.roomId}: CRITICAL ERROR during onJoin for ${client.sessionId}: ${e.message}`,
        e.stack,
      )
      // Disconnect client if onJoin fails catastrophically
      client.leave(1011, `Server error during join: ${e.message}`) // 1011: Internal Error
      // Do not re-throw here as Colyseus might handle it by sending 4002 if it's already past a certain point.
    }
  }

  onLeave(client: Client, consented: boolean) {
    console.log(
      `👋 HubRoom ${this.roomId}: LEAVE ${client.sessionId} (consented: ${consented}). Clients before removal: ${this.clients.length}`,
    )
    try {
      const result = this.state.removePlayer(client.sessionId)
      if (result.removed) {
        console.log(
          `🏠 HubRoom ${this.roomId}: Player ${client.sessionId} removed from state. Total players in state: ${result.totalPlayers}. Current clients: ${this.clients.length - 1}`,
        )
        this.broadcast("player_count_update", { totalPlayers: result.totalPlayers, timestamp: Date.now() })
      } else {
        console.warn(`⚠️ HubRoom ${this.roomId}: Player ${client.sessionId} not found in state during onLeave.`)
      }
    } catch (e: any) {
      console.error(`❌ HubRoom ${this.roomId}: Error during onLeave for ${client.sessionId}: ${e.message}`, e.stack)
    }
    console.log(
      `👋 HubRoom ${this.roomId}: LEAVE complete for ${client.sessionId}. Current clients: ${this.clients.length}. Total players in state: ${this.state.players.size}`,
    )
  }

  onDispose() {
    console.log(`🏠 HubRoom ${this.roomId}: DISPOSING...`)
    if (this.lobbyUpdateInterval) {
      this.clearSimulationInterval(this.lobbyUpdateInterval)
      this.lobbyUpdateInterval = null
    }
    console.log(`🏠 HubRoom ${this.roomId}: DISPOSED.`)
  }

  onError(client: Client, err: any) {
    console.error(`❌ HubRoom ${this.roomId}: ERROR for client ${client.sessionId}: ${err.message}`, err.stack)
  }

  autoDispose = false
}
