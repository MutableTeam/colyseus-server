import { Room, type Client } from "@colyseus/core"
import { HubState } from "../schemas/HubState"

export class HubRoom extends Room<HubState> {
  maxClients = 100
  private roomScanInterval: any
  private lastRoomScan = 0
  private scanCooldown = 5000 // 5 seconds between scans

  onCreate(options: any) {
    console.log("🏠 HubRoom created!", options)

    // Set metadata for room discovery
    this.setMetadata({
      name: "Main Hub",
      gameType: "hub",
      isPublic: true,
      createdAt: Date.now(),
    })

    // Initialize hub state
    this.setState(new HubState())

    // Set up message handlers
    this.setupMessageHandlers()

    // Start periodic room scanning
    this.startRoomScanning()

    console.log(`🏠 HubRoom ${this.roomId} ready for connections!`)
  }

  private setupMessageHandlers() {
    // Handle room list requests
    this.onMessage("get_rooms", (client: Client) => {
      this.sendRoomList(client)
    })

    // Handle lobby list requests
    this.onMessage("get_lobbies", (client: Client) => {
      this.sendLobbyList(client)
    })

    // Handle refresh requests
    this.onMessage("refresh_rooms", (client: Client) => {
      this.scanAvailableRooms()
      this.sendRoomList(client)
    })

    this.onMessage("refresh_lobbies", (client: Client) => {
      this.scanAvailableLobbies()
      this.sendLobbyList(client)
    })

    // Handle ping/heartbeat messages
    this.onMessage("ping", (client: Client, message: any) => {
      client.send("pong", { timestamp: Date.now() })
    })

    // Handle test message for debugging
    this.onMessage("test_message", (client: Client, message: any) => {
      console.log(`🧪 HubRoom: Test message from ${client.sessionId}:`, message)

      client.send("test_response", {
        message: "Hub room test response",
        timestamp: Date.now(),
        clientId: client.sessionId,
        roomId: this.roomId,
        totalRooms: this.state.totalRooms,
        totalLobbies: this.state.totalLobbies,
        totalPlayers: this.state.totalPlayers,
        connectedClients: this.clients.length,
      })
    })

    // Handle create room requests
    this.onMessage("create_room", async (client: Client, message: any) => {
      try {
        const { gameType, roomName, maxPlayers, isPublic } = message

        console.log(`🎮 HubRoom: Creating ${gameType} room for ${client.sessionId}`)

        // Create room through matchmaker
        const room = await this.presence.create(gameType, {
          roomName: roomName || `${gameType}_${Date.now()}`,
          maxPlayers: maxPlayers || 8,
          isPublic: isPublic !== false,
          createdBy: client.sessionId,
          fromHub: true,
        })

        client.send("room_created", {
          roomId: room.roomId,
          gameType: gameType,
          message: `${gameType} room created successfully!`,
          timestamp: Date.now(),
        })

        // Refresh room list after creation
        setTimeout(() => {
          this.scanAvailableRooms()
        }, 1000)
      } catch (error: any) {
        console.error(`❌ HubRoom: Failed to create room:`, error)
        client.send("room_creation_failed", {
          error: error.message || "Failed to create room",
          timestamp: Date.now(),
        })
      }
    })

    // Handle join room requests
    this.onMessage("join_room", async (client: Client, message: any) => {
      try {
        const { roomId, username } = message

        console.log(`🚪 HubRoom: ${client.sessionId} joining room ${roomId}`)

        client.send("joining_room", {
          roomId: roomId,
          message: `Joining room ${roomId}...`,
          timestamp: Date.now(),
        })
      } catch (error: any) {
        console.error(`❌ HubRoom: Failed to join room:`, error)
        client.send("join_room_failed", {
          error: error.message || "Failed to join room",
          timestamp: Date.now(),
        })
      }
    })
  }

  private startRoomScanning() {
    // Scan immediately
    this.scanAvailableRooms()
    this.scanAvailableLobbies()

    // Set up periodic scanning
    this.roomScanInterval = setInterval(() => {
      const now = Date.now()
      if (now - this.lastRoomScan >= this.scanCooldown) {
        this.scanAvailableRooms()
        this.scanAvailableLobbies()
        this.lastRoomScan = now
      }
    }, this.scanCooldown)
  }

  private async scanAvailableRooms() {
    try {
      console.log("🔍 HubRoom: Scanning for available rooms...")

      // Get all available rooms
      const rooms = await this.presence.find({})

      // Clear existing rooms
      this.state.availableRooms.clear()

      // Filter and add rooms
      rooms.forEach((room: any) => {
        // Skip hub rooms and lobbies
        if (room.name === "hub" || room.name === "lobby") return

        // Add room to state
        this.state.addRoom(room.roomId, {
          name: room.metadata?.name || `Room_${room.roomId.substring(0, 8)}`,
          gameType: room.name,
          currentPlayers: room.clients,
          maxPlayers: room.maxClients,
          isPublic: room.metadata?.isPublic !== false,
          gameStarted: room.metadata?.gameStarted || false,
          createdAt: room.metadata?.createdAt || Date.now(),
        })
      })

      console.log(`🔍 HubRoom: Found ${this.state.totalRooms} available rooms`)

      // Broadcast updated room list to all clients
      this.broadcast("rooms_updated", {
        totalRooms: this.state.totalRooms,
        timestamp: Date.now(),
      })
    } catch (error: any) {
      console.error("❌ HubRoom: Error scanning rooms:", error)
    }
  }

