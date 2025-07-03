import { Schema, MapSchema, type } from "@colyseus/schema"
import { BattlePlayer } from "./BattlePlayer"

export class BattleState extends Schema {
  @type({ map: BattlePlayer }) players = new MapSchema<BattlePlayer>()

  // Game state (simplified)
  @type("boolean") gameStarted = false
  @type("boolean") gameEnded = false
  @type("number") gameStartTime = 0
  @type("number") gameEndTime = 0
  @type("string") gameMode = "deathmatch"
  @type("boolean") gameActive = false
  @type("number") killLimit = 25
  @type("string") winner = ""
  @type("number") lastUpdate = 0

  // Room settings
  @type("string") roomName = ""
  @type("number") maxPlayers = 16
  @type("number") minPlayersToStart = 2

  constructor() {
    super()
    this.gameActive = false
    this.lastUpdate = Date.now()
  }

  // Player management
  addPlayer(sessionId: string, name: string, characterType: string): BattlePlayer {
    const player = new BattlePlayer()
    player.id = sessionId
    player.sessionId = sessionId
    player.name = name
    player.characterType = characterType
    player.joinBattle()

    this.players.set(sessionId, player)
    this.lastUpdate = Date.now()
    return player
  }

  removePlayer(sessionId: string): boolean {
    const player = this.players.get(sessionId)
    if (player) {
      player.leaveBattle()
      this.players.delete(sessionId)
      this.lastUpdate = Date.now()
      return true
    }
    return false
  }

  // Game state management
  startGame() {
    this.gameStarted = true
    this.gameActive = true
    this.gameStartTime = Date.now()
    this.lastUpdate = Date.now()

    // Set all players as in battle
    this.players.forEach((player) => {
      player.joinBattle()
    })
  }

  endGame(winner?: string) {
    this.gameActive = false
    this.gameEnded = true
    this.gameEndTime = Date.now()
    this.winner = winner || this.findWinner()
    this.lastUpdate = Date.now()

    // Update match statistics
    this.players.forEach((player) => {
      player.matchesPlayed++
      if (player.name === this.winner) {
        player.matchesWon++
      }
    })
  }

  private findWinner(): string {
    let topPlayer: BattlePlayer | null = null
    let topScore = 0

    this.players.forEach((player) => {
      if (player.score > topScore) {
        topScore = player.score
        topPlayer = player
      }
    })

    return topPlayer?.name || "No Winner"
  }

  // Check if game should start
  canStartGame(): boolean {
    const playerCount = this.players.size
    const readyCount = this.getReadyPlayerCount()
    return playerCount >= this.minPlayersToStart && readyCount === playerCount && !this.gameStarted
  }

  // Check win condition
  checkWinCondition(): string | null {
    if (!this.gameActive) return this.winner

    // Check kill limit
    let topPlayer: BattlePlayer | null = null
    let topKills = 0

    this.players.forEach((player) => {
      if (player.kills > topKills) {
        topKills = player.kills
        topPlayer = player
      }
    })

    if (topKills >= this.killLimit && topPlayer) {
      this.endGame(topPlayer.name)
      return this.winner
    }

    return null
  }

  getLeaderboard(): Array<{ name: string; kills: number; deaths: number; score: number }> {
    const leaderboard: Array<{ name: string; kills: number; deaths: number; score: number }> = []

    this.players.forEach((player) => {
      leaderboard.push({
        name: player.name,
        kills: player.kills,
        deaths: player.deaths,
        score: player.score,
      })
    })

    // Sort by score, then by kills
    return leaderboard.sort((a, b) => {
      if (a.score !== b.score) {
        return b.score - a.score
      }
      return b.kills - a.kills
    })
  }

  getReadyPlayerCount(): number {
    let readyCount = 0
    this.players.forEach((player) => {
      if (player.ready) {
        readyCount++
      }
    })
    return readyCount
  }

  getAllPlayers(): BattlePlayer[] {
    const players: BattlePlayer[] = []
    this.players.forEach((player) => {
      players.push(player)
    })
    return players
  }

  getPlayerCount(): number {
    return this.players.size
  }

  // Reset game state for new match
  resetGame() {
    this.gameStarted = false
    this.gameEnded = false
    this.gameActive = false
    this.winner = ""
    this.gameStartTime = 0
    this.gameEndTime = 0
    this.lastUpdate = Date.now()

    // Reset player states
    this.players.forEach((player) => {
      player.kills = 0
      player.deaths = 0
      player.score = 0
      player.isAlive = true
      player.ready = false
    })
  }
}
