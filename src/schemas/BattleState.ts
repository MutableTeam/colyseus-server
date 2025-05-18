import { Schema, MapSchema, type } from "@colyseus/schema"
import { Player } from "./Player"
import { Projectile } from "./Projectile"

export class BattleState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>()
  @type({ map: Projectile }) projectiles = new MapSchema<Projectile>()

  @type("number") mapWidth: number
  @type("number") mapHeight: number

  @type("boolean") gameStarted = false
  @type("boolean") gameEnded = false
  @type("number") gameStartTime = 0
  @type("number") gameEndTime = 0
  @type("number") gameTime = 0
  @type("number") maxGameTime = 300 // 5 minutes

  constructor(mapWidth = 2000, mapHeight = 2000) {
    super()
    this.mapWidth = mapWidth
    this.mapHeight = mapHeight
  }
}
