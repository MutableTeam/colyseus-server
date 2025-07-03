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
  @type("number") maxGameTime = 300 // 5 minutes
  @type("string") gameMode = "deathmatch" // deathmatch, teamDeathmatch, captureTheFlag, etc.
  @type("number") maxPlayers = 16

  // Environment settings
  @type("string") timeOfDay = "day" // day, night, dusk, etc.
  @type("string") weather = "clear" // clear, rain, fog, etc.

  constructor(mapWidth = 100, mapLength = 100, mapHeight = 50) {
    super()
    this.mapWidth = mapWidth
    this.mapLength = mapLength
    this.mapHeight = mapHeight
  }

  // Added missing methods for player and projectile management
  addPlayer(sessionId: string, name: string, characterType: string, fromLobby: boolean) {
    const player = new Player()
    player.id = sessionId // Use id for sessionId
    player.name = name
    player.characterType = characterType
    player.score = 0 // Initialize score
    player.isAlive = true // Initialize isAlive
    this.players.set(sessionId, player)
    return player
  }

  removePlayer(sessionId: string) {
    return this.players.delete(sessionId)
  }

  addProjectile(playerId: string, position: any, direction: any, weaponType: string) {
    const projectile = new Projectile()
    projectile.id = `${playerId}_${Date.now()}`
    projectile.playerId = playerId // Corrected: Assign to playerId
    projectile.position.x = position.x
    projectile.position.y = position.y
    projectile.position.z = position.z
    projectile.direction.x = direction.x // Corrected: Assign to direction.x
    projectile.direction.y = direction.y // Corrected: Assign to direction.y
    projectile.direction.z = direction.z // Corrected: Assign to direction.z
    projectile.weaponType = weaponType // Corrected: Assign to weaponType
    this.projectiles.set(projectile.id, projectile)
    return projectile
  }

  usePlayerAbility(sessionId: string, abilityType: string) {
    const player = this.players.get(sessionId)
    if (player && player.isAlive) {
      // Implement actual ability logic and cooldowns here
      // For now, just return true to simulate success
      console.log(`Player ${player.name} used ability: ${abilityType}`)
      return true
    }
    return false
  }
}
