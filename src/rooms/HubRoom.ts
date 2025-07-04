import { Room, type Client, matchMaker } from "@colyseus/core"
import { HubState } from "../schemas/HubState"

export class HubRoom extends Room<HubState> {
  maxClients = 200
  private lobbyUpdateInterval: any

  onCreate(options: any) {
    console.log("🏠 HubRoom created - Central hub is now online!", options)
    console.log(`🏠 HubRoom: maxClients set to ${this.maxClients}`)

    this.setState(new HubState())
    this.state.serverStatus = "online"

    // Handle request for available lobbies
    this.onMessage("get_lobbies", async (client: Client, message: any) => {
      console.log(`🔍 Player ${client.sessionId} requesting lobbies:`, message)

      const { gameType } = message

      try {
        let lobbies: any[] = []

        if (gameType) {
          // Query for specific game type
          console.log(`🔍 Hub: Querying for ${gameType} rooms using matchMaker.query()`)
          const rooms = await matchMaker.query({ name: gameType })
          lobbies = this.formatRooms(rooms)
        } else {
          // Query for all supported room types
          const roomTypes = ["lobby", "battle", "race", "platformer"]
          const allRoomQueries = roomTypes.map(async (roomType) => {
            try {
              const rooms = await matchMaker.query({ name: roomType })
              return this.formatRooms(rooms)
            } catch (error) {
              console.log(`🔍 Hub: No ${roomType} rooms found`)
              return []
            }
          })

          const roomResults = await Promise.all(allRoomQueries)
          lobbies = roomResults.flat()
        }

        console.log(`🔍 Hub: Found ${lobbies.length} available lobbies`)

        client.send("lobbies_update", {
          lobbies: lobbies,
          gameType: gameType || "all",
          timestamp: Date.now(),
        })
      } catch (error: any) {
        console.error(`❌ Hub: Error querying lobbies:`, error)
        client.send("lobbies_update", {
          lobbies: [],
          gameType: gameType || "all",
          error: error.message,
          timestamp: Date.now(),
        })
      }
    })

    // Handle navigation to specific lobby
    this.onMessage("join_lobby", (client: Client, message: any) => {
      const { lobbyId, gameType } = message
      console.log(`🎯 Player ${client.sessionId} wants to join lobby ${lobbyId} (${gameType})`)

      client.send("navigate_to_lobby", {
        lobbyId,
        gameType,
        action: "join_lobby",
        timestamp: Date.now(),
      })
    })

    // Handle creating new lobby
    this.onMessage("create_lobby", (client: Client, message: any) => {
      const { gameType, lobbyName, maxPlayers } = message
      console.log(`🎮 Player ${client.sessionId} wants to create ${gameType} lobby: ${lobbyName}`)

      client.send("navigate_to_lobby", {
        gameType,
        lobbyName,
        maxPlayers,
        action: "create_lobby",
        timestamp: Date.now(),
      })
    })

    // Handle test message with enhanced response
    this.onMessage("test_message", (client: Client, message: any) => {
      console.log(`🧪 Hub: Test message from ${client.sessionId}:`, message)

      const player = this.state.players.get(client.sessionId)
      const totalPlayers = this.state.totalPlayers

      // Send comprehensive test response
      client.send("test_response", {
        message: "Hub received your message!",
        timestamp: Date.now(),
        clientId: client.sessionId,
        hubStatus: this.state.serverStatus,
        totalPlayers: totalPlayers,
        playerFound: !!player,
        playerName: player?.username || "Unknown",
        roomId: this.roomId,
        connectedClients: this.clients.length,
      })

      // Also send current hub state
      client.send("hub_state_update", {
        totalPlayers: totalPlayers,
        serverStatus: this.state.serverStatus,
        timestamp: Date.now(),
      })

      // Broadcast player count update to ensure all clients are in sync
      this.broadcast("player_count_update", {
        totalPlayers: totalPlayers,
        timestamp: Date.now(),
      })

      console.log(`📊 Hub: Sent test response with ${totalPlayers} total players to ${client.sessionId}`)
    })

    // Handle ping/heartbeat messages
    this.onMessage("ping", (client: Client, message: any) => {
      client.send("pong", { timestamp: Date.now() })
    })

    // Set up periodic lobby discovery
    this.lobbyUpdateInterval = this.setSimulationInterval(() => {
      this.discoverAvailableLobbies()
    }, 10000) // Update every 10 seconds

    // Initial lobby discovery
    this.discoverAvailableLobbies()

    console.log("🌟 Hub room fully initialized and ready for players!")
  }

  private formatRooms(rooms: any[]): any[] {
    return rooms
      .filter((room) => !room.locked && room.clients < room.maxClients)
      .map((room) => ({
        id: room.roomId,
        name: room.metadata?.name || `${room.name}_${room.roomId.substring(0, 8)}`,
        type: room.name,
        currentPlayers: room.clients || 0,
        maxPlayers: room.maxClients || 50,
        // Ensure createdAt is always a number (timestamp)
        createdAt: room.createdAt
          ? typeof room.createdAt === "number"
            ? room.createdAt
            : new Date(room.createdAt).getTime()
          : Date.now(),
        locked: room.locked || false,
        private: room.private || false,
      }))
  }

