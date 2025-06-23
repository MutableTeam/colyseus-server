import { Room, type Client, ServerError } from "@colyseus/core" // Add ServerError
import { LobbyState } from "../schemas/LobbyState"

export class LobbyRoom extends Room<LobbyState> {
  maxClients = 50
  private gameSession: any = null

  onCreate(options: any) {
    console.log(`🏛️ LobbyRoom ${this.roomId}: CREATED. Options:`, options)
    console.log(`🏛️ LobbyRoom ${this.roomId}: Initial maxClients from class: ${this.maxClients}`)
    try {
      this.setState(new LobbyState())
      // Handle player joining a game
      this.onMessage("join_game", (client: Client, message: any) => {
        try {
          const { gameId, gameType } = message
          console.log(`🎮 Player ${client.sessionId} requesting to join game ${gameId} of type ${gameType}`)
          this.broadcast("available_games", this.state.availableGames)
        } catch (e: any) {
          console.error(
            `❌ LobbyRoom ${this.roomId}: Error handling join_game for ${client.sessionId}: ${e.message}`,
            e.stack,
          )
        }
      })

      // Handle player creating a game
      this.onMessage("create_game", (client: Client, message: any) => {
        try {
          const { gameType, gameName, maxPlayers } = message
          console.log(`🎮 Player ${client.sessionId} creating a game of type ${gameType}`)
          const gameId = `${gameType}_${Date.now()}`
          this.state.createGame(gameId, gameType, gameName, maxPlayers, client.sessionId)
          this.broadcast("game_created", {
            gameId,
            gameType,
            gameName,
            maxPlayers,
            creatorId: client.sessionId,
          })
        } catch (e: any) {
          console.error(
            `❌ LobbyRoom ${this.roomId}: Error handling create_game for ${client.sessionId}: ${e.message}`,
            e.stack,
          )
        }
      })

      // Handle player leaving a game
      this.onMessage("leave_game", (client: Client, message: any) => {
        try {
          const { gameId } = message
          this.state.removePlayerFromGame(gameId, client.sessionId)
          this.broadcast("player_left_game", {
            gameId,
            playerId: client.sessionId,
          })
        } catch (e: any) {
          console.error(
            `❌ LobbyRoom ${this.roomId}: Error handling leave_game for ${client.sessionId}: ${e.message}`,
            e.stack,
          )
        }
      })

      // Handle request for active lobbies by game type
      this.onMessage("get_active_lobbies", (client: Client, message: any) => {
        try {
          console.log(`🔍 Player ${client.sessionId} requesting active lobbies with filter:`, message)
          const { gameType } = message
          let activeLobbies
          if (gameType) {
            activeLobbies = this.state.getActiveLobbiesByGameType(gameType)
            console.log(`🔍 Found ${activeLobbies.length} active lobbies for game type: ${gameType}`)
          } else {
            activeLobbies = this.state.getAllActiveLobbies()
            console.log(`🔍 Found ${activeLobbies.length} total active lobbies`)
          }
          client.send("active_lobbies", {
            lobbies: activeLobbies,
            gameType: gameType || "all",
          })
          console.log(`📤 Sent ${activeLobbies.length} active lobbies to player ${client.sessionId}`)
        } catch (e: any) {
          console.error(
            `❌ LobbyRoom ${this.roomId}: Error handling get_active_lobbies for ${client.sessionId}: ${e.message}`,
            e.stack,
          )
        }
      })

      // CORE READINESS SYSTEM - Handle player ready state
      this.onMessage("ready", (client: Client, message: any) => {
        try {
          console.log(`🎯 LobbyRoom: Player ${client.sessionId} ready state message:`, message)
          const player = this.state.players.get(client.sessionId)
          if (!player) {
            console.log(`❌ LobbyRoom: Player ${client.sessionId} not found in state`)
            client.send("error", { message: "Player not found in lobby" })
            return
          }
          if (typeof message.ready !== "boolean") {
            console.log(`❌ LobbyRoom: Invalid ready state from ${client.sessionId}:`, message.ready)
            client.send("error", { message: "Invalid ready state" })
            return
          }
          const oldReadyState = player.ready
          player.ready = message.ready
          console.log(
            `✅ LobbyRoom: Player ${client.sessionId} (${player.name}) ready state changed from ${oldReadyState} to ${player.ready}`,
          )
          this.broadcast("player_ready_changed", {
            playerId: client.sessionId,
            playerName: player.name,
            ready: player.ready,
            timestamp: Date.now(),
          })
          this.checkAndStartGameSession()
        } catch (error) {
          console.error(`❌ LobbyRoom: Error handling ready message from ${client.sessionId}:`, error)
          client.send("error", { message: "Failed to process ready state" })
        }
      })

      // Handle game type selection for ready sessions
      this.onMessage("select_game_type", (client: Client, message: any) => {
        try {
          const { gameType } = message
          console.log(`🎮 Player ${client.sessionId} selected game type: ${gameType}`)
          this.joinOrCreateGameSession(client, gameType)
        } catch (e: any) {
          console.error(
            `❌ LobbyRoom ${this.roomId}: Error handling select_game_type for ${client.sessionId}: ${e.message}`,
            e.stack,
          )
        }
      })

      // Handle leaving game session
      this.onMessage("leave_game_session", (client: Client) => {
        try {
          this.removePlayerFromGameSession(client.sessionId)
        } catch (e: any) {
          console.error(
            `❌ LobbyRoom ${this.roomId}: Error handling leave_game_session for ${client.sessionId}: ${e.message}`,
            e.stack,
          )
        }
      })

      // Add test message handler for debugging
      this.onMessage("test_message", (client: Client, message: any) => {
        try {
          console.log(`🧪 LobbyRoom: Test message received from ${client.sessionId}:`, message)
          const player = this.state.players.get(client.sessionId)
          const playerCount = this.state.players.size
          let readyCount = 0
          this.state.players.forEach((p) => {
            if (p.ready) readyCount++
          })
          client.send("test_response", {
            message: "Test message received successfully",
            timestamp: Date.now(),
            clientId: client.sessionId,
            roomId: this.roomId,
            playerFound: !!player,
            playerName: player?.name || "Unknown",
            playerReady: player?.ready || false,
            totalPlayers: playerCount,
            readyPlayers: readyCount,
            gameSessionActive: !!this.gameSession,
            gameSessionType: this.gameSession?.gameType || null,
            gameSessionPlayers: this.gameSession?.players.size || 0,
          })
          this.broadcastLobbyStats()
        } catch (e: any) {
          console.error(
            `❌ LobbyRoom ${this.roomId}: Error handling test_message for ${client.sessionId}: ${e.message}`,
            e.stack,
          )
        }
      })

      // Handle ping/heartbeat messages
      this.onMessage("ping", (client: Client, message: any) => {
        try {
          client.send("pong", { timestamp: Date.now() })
        } catch (e: any) {
          console.error(
            `❌ LobbyRoom ${this.roomId}: Error handling ping for ${client.sessionId}: ${e.message}`,
            e.stack,
          )
        }
      })

      // Set up periodic cleanup of stale games
      this.setSimulationInterval(() => {
        this.state.cleanupStaleGames()
      }, 30000) // Check every 30 seconds

      // Broadcast room presence for discovery
      this.broadcast("lobby_available", {
        id: this.roomId,
        name: this.metadata.name,
        clients: this.clients.length,
        maxClients: this.maxClients,
        timestamp: Date.now(),
      })

      console.log(`🏛️ LobbyRoom ${this.roomId} is now discoverable with readiness system active`)
    } catch (e: any) {
      console.error(`❌ LobbyRoom ${this.roomId}: CRITICAL ERROR during setState: ${e.message}`, e.stack)
      throw new ServerError(500, `LobbyRoom state initialization failed: ${e.message}`)
    }
    console.log(
      `🌟 LobbyRoom ${this.roomId}: Fully initialized. Current clients: ${this.clients.length}. Effective maxClients: ${this.maxClients}`,
    )
  }

