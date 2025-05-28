import { Schema, type } from "@colyseus/schema"
import { Vector2D } from "./Vector2D"

export class Enemy extends Schema {
  @type("string") id = ""
  @type(Vector2D) position = new Vector2D()
  @type("string") type = "walking" // walking, flying, etc.

  @type("number") health = 3
  @type("number") speed = 100
  @type("number") direction = 1 // 1 (right), -1 (left)
  @type("number") width = 40
  @type("number") height = 40
  @type("number") radius = 20

  @type("boolean") stunned = false

  // For flying enemies
  @type("number") startY = 0
  @type("number") time = 0
}
