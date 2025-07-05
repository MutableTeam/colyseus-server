import { Room, type Client, updateLobby, matchMaker } from "@colyseus/core"
import { LobbyState } from "../schemas/LobbyState"
import { Player } from "../schemas/Player"

export class CustomLobbyRoom extends Room<LobbyState> {
  maxClients = 8
  private countdownTimer: any = null
  private countdownActive = false

  onCreate(options: any) {
    console.log("🏛️ CustomLobbyRoom created!", options)

    // Set metadata for lobby discovery with real-time listing
    this.setMetadata({
      name: options.lobbyName || `Lobby_${Date.now().toString().substring(8)}`,
      lobbyName: options.lobbyName || `Lobby_${Date.now().toString().substring(8)}`,
      gameType: options.gameType || "battle",
      gameMode: options.gameMode || "deathmatch",
      mapTheme: options.mapTheme || "default",
      maxPlayers: options.maxPlayers || 8,
      isPublic: options.isPublic !== false,
      hostName: options.hostName || options.username || "Unknown",
      createdAt: Date.now(),
      currentPlayers: 0,
      readyPlayers: 0,
      isStarting: false,
    }).then(() => {
      // Update lobby after setting metadata
      updateLobby(this)
    })

    this.setState(new LobbyState())
    this.state.lobbyName = options.lobbyName || `Lobby_${Date.now().toString().substring(8)}`
    this.state.gameType = options.gameType || "battle"
    this.state.gameMode = options.gameMode || "deathmatch"
    this.state.mapTheme = options.mapTheme || "default"
    this.state.maxPlayers = options.maxPlayers || 8
    this.state.isPublic = options.isPublic !== false
    this.state.hostName = options.hostName || options.username || "Unknown"

    this.setupMessageHandlers()

    console.log(`🏛️ CustomLobbyRoom ${this.roomId} ready for players!`)
  }

  private setupMessageHandlers() {
    this.onMessage("ready", (client: Client, message: any) => {
      const player = this.state.players.get(client.sessionId)
      if (player) {
        player.ready = !player.ready
        console.log(`🏛️ Player ${player.name} is ${player.ready ? "ready" : "not ready"}`)

        this.state.updateReadyCount()
        this.updateMetadataAndLobby()

        this.broadcast("player_ready_changed", {
          playerId: client.sessionId,
          ready: player.ready,
          timestamp: Date.now(),
        })

        // Check if all players are ready to start countdown
        if (this.state.areAllPlayersReady() && this.state.players.size >= 2) {
          this.startCountdown()
        } else if (this.countdownActive) {
          this.cancelCountdown()
        }
      }
    })

    this.onMessage("change_settings", (client: Client, message: any) => {
      const player = this.state.players.get(client.sessionId)
      if (player && player.isHost) {
        console.log(`🏛️ Host ${player.name} changing lobby settings:`, message)

        if (message.gameMode) this.state.gameMode = message.gameMode
        if (message.mapTheme) this.state.mapTheme = message.mapTheme
        if (message.maxPlayers) this.state.maxPlayers = message.maxPlayers

        // Update metadata
        this.updateMetadataAndLobby()

        this.broadcast("lobby_settings_changed", {
          gameMode: this.state.gameMode,
          mapTheme: this.state.mapTheme,
          maxPlayers: this.state.maxPlayers,
          timestamp: Date.now(),
        })
      }
    })

    this.onMessage("kick_player", (client: Client, message: any) => {
      const host = this.state.players.get(client.sessionId)
      if (host && host.isHost && message.playerId) {
        const targetClient = this.clients.find((c) => c.sessionId === message.playerId)
        if (targetClient) {
          console.log(`🏛️ Host ${host.name} kicked player ${message.playerId}`)
          targetClient.leave()
        }
      }
    })

    this.onMessage("ping", (client: Client, message: any) => {
      client.send("pong", { timestamp: Date.now() })
    })
  }

