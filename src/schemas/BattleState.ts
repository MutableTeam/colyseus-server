import { Schema, MapSchema, ArraySchema, type } from "@colyseus/schema"
import { Player } from "./Player"
import { Projectile } from "./Projectile"
import { Vector3D } from "./Vector3D"

// Define map objects for Three.js environment
export class MapObject extends Schema {
  @type("string") id = ""
  @type("string") type = "" // Type of object (wall, platform, etc.)
  @type(Vector3D) position = new Vector3D()
  @type(Vector3D) scale = new Vector3D(1, 1, 1)
  @type("number") rotation = 0 // Simple Y-axis rotation for static objects
}

export class BattleState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>()
  @type({ map: Projectile }) projectiles = new MapSchema<Projectile>()
  @type([MapObject]) mapObjects = new ArraySchema<MapObject>()

  // Map dimensions and properties
  @type("number") mapWidth = 100
  @type("number") mapLength = 100
  @type("number") mapHeight = 50
  @type("string") mapTheme = "default" // For different visual themes
  @type("number") gravity = 9.8 // World gravity

  // Game state
  @type("boolean") gameStarted = false
  @type("boolean") gameEnded = false
  @type("number") gameStartTime = 0
  @type("number") gameEndTime = 0
  @type("number") gameTime = 0
  @type("number") maxGameTime = 600 // 10 minutes in seconds
  @type("string") gameMode = "deathmatch" // deathmatch, teamDeathmatch, captureTheFlag, etc.
  @type("string") mapName = "default"
  @type("boolean") gameActive = true
  @type("number") killLimit = 25
  @type("string") winner = ""
  @type({ array: Vector3D }) spawnPoints = new ArraySchema<Vector3D>()
  @type("number") lastUpdate = 0

  constructor(mapWidth = 100, mapLength = 100, mapHeight = 50) {
    super()
    this.mapWidth = mapWidth
    this.mapLength = mapLength
    this.mapHeight = mapHeight
    this.gameTime = 0
    this.gameActive = true
    this.lastUpdate = Date.now()
    this.initializeSpawnPoints()
  }

  private initializeSpawnPoints() {
    // Add default spawn points for the battle arena
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
      const spawnPoint = new Vector3D()
      spawnPoint.x = pos.x
      spawnPoint.y = pos.y
      spawnPoint.z = pos.z
      this.spawnPoints.push(spawnPoint)
    })
  }

  addPlayer(sessionId: string, name: string): Player {
    const player = new Player()
    player.id = sessionId
    player.sessionId = sessionId
    player.name = name
    player.isAlive = true
    player.health = player.maxHealth

    // Set spawn position
    const spawnPoint = this.getRandomSpawnPoint()
    player.position.x = spawnPoint.x
    player.position.y = spawnPoint.y
    player.position.z = spawnPoint.z

    this.players.set(sessionId, player)
    return player
  }

  removePlayer(sessionId: string): boolean {
    if (this.players.has(sessionId)) {
      this.players.delete(sessionId)
      return true
    }
    return false
  }

  createProjectile(
    id: string,
    ownerId: string,
    position: Vector3D | { x: number; y: number; z: number },
    direction: Vector3D | { x: number; y: number; z: number },
    speed = 50,
    damage = 25,
  ): Projectile {
    const projectile = new Projectile()
    projectile.id = id
    projectile.ownerId = ownerId

    // Handle both Vector3D and plain objects
    if (position instanceof Vector3D) {
      projectile.position.x = position.x
      projectile.position.y = position.y
      projectile.position.z = position.z
    } else {
      projectile.position.x = position.x
      projectile.position.y = position.y
      projectile.position.z = position.z
    }

    if (direction instanceof Vector3D) {
      projectile.direction.x = direction.x
      projectile.direction.y = direction.y
      projectile.direction.z = direction.z
    } else {
      projectile.setDirection(direction.x, direction.y, direction.z)
    }

    projectile.speed = speed
    projectile.damage = damage
    projectile.isActive = true

    this.projectiles.set(id, projectile)
    return projectile
  }

  removeProjectile(id: string): boolean {
    if (this.projectiles.has(id)) {
      this.projectiles.delete(id)
      return true
    }
    return false
  }

  getRandomSpawnPoint(): Vector3D {
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

    // Check kill limit
    let topPlayer: Player | null = null
    let topKills = 0

    // Use Array.from to convert MapSchema to array for proper iteration
    Array.from(this.players.values()).forEach((player: Player) => {
      if (player.kills > topKills) {
        topKills = player.kills
        topPlayer = player
      }
    })

    if (topKills >= this.killLimit && topPlayer) {
      this.winner = topPlayer.name
      this.endGame()
      return this.winner
    }

    return null
  }

  endGame() {
    this.gameActive = false
    if (!this.winner) {
      // Find player with most kills
      let topPlayer: Player | null = null
      let topKills = 0

      // Use Array.from to convert MapSchema to array for proper iteration
      Array.from(this.players.values()).forEach((player: Player) => {
        if (player.kills > topKills) {
          topKills = player.kills
          topPlayer = player
        }
      })

      this.winner = topPlayer?.name || "No Winner"
    }
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

    // Sort by kills, then by score
    return leaderboard.sort((a, b) => {
      if (a.kills !== b.kills) {
        return b.kills - a.kills
      }
      return b.score - a.score
    })
  }

  getAlivePlayers(): Player[] {
    const alivePlayers: Player[] = []
    this.players.forEach((player) => {
      if (player.isAlive) {
        alivePlayers.push(player)
      }
    })
    return alivePlayers
  }

  respawnPlayer(sessionId: string): boolean {
    const player = this.players.get(sessionId)
    if (player && !player.isAlive) {
      const spawnPoint = this.getRandomSpawnPoint()
      player.position.x = spawnPoint.x
      player.position.y = spawnPoint.y
      player.position.z = spawnPoint.z
      player.respawn()
      return true
    }
    return false
  }

  // Added missing usePlayerAbility method
  usePlayerAbility(sessionId: string, abilityType: string): boolean {
    const player = this.players.get(sessionId)
    if (player && player.isAlive) {
      // Implement actual ability logic and cooldowns here
      // For now, just return true to simulate success
      console.log(`Player ${player.name} used ability: ${abilityType}`)
      return true
    }
    return false
  }

  // Update all projectiles
  updateProjectiles(deltaTime: number) {
    this.projectiles.forEach((projectile) => {
      projectile.update(deltaTime)
    })
  }

  // Get all active projectiles
  getActiveProjectiles(): Projectile[] {
    const activeProjectiles: Projectile[] = []
    this.projectiles.forEach((projectile) => {
      if (projectile.isActive) {
        activeProjectiles.push(projectile)
      }
    })
    return activeProjectiles
  }

  // Clean up inactive projectiles
  cleanupProjectiles() {
    const toRemove: string[] = []
    this.projectiles.forEach((projectile, id) => {
      if (!projectile.isActive) {
        toRemove.push(id)
      }
    })

    toRemove.forEach((id) => {
      this.removeProjectile(id)
    })
  }
}
