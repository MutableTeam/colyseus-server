import { Schema, type } from "@colyseus/schema"
import { Vector2D } from "./Vector2D"

export class Collectible extends Schema {
  @type("string") id: string
  @type(Vector2D) position = new Vector2D()
  @type("string") type = "coin" // coin, gem, powerup, etc.
  @type("number") value = 1
  @type("number") radius = 10
}
