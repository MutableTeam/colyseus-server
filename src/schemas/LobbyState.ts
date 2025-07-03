import { Schema, MapSchema, type } from "@colyseus/schema"
import { GameListing } from "./GameListing"

export class LobbyPlayer extends Schema {
  @type("string") sessionId: string
  @type("string") username: string
  @type("boolean") isReady = false
  @type("string") selectedGameType: string | null = null
  @type("number") joinedAt: number
}

export class LobbyState extends Schema {
  @type({ map: LobbyPlayer }) players = new MapSchema<LobbyPlayer>()
  @type({ map: GameListing }) availableGames = new MapSchema<GameListing>()
  @type("number") totalPlayers = 0
  @type("number") readyPlayers = 0
  @type("boolean") gameSessionActive = false
  @type("string") gameSessionType: string | null = null

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

  addPlayer(id: string, name: string) {
    const player = new LobbyPlayer()
    player.sessionId = id
    player.username = name
    player.joinedAt = Date.now()
    this.players.set(id, player)
    this.totalPlayers++
    if (player.isReady) {
      this.readyPlayers++
    }
    return player
  }

  removePlayer(id: string) {
    if (this.players.has(id)) {
      const player = this.players.get(id)
      if (player && player.isReady) {
        this.readyPlayers--
      }
      this.players.delete(id)
      this.totalPlayers--
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
