import { Schema, type } from "@colyseus/schema"
import { Vector2D } from "./Vector2D"

export class Platform extends Schema {
  @type("string") id: string
  @type(Vector2D) position = new Vector2D()
  @type("number") width = 100
  @type("number") height = 20
  @type("string") type = "normal" // normal, moving, crumbling, etc.
}