  private startCountdown() {
    if (this.countdownActive) return

    this.countdownActive = true
    this.state.countdownActive = true
    this.state.countdown = 5

    console.log(`🏛️ Starting countdown in lobby ${this.roomId}`)

    this.broadcast("countdown_started", {
      countdown: this.state.countdown,
      timestamp: Date.now(),
    })

    // Update metadata to show starting state
    this.setMetadata({
      ...this.metadata,
      isStarting: true,
    }).then(() => {
      updateLobby(this)
    })

    this.countdownTimer = setInterval(() => {
      this.state.countdown--

      this.broadcast("countdown_update", {
        countdown: this.state.countdown,
        timestamp: Date.now(),
      })

      if (this.state.countdown <= 0) {
        this.startGame()
      }
    }, 1000)
  }

  private cancelCountdown() {
    if (!this.countdownActive) return

    console.log(`🏛️ Cancelling countdown in lobby ${this.roomId}`)

    this.countdownActive = false
    this.state.countdownActive = false
    this.state.countdown = 0

    if (this.countdownTimer) {
      clearInterval(this.countdownTimer)
      this.countdownTimer = null
    }

    // Update metadata to remove starting state
    this.setMetadata({
      ...this.metadata,
      isStarting: false,
    }).then(() => {
      updateLobby(this)
    })

    this.broadcast("countdown_cancelled", {
      timestamp: Date.now(),
    })
  }

  private async startGame() {
    console.log(`🏛️ Starting game from lobby ${this.roomId}`)

    this.countdownActive = false
    this.state.countdownActive = false

    if (this.countdownTimer) {
      clearInterval(this.countdownTimer)
      this.countdownTimer = null
    }

    try {
      // Create the game room based on lobby settings
      const gameRoom = await matchMaker.createRoom(this.state.gameType, {
        lobbyId: this.roomId,
        fromLobby: true,
        gameMode: this.state.gameMode,
        mapTheme: this.state.mapTheme,
        maxPlayers: this.state.maxPlayers,
        hostName: this.state.hostName,
        roomName: `${this.state.lobbyName}_Game`,
      })

      console.log(`🎮 Created ${this.state.gameType} room: ${gameRoom.roomId}`)

      // Send game room info to all players
      this.broadcast("game_starting", {
        gameRoomId: gameRoom.roomId,
        gameType: this.state.gameType,
        gameMode: this.state.gameMode,
        mapTheme: this.state.mapTheme,
        timestamp: Date.now(),
      })

      // Close the lobby after a short delay
      setTimeout(() => {
        console.log(`🏛️ Closing lobby ${this.roomId} after game start`)
        this.disconnect()
      }, 3000)
    } catch (error: any) {
      console.error(`❌ Failed to create game room from lobby ${this.roomId}:`, error)

      this.broadcast("game_start_failed", {
        error: error.message,
        timestamp: Date.now(),
      })

      // Reset ready states
      this.state.players.forEach((player) => {
        player.ready = false
      })
      this.state.updateReadyCount()
      this.updateMetadataAndLobby()
    }
  }

  private async updateMetadataAndLobby() {
    const playerCount = this.state.players.size
    const readyCount = this.state.readyPlayers

    // Update metadata
    await this.setMetadata({
      ...this.metadata,
      currentPlayers: playerCount,
      readyPlayers: readyCount,
      gameMode: this.state.gameMode,
      mapTheme: this.state.mapTheme,
      maxPlayers: this.state.maxPlayers,
      hostName: this.state.hostName,
      lastUpdate: Date.now(),
    })

    // Trigger lobby update for real-time listing
    try {
      await updateLobby(this)
      console.log(`🔄 Updated lobby metadata: ${playerCount} players, ${readyCount} ready`)
    } catch (error) {
      console.error("❌ Failed to update lobby:", error)
    }
  }

  async onAuth(client: Client, options: any) {
    console.log(`🔐 CustomLobbyRoom: Authentication request from ${client.sessionId}`, options)

    try {
      if (!options || typeof options !== "object") {
        throw new Error("Invalid authentication options")
      }

      let username = options.username
      if (!username || typeof username !== "string" || username.trim() === "") {
        username = `Player_${client.sessionId.substring(0, 6)}`
      }

      username = username.trim().substring(0, 20)

      if (this.clients.length >= this.maxClients) {
        throw new Error("Lobby is full")
      }

      console.log(`✅ CustomLobbyRoom: Authentication successful for ${client.sessionId} (${username})`)
      return {
        username: username,
        authenticated: true,
        joinTime: Date.now(),
        characterType: options.characterType || "default",
      }
    } catch (error: any) {
      console.error(`❌ CustomLobbyRoom: Authentication failed for ${client.sessionId}:`, error.message)
      throw error
    }
  }

