import { Schema, MapSchema, ArraySchema, type } from "@colyseus/schema"
import { Player } from "./Player"
import { Projectile } from "./Projectile"
import { Vector3D } from "./Vector3D"

// Define map objects for Three.js environment
export class MapObject extends Schema {
  @type("string") id: string
  @type("string") type: string // Type of object (wall, platform, etc.)
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

  // Environment settings
  @type("string") timeOfDay = "day" // day, night, dusk, etc.
  @type("string") weather = "clear" // clear, rain, fog, etc.

  constructor(mapWidth = 100, mapLength = 100, mapHeight = 50) {
    super()
    this.mapWidth = mapWidth
    this.mapLength = mapLength
    this.mapHeight = mapHeight
  }
}
