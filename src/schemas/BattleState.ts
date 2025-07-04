import { Schema, MapSchema, ArraySchema, type } from "@colyseus/schema"
import { BattlePlayer } from "./BattlePlayer"

// Simple spawn point structure
export class SpawnPoint extends Schema {
  @type("number") x = 0
  @type("number") y = 0
  @type("number") z = 0

  constructor(x = 0, y = 0, z = 0) {
    super()
    this.x = x
    this.y = y
    this.z = z
  }
}

export class BattleState extends Schema {
  @type({ map: BattlePlayer }) players = new MapSchema<BattlePlayer>()
  @type([SpawnPoint]) spawnPoints = new ArraySchema<SpawnPoint>()

  // Map properties (simplified)
  @type("string") mapName = "default"
  @type("string") mapTheme = "default"

  // Game state (simplified for room management)
  @type("boolean") gameStarted = false
  @type("boolean") gameEnded = false
  @type("number") gameStartTime = 0
  @type("number") gameTime = 0
  @type("number") maxGameTime = 300 // 5 minutes
  @type("string") gameMode = "deathmatch"
  @type("boolean") gameActive = true
  @type("number") killLimit = 25
  @type("string") winner = ""
  @type("number") lastUpdate = 0

  constructor() {
    super()
    this.gameTime = 0
    this.gameActive = true
    this.lastUpdate = Date.now()
    this.initializeSpawnPoints()
  }

  private initializeSpawnPoints() {
    // Add default spawn points
    const spawnPositions = [
      { x: 10, y: 0, z: 10 },
      { x: -10, y: 0, z: 10 },
      { x: 10, y: 0, z: -10 },
      { x: -10, y: 0, z: -10 },
      { x: 0, y: 0, z: 15 },
      { x: 0, y: 0, z: -15 },
      { x: 15, y: 0, z: 0 },
      { x: -15, y: 0, z: 0 },
    ]

    spawnPositions.forEach((pos) => {
      const spawnPoint = new SpawnPoint(pos.x, pos.y, pos.z)
      this.spawnPoints.push(spawnPoint)
    })
  }

  addPlayer(sessionId: string, name: string, characterType: string, fromLobby: boolean): BattlePlayer {
    const player = new BattlePlayer()
    player.id = sessionId
    player.sessionId = sessionId
    player.name = name
    player.characterType = characterType
    player.isAlive = true
    player.health = player.maxHealth

    // Set spawn position
    const spawnPoint = this.getRandomSpawnPoint()
    player.setPosition(spawnPoint.x, spawnPoint.y, spawnPoint.z)

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

  getRandomSpawnPoint(): SpawnPoint {
    const randomIndex = Math.floor(Math.random() * this.spawnPoints.length)
    return this.spawnPoints[randomIndex]
  }

  updateGameTime(deltaTime: number) {
    if (this.gameActive) {
      this.gameTime += deltaTime
      if (this.gameTime >= this.maxGameTime) {
        this.endGame()
      }
    }
    this.lastUpdate = Date.now()
  }

  checkWinCondition(): string | null {
    if (!this.gameActive) return this.winner

    // Check kill limit - using for...of loop for proper type inference
    let topPlayer: BattlePlayer | null = null
    let topKills = 0

    for (const [sessionId, player] of this.players) {
      if (player.kills > topKills) {
        topKills = player.kills
        topPlayer = player
      }
    }

    if (topKills >= this.killLimit && topPlayer) {
      this.winner = topPlayer.name
      this.endGame()
      return this.winner
    }

    return null
  }

  endGame() {
    this.gameActive = false
    this.gameEnded = true
    this.lastUpdate = Date.now()

    if (!this.winner) {
      // Find player with most kills - using for...of loop for proper type inference
      let topPlayer: BattlePlayer | null = null
      let topKills = 0

      for (const [sessionId, player] of this.players) {
        if (player.kills > topKills) {
          topKills = player.kills
          topPlayer = player
        }
      }

      this.winner = topPlayer ? topPlayer.name : "No Winner"
    }
  }

  getLeaderboard(): Array<{ name: string; kills: number; deaths: number; score: number }> {
    const leaderboard: Array<{ name: string; kills: number; deaths: number; score: number }> = []

    for (const [sessionId, player] of this.players) {
      leaderboard.push({
        name: player.name,
        kills: player.kills,
        deaths: player.deaths,
        score: player.score,
      })
    }

    // Sort by kills, then by score
    return leaderboard.sort((a, b) => {
      if (a.kills !== b.kills) {
        return b.kills - a.kills
      }
      return b.score - a.score
    })
  }

  getAlivePlayers(): BattlePlayer[] {
    const alivePlayers: BattlePlayer[] = []
    for (const [sessionId, player] of this.players) {
      if (player.isAlive) {
        alivePlayers.push(player)
      }
    }
    return alivePlayers
  }

  respawnPlayer(sessionId: string): boolean {
    const player = this.players.get(sessionId)
    if (player && !player.isAlive) {
      const spawnPoint = this.getRandomSpawnPoint()
      player.setPosition(spawnPoint.x, spawnPoint.y, spawnPoint.z)
      player.respawn()
      this.lastUpdate = Date.now()
      return true
    }
    return false
  }

  // Simple ability usage without complex logic
  usePlayerAbility(sessionId: string, abilityType: string): boolean {
    const player = this.players.get(sessionId)
    if (player && player.isAlive && player.canUseAbility(abilityType)) {
      player.setAbilityCooldown(abilityType)
      console.log(`Player ${player.name} used ability: ${abilityType}`)
      this.lastUpdate = Date.now()
      return true
    }
    return false
  }
}