  async onAuth(client: Client, options: any) {
    console.log(
      `🔐 LobbyRoom ${this.roomId}: AUTH request from ${client.sessionId}. Current clients: ${this.clients.length}. Effective maxClients: ${this.maxClients}. Options:`,
      options,
    )

    if (this.clients.length >= this.maxClients) {
      console.warn(
        `⚠️ LobbyRoom ${this.roomId}: AUTH REJECTED for ${client.sessionId} - Room is actually full based on current client count (${this.clients.length}/${this.maxClients}).`,
      )
      throw new ServerError(4002, "Lobby room is full (checked in onAuth).")
    }

    let username = options?.username
    if (!username || typeof username !== "string" || username.trim() === "") {
      username = `Player_${client.sessionId.substring(0, 6)}`
      console.log(
        `⚠️ LobbyRoom ${this.roomId}: No valid username for ${client.sessionId}, using default: ${username}`,
      )
    }
    username = username.trim().substring(0, 20)

    console.log(
      `✅ LobbyRoom ${this.roomId}: AUTH successful for ${client.sessionId} (${username}). Clients before join: ${this.clients.length}.`,
    )
    return { username, authenticated: true, joinTime: Date.now() }
  }

  onJoin(client: Client, options: any) {
    console.log(
      `🚪 LobbyRoom ${this.roomId}: JOIN ${client.sessionId} (${options.username}). Clients before adding to state: ${this.clients.length}. Effective maxClients: ${this.maxClients}`,
    )
    try {
      const username = options.username // Already validated in onAuth
      this.state.addPlayer(client.sessionId, username)
      console.log(
        `🏛️ LobbyRoom ${this.roomId}: Player ${username} (${client.sessionId}) added to state. Total players in state: ${this.state.players.size}. Current clients: ${this.clients.length}`,
      )

      const playersArray: Array<{ id: string; name: string; ready: boolean }> = []
      this.state.players.forEach((player: any, id: string) => {
        playersArray.push({ id, name: player.name, ready: player.ready })
      })
      const gamesArray: Array<any> = []
      this.state.availableGames.forEach((game: any, id: string) => {
        gamesArray.push({
          id,
          name: game.name,
          type: game.type,
          currentPlayers: game.currentPlayers,
          maxPlayers: game.maxPlayers,
        })
      })

      client.send("lobby_state", {
        players: playersArray,
        availableGames: gamesArray,
        lobbyId: this.roomId,
        metadata: this.metadata,
        playerCount: playersArray.length,
        timestamp: Date.now(),
      })

      client.send("lobby_welcome", {
        message: `Welcome to ${this.metadata.name || "the Lobby"}!`,
        playerId: client.sessionId,
        playerName: username,
        playerCount: playersArray.length,
        timestamp: Date.now(),
      })

      this.broadcastLobbyStats()

      console.log(
        `✅ LobbyRoom ${this.roomId}: JOIN complete for ${client.sessionId}. Total players in state: ${this.state.players.size}. Current clients: ${this.clients.length}`,
      )
    } catch (e: any) {
      console.error(
        `❌ LobbyRoom ${this.roomId}: CRITICAL ERROR during onJoin for ${client.sessionId}: ${e.message}`,
        e.stack,
      )
      client.leave(1011, `Server error during join: ${e.message}`)
    }
  }

