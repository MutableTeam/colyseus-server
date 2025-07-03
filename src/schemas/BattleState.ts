import { Schema, MapSchema, ArraySchema, type } from "@colyseus/schema"
import { BattlePlayer } from "./BattlePlayer"
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
  @type({ map: Projectile }) projectiles = new MapSchema<Projectile>()
  @type([MapObject]) mapObjects = new ArraySchema<MapObject>()

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
  @type([SpawnPoint]) spawnPoints = new ArraySchema<SpawnPoint>()
  @type("number") lastUpdate = 0

  constructor(mapWidth = 100, mapLength = 100, mapHeight = 50) {
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

  // Fixed method name to match usage in BattleRoom
  addProjectile(
    playerId: string,
    position: Vector3D | { x: number; y: number; z: number },
    direction: Vector3D | { x: number; y: number; z: number },
    weaponType: string,
  ): Projectile {
    const projectile = new Projectile()
    projectile.id = `${playerId}_${Date.now()}`
    projectile.ownerId = playerId
    projectile.playerId = playerId
    projectile.weaponType = weaponType

    // Handle both Vector3D and plain objects for position
    if (position instanceof Vector3D) {
      projectile.position.x = position.x
      projectile.position.y = position.y
      projectile.position.z = position.z
    } else {
      projectile.position.x = position.x
      projectile.position.y = position.y
      projectile.position.z = position.z
    }

    // Handle both Vector3D and plain objects for direction
    if (direction instanceof Vector3D) {
      projectile.setDirection(direction.x, direction.y, direction.z)
    } else {
      projectile.setDirection(direction.x, direction.y, direction.z)
    }

    // Set weapon-specific properties
    switch (weaponType) {
      case "rifle":
        projectile.speed = 50
        projectile.damage = 25
        projectile.lifetime = 3
        break
      case "pistol":
        projectile.speed = 40
        projectile.damage = 20
        projectile.lifetime = 2
        break
      case "shotgun":
        projectile.speed = 30
        projectile.damage = 50
        projectile.lifetime = 1.5
        break
      default:
        projectile.speed = 45
        projectile.damage = 25
        projectile.lifetime = 2.5
        break
    }

    this.projectiles.set(projectile.id, projectile)
    return projectile
  }

  // Alternative method name for consistency
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
    projectile.playerId = ownerId

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
      projectile.setDirection(direction.x, direction.y, direction.z)
    } else {
      projectile.setDirection(direction.x, direction.y, direction.z)
    }

    projectile.speed = speed
    projectile.damage = damage

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

    // Check kill limit
    let topPlayer: BattlePlayer | null = null
    let topKills = 0

    // Use Array.from to convert MapSchema to array for proper iteration
    Array.from(this.players.values()).forEach((player: BattlePlayer) => {
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
      let topPlayer: BattlePlayer | null = null
      let topKills = 0

      // Use Array.from to convert MapSchema to array for proper iteration
      Array.from(this.players.values()).forEach((player: BattlePlayer) => {
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

  getAlivePlayers(): BattlePlayer[] {
    const alivePlayers: BattlePlayer[] = []
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
