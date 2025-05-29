import { Room, type Client } from "@colyseus/core"
import { HubState } from "../schemas/HubState"

export class HubRoom extends Room<HubState> {
  maxClients = 200 // Higher capacity for the main hub
  private lobbyUpdateInterval: any

  onCreate(options: any) {
    console.log("🏠 HubRoom created - Central hub is now online!", options)

    // Initialize the hub state
    this.setState(new HubState())
    this.state.serverStatus = "online"

    // Handle request for available lobbies
    this.onMessage("get_lobbies", (client: Client, message: any) => {
      console.log(`🔍 Player ${client.sessionId} requesting lobbies:`, message)

      const { gameType } = message

      let lobbies
      if (gameType) {
        lobbies = this.state.getLobbiesByType(gameType)
        console.log(`Found ${lobbies.length} ${gameType} lobbies`)
      } else {
        lobbies = this.state.getAllAvailableLobbies()
        console.log(`Found ${lobbies.length} total lobbies`)
      }

      client.send("lobbies_update", {
        lobbies: lobbies,
        gameType: gameType || "all",
        timestamp: Date.now(),
      })
    })

    // Handle navigation to specific lobby
    this.onMessage("join_lobby", (client: Client, message: any) => {
      const { lobbyId, gameType } = message
      console.log(`🎯 Player ${client.sessionId} wants to join lobby ${lobbyId} (${gameType})`)

      // Send navigation info to client
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

      // Send navigation info to client
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

    // Set up periodic lobby discovery from other rooms
    this.lobbyUpdateInterval = this.setSimulationInterval(() => {
      this.discoverAvailableLobbies()
    }, 10000) // Update every 10 seconds

    // Initial lobby discovery
    this.discoverAvailableLobbies()

    console.log("🌟 Hub room fully initialized and ready for players!")
  }

  async discoverAvailableLobbies() {
    try {
      const activeRooms: any[] = []

      // Access the matchMaker through the server instance
      const matchMaker = this.matchMaker
      console.log("🔍 Hub: matchMaker exists:", !!matchMaker)

      if (matchMaker && matchMaker.rooms) {
        console.log("🔍 Hub: Total rooms in matchMaker:", matchMaker.rooms.size)

        for (const [roomId, room] of matchMaker.rooms) {
          console.log(`🔍 Hub: Checking room ${roomId}:`, {
            roomName: room.roomName,
            clients: room.clients.size,
            maxClients: room.maxClients,
            locked: room.locked,
          })

          // Only include lobby rooms that are joinable
          if (room.roomName === "lobby" && !room.locked && room.clients.size < room.maxClients) {
            activeRooms.push({
              id: roomId,
              name: `Lobby ${roomId.substring(0, 8)}`,
              type: "lobby",
              currentPlayers: room.clients.size || 0,
              maxPlayers: room.maxClients || 50,
              createdAt: room.createdAt ? new Date(room.createdAt).getTime() : Date.now(),
              locked: room.locked || false,
              private: room.private || false,
            })
          }
        }
      }

      // Update the hub state with discovered lobbies
      this.state.updateAvailableLobbies(activeRooms)

      console.log(`🔄 Hub: Updated available lobbies (${activeRooms.length} found)`)

      // Broadcast the updated lobbies to all connected clients
      if (activeRooms.length > 0) {
        this.broadcast("lobbies_discovered", {
          lobbies: activeRooms,
          timestamp: Date.now(),
        })
      }
    } catch (error) {
      console.error("❌ Hub: Error discovering lobbies:", error)
    }
  }

  onJoin(client: Client, options: any) {
    console.log(`🚪 Player ${client.sessionId} entered the hub`)

    const username = options.username || `Player_${client.sessionId.substring(0, 6)}`
    this.state.addPlayer(client.sessionId, username)

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

    this.state.removePlayer(client.sessionId)

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

  // Override to prevent disposal when empty
  async onAuth(client: Client, options: any) {
    // Always allow connections to the hub
    return true
  }

  // Keep the hub room alive
  autoDispose = false
}