  private async scanAvailableLobbies() {
    try {
      console.log("🔍 HubRoom: Scanning for available lobbies...")

      // Get all lobby rooms
      const lobbies = await this.presence.find({ name: "lobby" })

      // Clear existing lobbies
      this.state.availableLobbies.clear()

      // Add lobbies to state
      lobbies.forEach((lobby: any) => {
        this.state.addLobby(lobby.roomId, {
          name: lobby.metadata?.name || `Lobby_${lobby.roomId.substring(0, 8)}`,
          currentPlayers: lobby.clients,
          maxPlayers: lobby.maxClients,
          isPublic: lobby.metadata?.isPublic !== false,
          createdAt: lobby.metadata?.createdAt || Date.now(),
        })
      })

      console.log(`🔍 HubRoom: Found ${this.state.totalLobbies} available lobbies`)

      // Broadcast updated lobby list to all clients
      this.broadcast("lobbies_updated", {
        totalLobbies: this.state.totalLobbies,
        timestamp: Date.now(),
      })
    } catch (error: any) {
      console.error("❌ HubRoom: Error scanning lobbies:", error)
    }
  }

  private sendRoomList(client: Client) {
    const rooms: any[] = []
    this.state.availableRooms.forEach((room, id) => {
      rooms.push({
        roomId: id,
        name: room.name,
        gameType: room.gameType,
        currentPlayers: room.currentPlayers,
        maxPlayers: room.maxPlayers,
        isPublic: room.isPublic,
        gameStarted: room.gameStarted,
        createdAt: room.createdAt,
      })
    })

    client.send("room_list", {
      rooms: rooms,
      totalRooms: this.state.totalRooms,
      timestamp: Date.now(),
    })
  }

  private sendLobbyList(client: Client) {
    const lobbies: any[] = []
    this.state.availableLobbies.forEach((lobby, id) => {
      lobbies.push({
        roomId: id,
        name: lobby.name,
        currentPlayers: lobby.currentPlayers,
        maxPlayers: lobby.maxPlayers,
        isPublic: lobby.isPublic,
        createdAt: lobby.createdAt,
      })
    })

    client.send("lobby_list", {
      lobbies: lobbies,
      totalLobbies: this.state.totalLobbies,
      timestamp: Date.now(),
    })
  }

  async onAuth(client: Client, options: any) {
    console.log(`🔐 HubRoom: Authentication request from ${client.sessionId}`, options)

    try {
      if (!options || typeof options !== "object") {
        throw new Error("Invalid authentication options")
      }

      let username = options.username
      if (!username || typeof username !== "string" || username.trim() === "") {
        username = `Player_${client.sessionId.substring(0, 6)}`
      }

      username = username.trim().substring(0, 20)

      console.log(`✅ HubRoom: Authentication successful for ${client.sessionId} (${username})`)
      return {
        username: username,
        authenticated: true,
        joinTime: Date.now(),
      }
    } catch (error: any) {
      console.error(`❌ HubRoom: Authentication failed for ${client.sessionId}:`, error.message)
      throw error
    }
  }

  onJoin(client: Client, options: any) {
    console.log(`🚪 HubRoom: Player ${client.sessionId} (${options.username}) joined the hub`)

    try {
      const username = options.username || `Player_${client.sessionId.substring(0, 6)}`

      // Send welcome message
      client.send("hub_joined", {
        message: `Welcome to the hub, ${username}!`,
        playerId: client.sessionId,
        playerName: username,
        timestamp: Date.now(),
      })

      // Send current room and lobby lists
      this.sendRoomList(client)
      this.sendLobbyList(client)

      // Send hub stats
      client.send("hub_stats", {
        totalPlayers: this.state.totalPlayers,
        totalRooms: this.state.totalRooms,
        totalLobbies: this.state.totalLobbies,
        connectedToHub: this.clients.length,
        timestamp: Date.now(),
      })

      console.log(`📊 HubRoom: Now has ${this.clients.length} connected clients`)
    } catch (error: any) {
      console.error(`❌ HubRoom: Error in onJoin for ${client.sessionId}:`, error)
      client.send("error", { message: "Failed to join hub" })
    }
  }

  onLeave(client: Client, consented: boolean) {
    console.log(`👋 HubRoom: Player ${client.sessionId} left the hub (consented: ${consented})`)
    console.log(`📊 HubRoom: Now has ${this.clients.length} connected clients`)
  }

  onDispose() {
    console.log("🏠 HubRoom: Room disposed")
    if (this.roomScanInterval) {
      clearInterval(this.roomScanInterval)
    }
  }

  onError(client: Client, error: any) {
    console.error(`❌ HubRoom: Client ${client.sessionId} error:`, error)
  }
}
