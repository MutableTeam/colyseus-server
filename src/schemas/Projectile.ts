import { Schema, type } from "@colyseus/schema"
import { Vector3D } from "./Vector3D"
import { Quaternion } from "./Quaternion"

export class Projectile extends Schema {
  @type("string") id = ""
  @type("string") ownerId = ""
  @type("string") type = "default"

  // 3D position and movement
  @type(Vector3D) position = new Vector3D()
  @type(Vector3D) velocity = new Vector3D()
  @type(Quaternion) rotation = new Quaternion()

  // Projectile properties
  @type("number") damage = 10
  @type("number") radius = 0.5
  @type("number") lifetime = 2 // seconds
  @type("number") speed = 20
  @type("number") gravity = 0 // Some projectiles might be affected by gravity

  // Visual effects (for client rendering)
  @type("string") effectType = "default" // For different visual effects
  @type("number") scale = 1
}
