import { Schema, type } from "@colyseus/schema"
import { Vector2D } from "./Vector2D"

export class Projectile extends Schema {
  @type("string") id: string
  @type("string") ownerId: string
  @type("string") type = "default"

  @type(Vector2D) position = new Vector2D()
  @type(Vector2D) velocity = new Vector2D()

  @type("number") damage = 10
  @type("number") radius = 5
  @type("number") lifetime = 2 // seconds
}
