import { Schema, MapSchema, type } from "@colyseus/schema"
import { Player } from "./Player"
import { GameListing } from "./GameListing"

export class LobbyState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>()
  @type({ map: GameListing }) availableGames = new MapSchema<GameListing>()
  @type("number") totalPlayers = 0
  @type("number") readyPlayers = 0
  @type("boolean") gameSessionActive = false
  @type("string") gameSessionType = ""
  @type("number") lastUpdated = 0

  constructor() {
    super()
    this.lastUpdated = Date.now()
  }

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
    this.updateStats()
    return game
  }

  addPlayerToGame(gameId: string, playerId: string) {
    const game = this.availableGames.get(gameId)
    if (game && game.currentPlayers < game.maxPlayers && !game.locked) {
      game.playerIds.set(playerId, playerId)
      game.currentPlayers++
      this.updateStats()
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
        const playerIdsArray = Array.from(game.playerIds.keys()) as string[]
        if (playerIdsArray.length > 0) {
          game.creatorId = playerIdsArray[0]
        }
      }

      this.updateStats()
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

  // Updated addPlayer to accept sessionId as optional third argument
  addPlayer(id: string, name: string, sessionId?: string) {
    const player = new Player()
    player.id = id
    player.name = name
    player.sessionId = sessionId || id
    player.ready = false
    this.players.set(id, player)
    this.updateStats()
    return player
  }

  removePlayer(id: string) {
    if (this.players.has(id)) {
      this.players.delete(id)
      this.updateStats()
      return true
    }
    return false
  }

  updateStats() {
    this.totalPlayers = this.players.size
    this.readyPlayers = 0

    this.players.forEach((player) => {
      if (player.ready) {
        this.readyPlayers++
      }
    })

    this.lastUpdated = Date.now()
  }

  cleanupStaleGames() {
    const now = Date.now()
    const staleThreshold = 30 * 60 * 1000 // 30 minutes

    this.availableGames.forEach((game, gameId) => {
      if (now - game.createdAt > staleThreshold) {
        this.availableGames.delete(gameId)
      }
    })

    this.updateStats()
  }

  getActiveLobbiesByGameType(gameType: string) {
    const activeLobbies: GameListing[] = []

    this.availableGames.forEach((game) => {
      if (game.type === gameType && !game.locked && game.currentPlayers < game.maxPlayers) {
        activeLobbies.push(game)
      }
    })

    return activeLobbies.sort((a, b) => b.createdAt - a.createdAt)
  }

  getAllActiveLobbies() {
    const activeLobbies: GameListing[] = []

    this.availableGames.forEach((game) => {
      if (!game.locked && game.currentPlayers < game.maxPlayers) {
        activeLobbies.push(game)
      }
    })

    return activeLobbies.sort((a, b) => b.createdAt - a.createdAt)
  }

  getReadyPlayers(): Player[] {
    const readyPlayers: Player[] = []
    this.players.forEach((player) => {
      if (player.ready) {
        readyPlayers.push(player)
      }
    })
    return readyPlayers
  }

  getPlayersByGameType(gameType: string): Player[] {
    const players: Player[] = []
    this.players.forEach((player) => {
      if (player.selectedGameType === gameType) {
        players.push(player)
      }
    })
    return players
  }
}