  onLeave(client: Client, consented: boolean) {
    console.log(
      `👋 LobbyRoom ${this.roomId}: LEAVE ${client.sessionId} (consented: ${consented}). Clients before removal: ${this.clients.length}`,
    )
    try {
      this.removePlayerFromGameSession(client.sessionId)
      this.state.removePlayerFromAllGames(client.sessionId)
      const removed = this.state.removePlayer(client.sessionId)

      if (removed) {
        console.log(
          `🏛️ LobbyRoom ${this.roomId}: Player ${client.sessionId} removed from state. Total players in state: ${this.state.players.size}. Current clients: ${this.clients.length - 1}`,
        )
        this.broadcast("player_left", { playerId: client.sessionId, timestamp: Date.now() })
      } else {
        console.warn(`⚠️ LobbyRoom ${this.roomId}: Player ${client.sessionId} not found in state during onLeave.`)
      }
      this.broadcastLobbyStats()
    } catch (e: any) {
      console.error(
        `❌ LobbyRoom ${this.roomId}: Error during onLeave for ${client.sessionId}: ${e.message}`,
        e.stack,
      )
    }
    console.log(
      `👋 LobbyRoom ${this.roomId}: LEAVE complete for ${client.sessionId}. Current clients: ${this.clients.length}. Total players in state: ${this.state.players.size}`,
    )
  }