  async onJoin(client: Client, options: any) {
    console.log(`🚪 CustomLobbyRoom: Player ${client.sessionId} (${options.username}) joined the lobby`)

    try {
      const username = options.username || `Player_${client.sessionId.substring(0, 6)}`

      // Create player
      const player = new Player()
      player.sessionId = client.sessionId
      player.name = username
      player.characterType = options.characterType || "default"
      player.ready = false
      player.isHost = this.state.players.size === 0 // First player is host

      this.state.players.set(client.sessionId, player)

      // Set host name if this is the first player
      if (player.isHost) {
        this.state.hostName = username
        this.state.hostId = client.sessionId
      }

      console.log(`✅ CustomLobbyRoom: Player ${username} added to lobby state`)

      const playerCount = this.state.players.size

      // Update ready count and metadata
      this.state.updateReadyCount()
      await this.updateMetadataAndLobby()

      // Send welcome message to new player
      client.send("lobby_joined", {
        message: `Welcome to the lobby, ${username}!`,
        playerId: client.sessionId,
        playerName: username,
        isHost: player.isHost,
        lobbyName: this.state.lobbyName,
        gameType: this.state.gameType,
        gameMode: this.state.gameMode,
        mapTheme: this.state.mapTheme,
        maxPlayers: this.state.maxPlayers,
        playerCount: playerCount,
        timestamp: Date.now(),
      })

      // Broadcast player joined to all other players
      this.broadcast(
        "player_joined_lobby",
        {
          playerId: client.sessionId,
          playerName: username,
          isHost: player.isHost,
          playerCount: playerCount,
          timestamp: Date.now(),
        },
        { except: client },
      )

      console.log(`📊 CustomLobbyRoom: Now has ${playerCount} players`)
    } catch (error: any) {
      console.error(`❌ CustomLobbyRoom: Error in onJoin for ${client.sessionId}:`, error)
      client.send("error", { message: "Failed to join lobby" })
    }
  }

  async onLeave(client: Client, consented: boolean) {
    console.log(`👋 CustomLobbyRoom: Player ${client.sessionId} left the lobby (consented: ${consented})`)

    try {
      const player = this.state.players.get(client.sessionId)
      const wasHost = player?.isHost || false

      const removed = this.state.players.delete(client.sessionId)

      if (removed) {
        console.log(`✅ CustomLobbyRoom: Player ${client.sessionId} removed from lobby state`)

        // If host left, assign new host
        if (wasHost && this.state.players.size > 0) {
          const newHost = this.state.players.values().next().value
          if (newHost) {
            newHost.isHost = true
            this.state.hostName = newHost.name
            this.state.hostId = newHost.sessionId
            console.log(`👑 New host assigned: ${newHost.name}`)

            this.broadcast("new_host_assigned", {
              newHostId: newHost.sessionId,
              newHostName: newHost.name,
              timestamp: Date.now(),
            })
          }
        }

        // Update ready count and metadata
        this.state.updateReadyCount()
        await this.updateMetadataAndLobby()

        this.broadcast("player_left_lobby", {
          playerId: client.sessionId,
          timestamp: Date.now(),
        })

        // Cancel countdown if not enough ready players
        if (this.countdownActive && (!this.state.areAllPlayersReady() || this.state.players.size < 2)) {
          this.cancelCountdown()
        }
      }

      const remainingPlayers = this.state.players.size
      console.log(`📊 CustomLobbyRoom: Now has ${remainingPlayers} players`)

      // Close lobby if empty
      if (remainingPlayers === 0) {
        console.log(`🏛️ CustomLobbyRoom: Lobby is empty, scheduling cleanup...`)
        setTimeout(() => {
          this.disconnect()
        }, 5000)
      }
    } catch (error: any) {
      console.error(`❌ CustomLobbyRoom: Error in onLeave for ${client.sessionId}:`, error)
    }
  }

  onDispose() {
    console.log("🏛️ CustomLobbyRoom: Room disposed")
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer)
    }
  }

  onError(client: Client, error: any) {
    console.error(`❌ CustomLobbyRoom: Client ${client.sessionId} error:`, error)
  }
}