  async discoverAvailableLobbies() {
    try {
      console.log("🔍 Hub: Discovering lobbies using matchMaker.query()...")

      const roomTypes = ["lobby", "battle", "race", "platformer"]
      const allRoomQueries = roomTypes.map(async (roomType) => {
        try {
          const rooms = await matchMaker.query({ name: roomType })
          return this.formatRooms(rooms)
        } catch (error) {
          console.log(`🔍 Hub: No ${roomType} rooms found during discovery`)
          return []
        }
      })

      const roomResults = await Promise.all(allRoomQueries)
      const activeRooms = roomResults.flat()

      // Update the hub state with discovered lobbies
      this.state.updateAvailableLobbies(activeRooms)

      console.log(`🔄 Hub: Updated available lobbies (${activeRooms.length} found using matchMaker.query)`)

      // Broadcast the updated lobbies to all connected clients
      if (activeRooms.length > 0) {
        this.broadcast("lobbies_discovered", {
          lobbies: activeRooms,
          timestamp: Date.now(),
        })
      }
    } catch (error) {
      console.error("❌ Hub: Error discovering lobbies with matchMaker.query:", error)
    }
  }

  async onAuth(client: Client, options: any) {
    console.log(`🔐 HubRoom: Authentication request from ${client.sessionId}`)
    console.log(`🔐 HubRoom: Current clients: ${this.clients.length}/${this.maxClients}`)
    console.log(`🔐 HubRoom: Options received:`, options)

    try {
      // Validate options - be very permissive for public hub
      if (!options) {
        options = {}
      }

      // Very permissive authentication for hub
      let username = options.username
      if (!username || typeof username !== "string" || username.trim() === "") {
        username = `Player_${client.sessionId.substring(0, 6)}`
        console.log(`⚠️ HubRoom: No valid username provided, using default: ${username}`)
      }

      // Sanitize username
      username = username.trim().substring(0, 20)

      console.log(`✅ HubRoom: Authentication successful for ${client.sessionId} (${username})`)
      console.log(`📊 HubRoom: Will have ${this.clients.length + 1} clients after join`)

      return {
        username: username,
        authenticated: true,
        joinTime: Date.now(),
      }
    } catch (error) {
      console.error(
        `❌ HubRoom: Authentication failed for ${client.sessionId}:`,
        error instanceof Error ? error.message : String(error),
      )
      throw error
    }
  }

  onJoin(client: Client, options: any) {
    console.log(`🚪 HubRoom: Player ${client.sessionId} entering the hub`)
    console.log(`📊 HubRoom: Client count before adding to state: ${this.clients.length}`)

    const username = options.username || `Player_${client.sessionId.substring(0, 6)}`

    try {
      // Add player to state and get updated total count
      const totalPlayers = this.state.addPlayer(client.sessionId, username)

      console.log(`📊 HubRoom: Player count after join: ${totalPlayers}`)
      console.log(`📊 HubRoom: WebSocket clients: ${this.clients.length}`)

      // CRITICAL: Force state change notification
      this.state.lastUpdate = Date.now()

      // Send welcome message with hub status
      client.send("hub_welcome", {
        message: "Welcome to the game hub!",
        totalPlayers: totalPlayers,
        serverStatus: this.state.serverStatus,
        availableLobbies: this.state.getAllAvailableLobbies(),
        timestamp: Date.now(),
      })

      // Broadcast player count update to all clients
      this.broadcast("player_count_update", {
        totalPlayers: totalPlayers,
        timestamp: Date.now(),
      })

      // Also send current state to the new client
      client.send("hub_state_update", {
        totalPlayers: totalPlayers,
        serverStatus: this.state.serverStatus,
        timestamp: Date.now(),
      })

      console.log(`✅ HubRoom: Successfully added player ${username} (${client.sessionId})`)
      console.log(`📊 HubRoom: Hub now has ${totalPlayers} players`)
    } catch (error) {
      console.error(`❌ HubRoom: Error in onJoin for ${client.sessionId}:`, error)
      // Don't throw here as it might cause the 4002 error
    }
  }

  onLeave(client: Client, consented: boolean) {
    console.log(`👋 HubRoom: Player ${client.sessionId} left the hub (consented: ${consented})`)
    console.log(`📊 HubRoom: Client count before removal: ${this.clients.length}`)

    try {
      // Remove player from state and get updated total count
      const result = this.state.removePlayer(client.sessionId)

      console.log(`📊 HubRoom: Player count after leave: ${result.totalPlayers}`)

      // CRITICAL: Force state change notification
      this.state.lastUpdate = Date.now()

      // Broadcast player count update to remaining clients
      this.broadcast("player_count_update", {
        totalPlayers: result.totalPlayers,
        timestamp: Date.now(),
      })

      console.log(`📊 HubRoom: Hub now has ${result.totalPlayers} players`)
    } catch (error) {
      console.error(`❌ HubRoom: Error in onLeave for ${client.sessionId}:`, error)
    }
  }

  onDispose() {
    console.log("🏠 HubRoom: Room disposing...")
    if (this.lobbyUpdateInterval) {
      clearInterval(this.lobbyUpdateInterval)
    }
    console.log("🏠 HubRoom: Room disposed")
  }

  onError(client: Client, error: any) {
    console.error(`❌ HubRoom: Client ${client.sessionId} error:`, error)
    console.error(`❌ HubRoom: Error details:`, {
      message: error.message,
      code: error.code,
      stack: error.stack,
    })
  }

  // Disable auto-dispose to keep hub persistent
  autoDispose = false
}