  // CORE READINESS LOGIC - Check if all players in game session are ready
  private checkAndStartGameSession() {
    if (!this.gameSession) {
      console.log(`🔍 LobbyRoom: No active game session to check readiness`)
      return
    }

    let allReady = true
    let readyCount = 0
    const totalPlayers = this.gameSession.players.size

    this.gameSession.players.forEach((playerId: string) => {
      const player = this.state.players.get(playerId)
      if (player) {
        if (player.ready) {
          readyCount++
        } else {
          allReady = false
        }
      }
    })

    console.log(`📊 LobbyRoom Game Session: Ready status - ${readyCount}/${totalPlayers} players ready`)

    this.broadcast("lobby_ready_update", {
      readyCount,
      totalPlayers,
      allReady,
      gameType: this.gameSession.gameType,
      sessionPlayers: Array.from(this.gameSession.players),
      timestamp: Date.now(),
    })

    this.broadcastLobbyStats(readyCount)

    if (allReady && totalPlayers >= 2) {
      console.log(`🎉 LobbyRoom: All ${totalPlayers} players are ready! Creating battle room...`)
      this.createBattleRoomForSession()
    } else if (allReady && totalPlayers < 2) {
      console.log(`⚠️ LobbyRoom: All players ready but need at least 2 players (have ${totalPlayers})`)
    } else {
      console.log(`⏳ LobbyRoom: Waiting for more players to be ready (${readyCount}/${totalPlayers})`)
    }
  }

  private async createBattleRoomForSession() {
    if (!this.gameSession) {
      console.error(`❌ LobbyRoom: Cannot create battle room - no active game session`)
      return
    }

    try {
      console.log(`🎮 LobbyRoom: Creating battle room for ${this.gameSession.players.size} ready players`)

      this.gameSession.players.forEach((playerId: string) => {
        const client = this.clients.find((c) => c.sessionId === playerId)
        if (client) {
          client.send("battle_room_creating", {
            message: "Battle room is being created...",
            gameType: this.gameSession.gameType,
            playerCount: this.gameSession.players.size,
            timestamp: Date.now(),
          })
        }
      })

      const battleRoomOptions = {
        roomName: `Battle ${Date.now().toString().substring(8)}`,
        gameMode: "deathmatch",
        mapTheme: "default",
        maxPlayers: 16,
        fromLobby: true,
        lobbyId: this.roomId,
        preReadyPlayers: Array.from(this.gameSession.players),
      }

      console.log(`🎮 LobbyRoom: Battle room options:`, battleRoomOptions)

      this.gameSession.players.forEach((playerId: string) => {
        const client = this.clients.find((c) => c.sessionId === playerId)
        const player = this.state.players.get(playerId)
        if (client && player) {
          console.log(`📤 LobbyRoom: Sending battle room join message to ${player.name}`)
          client.send("join_battle_room", {
            gameType: "battle",
            options: {
              username: player.name,
              fromLobby: true,
              lobbyId: this.roomId,
              characterType: "default",
            },
            timestamp: Date.now(),
          })
        }
      })

      console.log(`🧹 LobbyRoom: Clearing game session after battle room creation`)
      this.gameSession = null

      this.broadcast("game_session_update", {
        gameType: null,
        playerCount: 0,
        players: [],
        timestamp: Date.now(),
      })

      console.log(`✅ LobbyRoom: Battle room creation initiated for ready players`)
    } catch (error) {
      console.error(`❌ LobbyRoom: Failed to create battle room:`, error)

      if (this.gameSession) {
        this.gameSession.players.forEach((playerId: string) => {
          const client = this.clients.find((c) => c.sessionId === playerId)
          if (client) {
            client.send("error", {
              message: "Failed to create battle room. Please try again.",
              timestamp: Date.now(),
            })
          }
        })
      }
    }
  }

