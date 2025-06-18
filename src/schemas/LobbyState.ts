import { Schema, MapSchema, type } from "@colyseus/schema"
import { GameListing } from "./GameListing"

// Add a new schema for lobby players with ready state
export class LobbyPlayer extends Schema {
  @type("string") id = ""
  @type("string") name = ""
  @type("string") characterType = "default"
  @type("boolean") ready = false
  @type("number") joinedAt = 0
  @type("string") selectedGameType = ""
}

// Add a new schema for game sessions (ready groups)
export class GameSession extends Schema {
  @type("string") id = ""
  @type("string") gameType = ""
  @type("string") sessionName = ""
  @type("number") maxPlayers = 16
  @type("number") currentPlayers = 0
  @type({ map: LobbyPlayer }) players = new MapSchema<LobbyPlayer>()
  @type("boolean") allReady = false
  @type("string") status = "waiting" // waiting, ready, starting, started
  @type("number") createdAt = Date.now()
  @type("string") battleRoomId = ""
}

export class LobbyState extends Schema {
  @type({ map: LobbyPlayer }) players = new MapSchema<LobbyPlayer>()
  @type({ map: GameListing }) availableGames = new MapSchema<GameListing>()
  @type({ map: GameSession }) gameSessions = new MapSchema<GameSession>()

  createGame(id: string, type: string, name: string, maxPlayers: number, creatorId: string) {
    const game = new GameListing()
    game.id = id
    game.type = type
    game.name = name
    game.maxPlayers = maxPlayers
    game.creatorId = creatorId
    game.playerIds.set(creatorId, creatorId)
    game.currentPlayers = 1

    this.availableGames.set(id, game)
    return game
  }

  addPlayerToGame(gameId: string, playerId: string) {
    const game = this.availableGames.get(gameId)
    if (game && game.currentPlayers < game.maxPlayers && !game.locked) {
      game.playerIds.set(playerId, playerId)
      game.currentPlayers++
      return true
    }
    return false
  }

  removePlayerFromGame(gameId: string, playerId: string) {
    const game = this.availableGames.get(gameId)
    if (game && game.playerIds.has(playerId)) {
      game.playerIds.delete(playerId)
      game.currentPlayers--

      // If game is empty, remove it
      if (game.currentPlayers === 0) {
        this.availableGames.delete(gameId)
      }
      // If creator left, assign a new creator
      else if (playerId === game.creatorId) {
        // Get the keys as an array of strings
        const playerIdsArray = Array.from(game.playerIds.keys()) as string[]
        if (playerIdsArray.length > 0) {
          game.creatorId = playerIdsArray[0]
        }
      }

      return true
    }
    return false
  }

  removePlayerFromAllGames(playerId: string) {
    this.availableGames.forEach((game, gameId) => {
      if (game.playerIds.has(playerId)) {
        this.removePlayerFromGame(gameId, playerId)
      }
    })
  }

  createGameSession(
    sessionId: string,
    gameType: string,
    sessionName: string,
    maxPlayers: number,
    creatorId: string,
  ): GameSession {
    const session = new GameSession()
    session.id = sessionId
    session.gameType = gameType
    session.sessionName = sessionName
    session.maxPlayers = maxPlayers
    session.createdAt = Date.now()

    // Add creator to the session
    const creator = this.players.get(creatorId)
    if (creator) {
      session.players.set(creatorId, creator)
      session.currentPlayers = 1
      creator.selectedGameType = gameType
    }

    this.gameSessions.set(sessionId, session)
    return session
  }

  joinGameSession(sessionId: string, playerId: string): boolean {
    const session = this.gameSessions.get(sessionId)
    const player = this.players.get(playerId)

    if (session && player && session.currentPlayers < session.maxPlayers && session.status === "waiting") {
      session.players.set(playerId, player)
      session.currentPlayers++
      player.selectedGameType = session.gameType
      return true
    }
    return false
  }

  leaveGameSession(sessionId: string, playerId: string): boolean {
    const session = this.gameSessions.get(sessionId)

    if (session && session.players.has(playerId)) {
      session.players.delete(playerId)
      session.currentPlayers--

      // Reset player state
      const player = this.players.get(playerId)
      if (player) {
        player.ready = false
        player.selectedGameType = ""
      }

      // Remove session if empty
      if (session.currentPlayers === 0) {
        this.gameSessions.delete(sessionId)
      } else {
        // Recalculate ready state
        this.updateSessionReadyState(session)
      }

      return true
    }
    return false
  }

  setPlayerReady(playerId: string, ready: boolean): GameSession | null {
    const player = this.players.get(playerId)
    if (!player) return null

    player.ready = ready

    // Find the session this player is in
    let playerSession: GameSession | null = null
    this.gameSessions.forEach((session) => {
      if (session.players.has(playerId)) {
        playerSession = session
      }
    })

    if (playerSession) {
      this.updateSessionReadyState(playerSession)
    }

    return playerSession
  }

  private updateSessionReadyState(session: GameSession) {
    let allReady = true
    let readyCount = 0

    session.players.forEach((player) => {
      if (player.ready) {
        readyCount++
      } else {
        allReady = false
      }
    })

    session.allReady = allReady && session.currentPlayers >= 2 // Need at least 2 players

    if (session.allReady && session.status === "waiting") {
      session.status = "ready"
    } else if (!session.allReady && session.status === "ready") {
      session.status = "waiting"
    }
  }

  addPlayer(id: string, name: string): LobbyPlayer {
    const player = new LobbyPlayer()
    player.id = id
    player.name = name
    player.joinedAt = Date.now()
    player.ready = false
    this.players.set(id, player)
    return player
  }

  removePlayer(id: string): boolean {
    if (this.players.has(id)) {
      // Remove from any game sessions
      this.gameSessions.forEach((session, sessionId) => {
        if (session.players.has(id)) {
          this.leaveGameSession(sessionId, id)
        }
      })

      this.players.delete(id)
      return true
    }
    return false
  }

  cleanupStaleGames() {
    const now = Date.now()
    const staleThreshold = 30 * 60 * 1000 // 30 minutes

    this.availableGames.forEach((game, gameId) => {
      if (now - game.createdAt > staleThreshold) {
        this.availableGames.delete(gameId)
      }
    })
  }

  getActiveLobbiesByGameType(gameType: string) {
    const activeLobbies: GameListing[] = []

    this.availableGames.forEach((game) => {
      // Check if the game matches the requested type and isn't locked
      if (game.type === gameType && !game.locked && game.currentPlayers < game.maxPlayers) {
        activeLobbies.push(game)
      }
    })

    // Sort by creation time (newest first)
    return activeLobbies.sort((a, b) => b.createdAt - a.createdAt)
  }

  getAllActiveLobbies() {
    const activeLobbies: GameListing[] = []

    this.availableGames.forEach((game) => {
      // Only include games that aren't locked and have space
      if (!game.locked && game.currentPlayers < game.maxPlayers) {
        activeLobbies.push(game)
      }
    })

    // Sort by creation time (newest first)
    return activeLobbies.sort((a, b) => b.createdAt - a.createdAt)
  }
}
