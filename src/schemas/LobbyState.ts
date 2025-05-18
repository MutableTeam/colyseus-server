import { Schema, MapSchema, type } from "@colyseus/schema"
import { Player } from "./Player"

export class GameListing extends Schema {
  @type("string") id: string
  @type("string") type: string
  @type("string") name: string
  @type("number") maxPlayers: number
  @type("number") currentPlayers = 0
  @type("string") creatorId: string
  @type("number") createdAt: number = Date.now()
  @type("boolean") locked = false
  @type({ map: "string" }) playerIds = new MapSchema<string>()
}

export class LobbyState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>()
  @type({ map: GameListing }) availableGames = new MapSchema<GameListing>()

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
      const playerIdsArray = Array.from(game.playerIds.keys()) as string[];
      if (playerIdsArray.length > 0) {
        game.creatorId = playerIdsArray[0];
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
    const player = new Player()
    player.id = id
    player.name = name
    this.players.set(id, player)
    return player
  }

  removePlayer(id: string) {
    if (this.players.has(id)) {
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
}