  private joinOrCreateGameSession(client: Client, gameType: string) {
    if (!this.gameSession) {
      this.gameSession = {
        gameType: gameType,
        players: new Set(),
        createdAt: Date.now(),
      }
      console.log(`🎮 LobbyRoom: Created new game session for ${gameType}`)
    }

    this.gameSession.players.add(client.sessionId)

    const player = this.state.players.get(client.sessionId)
    if (player) {
      player.ready = false
      console.log(`🔄 LobbyRoom: Reset ready state for ${player.name} when joining session`)
    }

    console.log(
      `🎯 LobbyRoom: Player ${client.sessionId} joined game session (${this.gameSession.players.size} players)`,
    )
    this.broadcast("game_session_update", {
      gameType: this.gameSession.gameType,
      playerCount: this.gameSession.players.size,
      players: Array.from(this.gameSession.players),
      timestamp: Date.now(),
    })

    client.send("joined_game_session", {
      gameType: gameType,
      playerCount: this.gameSession.players.size,
      timestamp: Date.now(),
    })

    this.broadcastLobbyStats()
  }

  private removePlayerFromGameSession(playerId: string) {
    if (!this.gameSession) {
      return
    }

    this.gameSession.players.delete(playerId)

    const player = this.state.players.get(playerId)
    if (player) {
      player.ready = false
      console.log(`🔄 LobbyRoom: Reset ready state for player ${playerId} when leaving session`)
    }

    console.log(
      `🚪 LobbyRoom: Player ${playerId} left game session (${this.gameSession.players.size} players remaining)`,
    )

    if (this.gameSession.players.size === 0) {
      this.gameSession = null
      console.log(`🗑️ LobbyRoom: Game session removed (no players remaining)`)

      this.broadcast("game_session_update", {
        gameType: null,
        playerCount: 0,
        players: [],
        timestamp: Date.now(),
      })

      this.broadcastLobbyStats()
      return
    }

    this.broadcast("game_session_update", {
      gameType: this.gameSession.gameType,
      playerCount: this.gameSession.players.size,
      players: Array.from(this.gameSession.players),
      timestamp: Date.now(),
    })

    this.checkAndStartGameSession()
  }

  private broadcastLobbyStats(readyPlayers?: number) {
    let calculatedReadyPlayers = readyPlayers ?? 0

    if (readyPlayers === undefined) {
      calculatedReadyPlayers = 0
      this.state.players.forEach((player) => {
        if (player.ready) calculatedReadyPlayers++
      })
    }

    this.broadcast("lobby_stats_update", {
      totalPlayers: this.state.players.size,
      readyPlayers: calculatedReadyPlayers,
      gameSessionActive: !!this.gameSession,
      timestamp: Date.now(),
    })
  }

  onDispose() {
    console.log("🏛️ LobbyRoom: Room disposed")
  }

  onError(client: Client, error: any) {
    console.error(`❌ LobbyRoom: Client ${client.sessionId} error:`, error)
  }

  autoDispose = false
}
