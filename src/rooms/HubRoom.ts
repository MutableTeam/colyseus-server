import { Room, type Client, matchMaker } from "@colyseus/core"
import { HubState } from "../schemas/HubState"

export class HubRoom extends Room<HubState> {
  maxClients = 200
  private lobbyUpdateInterval: any

  onCreate(options: any) {
    console.log("🏠 HubRoom created - Central hub is now online!", options)

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

    // Handle test message
    this.onMessage("test_message", (client: Client, message: any) => {
      console.log(`🧪 Test message from ${client.sessionId}:`, message)
      client.send("test_response", {
        message: "Hub received your message!",
        timestamp: Date.now(),
        clientId: client.sessionId,
        hubStatus: this.state.serverStatus,
      })
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
        createdAt: room.createdAt || Date.now(),
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

  onJoin(client: Client, options: any) {
    console.log(`🚪 Player ${client.sessionId} entered the hub`)

    const username = options.username || `Player_${client.sessionId.substring(0, 6)}`

    // Add player to state and update total count
    this.state.addPlayer(client.sessionId, username)

    console.log(`📊 Hub player count after join: ${this.state.totalPlayers}`)

    // Send welcome message with hub status
    client.send("hub_welcome", {
      message: "Welcome to the game hub!",
      totalPlayers: this.state.totalPlayers,
      serverStatus: this.state.serverStatus,
      availableLobbies: this.state.getAllAvailableLobbies(),
      timestamp: Date.now(),
    })

    // Broadcast player count update to all clients
    this.broadcast("player_count_update", {
      totalPlayers: this.state.totalPlayers,
      timestamp: Date.now(),
    })

    console.log(`📊 Hub now has ${this.state.totalPlayers} players`)
  }

  onLeave(client: Client, consented: boolean) {
    console.log(`👋 Player ${client.sessionId} left the hub`)

    // Remove player from state and update total count
    this.state.removePlayer(client.sessionId)

    console.log(`📊 Hub player count after leave: ${this.state.totalPlayers}`)

    // Broadcast player count update to remaining clients
    this.broadcast("player_count_update", {
      totalPlayers: this.state.totalPlayers,
      timestamp: Date.now(),
    })

    console.log(`📊 Hub now has ${this.state.totalPlayers} players`)
  }

  onDispose() {
    console.log("🏠 Hub room disposing...")
    if (this.lobbyUpdateInterval) {
      clearInterval(this.lobbyUpdateInterval)
    }
    console.log("🏠 Hub room disposed")
  }

  // CRITICAL: Enhanced authentication for Colyseus v0.15+
  async onAuth(client: Client, options: any) {
    console.log(`🔐 Hub: Authentication request from ${client.sessionId}`, options)

    // Validate required options
    if (!options.username || typeof options.username !== "string") {
      console.log(`❌ Hub: Invalid username from ${client.sessionId}`)
      throw new Error("Username is required")
    }

    // Check if room is full
    if (this.clients.length >= this.maxClients) {
      console.log(`❌ Hub: Room is full (${this.clients.length}/${this.maxClients})`)
      throw new Error("Room is full")
    }

    // Additional validation for Colyseus v0.15+
    if (options.username.length < 3 || options.username.length > 20) {
      console.log(`❌ Hub: Username length invalid from ${client.sessionId}`)
      throw new Error("Username must be between 3 and 20 characters")
    }

    console.log(`✅ Hub: Authentication successful for ${client.sessionId} (${options.username})`)
    return { username: options.username, authenticated: true }
  }

  autoDispose = false
}
