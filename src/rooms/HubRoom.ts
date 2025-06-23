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

  async onAuth(client: Client, options: any) {
    console.log(`🔐 HubRoom: Authentication request from ${client.sessionId}`, options)

    try {
      // Validate options
      if (!options || typeof options !== "object") {
        console.log(`❌ HubRoom: Invalid options from ${client.sessionId}`)
        throw new Error("Invalid authentication options")
      }

      // Very permissive authentication for hub
      let username = options.username
      if (!username || typeof username !== "string" || username.trim() === "") {
        console.log(`⚠️ HubRoom: No valid username provided, using default for ${client.sessionId}`)
        username = `Player_${client.sessionId.substring(0, 6)}`
      }

      // Sanitize username
      username = username.trim().substring(0, 20)

      // Check room capacity AFTER validation
      if (this.clients.length >= this.maxClients) {
        console.log(`❌ HubRoom: Room is full (${this.clients.length}/${this.maxClients})`)
        throw new Error("Hub is full")
      }

      console.log(`✅ HubRoom: Authentication successful for ${client.sessionId} (${username})`)
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
    console.log(`🚪 Player ${client.sessionId} entered the hub`)

    const username = options.username || `Player_${client.sessionId.substring(0, 6)}`

    // Add player to state and get updated total count
    const totalPlayers = this.state.addPlayer(client.sessionId, username)

    console.log(`📊 Hub player count after join: ${totalPlayers}`)

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

    console.log(`📊 Hub now has ${totalPlayers} players`)
  }

  onLeave(client: Client, consented: boolean) {
    console.log(`👋 Player ${client.sessionId} left the hub`)

    // Remove player from state and get updated total count
    const result = this.state.removePlayer(client.sessionId)

    console.log(`📊 Hub player count after leave: ${result.totalPlayers}`)

    // Broadcast player count update to remaining clients
    this.broadcast("player_count_update", {
      totalPlayers: result.totalPlayers,
      timestamp: Date.now(),
    })

    console.log(`📊 Hub now has ${result.totalPlayers} players`)
  }

  onDispose() {
    console.log("🏠 Hub room disposing...")
    if (this.lobbyUpdateInterval) {
      clearInterval(this.lobbyUpdateInterval)
    }
    console.log("🏠 Hub room disposed")
  }

  onError(client: Client, error: any) {
    console.error(`❌ HubRoom: Client ${client.sessionId} error:`, error)
  }

  autoDispose = false
}
