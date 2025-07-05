import { Schema, MapSchema, type } from "@colyseus/schema"
import { BattlePlayer } from "./BattlePlayer"

export class BattleState extends Schema {
  @type({ map: BattlePlayer }) players = new MapSchema<BattlePlayer>()
  @type("string") gameMode = "deathmatch"
  @type("string") mapTheme = "default"
  @type("number") maxPlayers = 8
  @type("number") timeLimit = 300 // 5 minutes in seconds
  @type("number") scoreLimit = 25
  @type("boolean") gameStarted = false
  @type("boolean") gameEnded = false
  @type("number") gameStartTime = 0
  @type("number") gameEndTime = 0
  @type("string") winner = ""
  @type("number") lastUpdate = 0

  constructor() {
    super()
    this.lastUpdate = Date.now()
  }

  addPlayer(sessionId: string, name: string, characterType: string): BattlePlayer {
    const player = new BattlePlayer()
    player.sessionId = sessionId
    player.name = name
    player.characterType = characterType
    player.ready = false

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

  getPlayer(sessionId: string): BattlePlayer | undefined {
    return this.players.get(sessionId)
  }

  getAllPlayers(): BattlePlayer[] {
    const playerList: BattlePlayer[] = []
    this.players.forEach((player) => {
      playerList.push(player)
    })
    return playerList
  }

  getPlayerCount(): number {
    return this.players.size
  }

  getAlivePlayers(): BattlePlayer[] {
    const alivePlayers: BattlePlayer[] = []
    this.players.forEach((player) => {
      if (player.isAlive) {
        alivePlayers.push(player)
      }
    })
    return alivePlayers
  }

  getReadyPlayers(): BattlePlayer[] {
    const readyPlayers: BattlePlayer[] = []
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

  startGame() {
    this.gameStarted = true
    this.gameStartTime = Date.now()
    this.lastUpdate = Date.now()
  }

  endGame(winner?: string) {
    this.gameEnded = true
    this.gameEndTime = Date.now()
    if (winner) {
      this.winner = winner
    }
    this.lastUpdate = Date.now()
  }

  resetGame() {
    this.gameStarted = false
    this.gameEnded = false
    this.gameStartTime = 0
    this.gameEndTime = 0
    this.winner = ""

    // Reset all players
    this.players.forEach((player) => {
      player.health = player.maxHealth
      player.isAlive = true
      player.ready = false
      player.score = 0
      player.kills = 0
      player.deaths = 0
    })

    this.lastUpdate = Date.now()
  }

  getLeaderboard(): BattlePlayer[] {
    const players = this.getAllPlayers()
    return players.sort((a, b) => b.score - a.score)
  }

  checkWinConditions(): string | null {
    if (!this.gameStarted || this.gameEnded) return null

    // Check score limit
    const topPlayer = this.getLeaderboard()[0]
    if (topPlayer && topPlayer.score >= this.scoreLimit) {
      return topPlayer.name
    }

    // Check time limit
    const elapsedTime = (Date.now() - this.gameStartTime) / 1000
    if (elapsedTime >= this.timeLimit) {
      return topPlayer ? topPlayer.name : "Time's up!"
    }

    return null
  }

  getRemainingTime(): number {
    if (!this.gameStarted) return this.timeLimit

    const elapsedTime = (Date.now() - this.gameStartTime) / 1000
    return Math.max(0, this.timeLimit - elapsedTime)
  }

  getGameStats() {
    return {
      totalPlayers: this.getPlayerCount(),
      alivePlayers: this.getAlivePlayers().length,
      readyPlayers: this.getReadyPlayers().length,
      gameMode: this.gameMode,
      mapTheme: this.mapTheme,
      gameStarted: this.gameStarted,
      gameEnded: this.gameEnded,
      remainingTime: this.getRemainingTime(),
      winner: this.winner,
      leaderboard: this.getLeaderboard().slice(0, 5), // Top 5 players
    }
  }
}
