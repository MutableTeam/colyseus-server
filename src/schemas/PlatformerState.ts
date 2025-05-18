import { Schema, MapSchema, ArraySchema, type } from "@colyseus/schema"
import { PlatformerPlayer } from "./PlatformerPlayer"
import { Platform } from "./Platform"
import { Collectible } from "./Collectible"
import { Enemy } from "./Enemy"

export class PlatformerState extends Schema {
  @type({ map: PlatformerPlayer }) players = new MapSchema<PlatformerPlayer>()
  @type([Platform]) platforms = new ArraySchema<Platform>()
  @type([Collectible]) collectibles = new ArraySchema<Collectible>()
  @type([Enemy]) enemies = new ArraySchema<Enemy>()

  @type("number") levelWidth: number
  @type("number") levelHeight: number

  @type("boolean") gameStarted = false
  @type("boolean") gameEnded = false
  @type("number") gameStartTime = 0
  @type("number") gameEndTime = 0
  @type("number") gameTime = 0

  constructor(levelWidth = 3000, levelHeight = 1000) {
    super()
    this.levelWidth = levelWidth
    this.levelHeight = levelHeight
  }
}
