import { Schema, MapSchema, ArraySchema, type } from "@colyseus/schema"
import { Player } from "./Player"

export class GameLobby extends Schema {
  @type("string") id = ""
  @type("string") gameType = ""
  @type("string") gameName = ""
  @type("number") maxPlayers = 8
  @type("string") creatorId = ""
  @type("number") createdAt = 0
  @type([Player]) players = new ArraySchema<Player>()

  constructor() {
    super()
    this.createdAt = Date.now()
  }

  addPlayer(player: Player): boolean {
    if (this.players.length < this.maxPlayers) {
      this.players.push(player)
      return true
    }
    return false
  }

  removePlayer(sessionId: string): boolean {
    const index = this.players.findIndex((p) => p.sessionId === sessionId)
    if (index !== -1) {
      this.players.splice(index, 1)
      return true
    }
    return false
  }

  isFull(): boolean {
    return this.players.length >= this.maxPlayers
  }

  isEmpty(): boolean {
    return this.players.length === 0
  }
}

export class LobbyState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>()
  @type([GameLobby]) availableGames = new ArraySchema<GameLobby>()

  // Lobby settings
  @type("string") lobbyName = ""
  @type("string") gameType = "battle"
  @type("string") gameMode = "deathmatch"
  @type("string") mapTheme = "default"
  @type("number") maxPlayers = 8
  @type("boolean") isPublic = true
  @type("string") hostId = ""

  // Game state
  @type("boolean") gameStarted = false
  @type("boolean") countdownActive = false
  @type("number") countdown = 0
  @type("number") lastUpdate = 0

  constructor() {
    super()
    this.lastUpdate = Date.now()
  }

  // Player management
  addPlayer(sessionId: string, name: string, characterType: string): Player {
    const player = new Player()
    player.id = sessionId
    player.sessionId = sessionId
    player.name = name
    player.characterType = characterType
    player.ready = false
    player.selectedGameType = this.gameType

    this.players.set(sessionId, player)
    this.lastUpdate = Date.now()
    return player
  }

  removePlayer(sessionId: string): boolean {
    if (this.players.has(sessionId)) {
      this.players.delete(sessionId)
      this.lastUpdate = Date.now()
      return true
    }
    return false
  }

  getPlayer(sessionId: string): Player | undefined {
    return this.players.get(sessionId)
  }

  getAllPlayers(): Player[] {
    const playerList: Player[] = []
    this.players.forEach((player) => {
      playerList.push(player)
    })
    return playerList
  }

  getPlayerCount(): number {
    return this.players.size
  }

  // Ready system
  getReadyPlayers(): Player[] {
    const readyPlayers: Player[] = []
    this.players.forEach((player) => {
      if (player.ready) {
        readyPlayers.push(player)
      }
    })
    return readyPlayers
  }

  areAllPlayersReady(): boolean {
    if (this.players.size === 0) return false

    let allReady = true
    this.players.forEach((player) => {
      if (!player.ready) {
        allReady = false
      }
    })
    return allReady
  }

  canStartGame(): boolean {
    return this.getPlayerCount() >= 2 && this.areAllPlayersReady()
  }

  // Game settings
  setGameType(gameType: string) {
    this.gameType = gameType
    this.lastUpdate = Date.now()
  }

  setGameMode(gameMode: string) {
    this.gameMode = gameMode
    this.lastUpdate = Date.now()
  }

  setMapTheme(mapTheme: string) {
    this.mapTheme = mapTheme
    this.lastUpdate = Date.now()
  }

  // Countdown system
  startCountdown(seconds: number) {
    this.countdownActive = true
    this.countdown = seconds
    this.lastUpdate = Date.now()
  }

  updateCountdown(): boolean {
    if (!this.countdownActive) return false

    this.countdown--
    this.lastUpdate = Date.now()

    if (this.countdown <= 0) {
      this.countdownActive = false
      return true // Countdown finished
    }
    return false
  }

  resetCountdown() {
    this.countdownActive = false
    this.countdown = 0
    this.lastUpdate = Date.now()
  }

  // Game state
  startGame() {
    this.gameStarted = true
    this.countdownActive = false
    this.countdown = 0
    this.lastUpdate = Date.now()
  }

  resetGame() {
    this.gameStarted = false
    this.countdownActive = false
    this.countdown = 0

    // Reset all players ready state
    this.players.forEach((player) => {
      player.setReady(false)
    })

    this.lastUpdate = Date.now()
  }

  // Game lobby management
  createGame(gameId: string, gameType: string, gameName: string, maxPlayers: number, creatorId: string): GameLobby {
    const gameLobby = new GameLobby()
    gameLobby.id = gameId
    gameLobby.gameType = gameType
    gameLobby.gameName = gameName
    gameLobby.maxPlayers = maxPlayers
    gameLobby.creatorId = creatorId

    this.availableGames.push(gameLobby)
    this.lastUpdate = Date.now()
    return gameLobby
  }

  removeGame(gameId: string): boolean {
    const index = this.availableGames.findIndex((game) => game.id === gameId)
    if (index !== -1) {
      this.availableGames.splice(index, 1)
      this.lastUpdate = Date.now()
      return true
    }
    return false
  }

  addPlayerToGame(gameId: string, player: Player): boolean {
    const game = this.availableGames.find((g) => g.id === gameId)
    if (game && !game.isFull()) {
      return game.addPlayer(player)
    }
    return false
  }

  removePlayerFromGame(gameId: string, sessionId: string): boolean {
    const game = this.availableGames.find((g) => g.id === gameId)
    if (game) {
      return game.removePlayer(sessionId)
    }
    return false
  }

  getActiveLobbiesByGameType(gameType: string): any[] {
    const lobbies: any[] = []
    this.availableGames.forEach((game) => {
      if (game.gameType === gameType) {
        lobbies.push({
          id: game.id,
          gameType: game.gameType,
          gameName: game.gameName,
          playerCount: game.players.length,
          maxPlayers: game.maxPlayers,
          creatorId: game.creatorId,
          createdAt: game.createdAt,
        })
      }
    })
    return lobbies
  }

  getAllActiveLobbies(): any[] {
    const lobbies: any[] = []
    this.availableGames.forEach((game) => {
      lobbies.push({
        id: game.id,
        gameType: game.gameType,
        gameName: game.gameName,
        playerCount: game.players.length,
        maxPlayers: game.maxPlayers,
        creatorId: game.creatorId,
        createdAt: game.createdAt,
      })
    })
    return lobbies
  }

  cleanupStaleGames() {
    const now = Date.now()
    const staleThreshold = 5 * 60 * 1000 // 5 minutes

    // Remove games that are older than threshold and empty
    for (let i = this.availableGames.length - 1; i >= 0; i--) {
      const game = this.availableGames[i]
      if (game.isEmpty() && now - game.createdAt > staleThreshold) {
        this.availableGames.splice(i, 1)
      }
    }

    this.lastUpdate = Date.now()
  }

  // Statistics
  getLobbyStats() {
    return {
      totalPlayers: this.getPlayerCount(),
      readyPlayers: this.getReadyPlayers().length,
      gameType: this.gameType,
      gameMode: this.gameMode,
      mapTheme: this.mapTheme,
      canStartGame: this.canStartGame(),
      countdownActive: this.countdownActive,
      countdown: this.countdown,
      gameStarted: this.gameStarted,
      availableGames: this.availableGames.length,
    }
  }
}
