import { Schema, type } from "@colyseus/schema"
import { Vector3D } from "./Vector3D"

export class Projectile extends Schema {
  @type("string") id = ""
  @type("string") playerId = ""
  @type("string") weaponType = "default"
  @type(Vector3D) position = new Vector3D()
  @type(Vector3D) direction = new Vector3D()
  @type(Vector3D) velocity = new Vector3D()
  @type("number") speed = 10
  @type("number") damage = 25
  @type("number") lifespan = 5000 // milliseconds
  @type("number") createdAt = 0
  @type("boolean") active = true
  @type("number") radius = 0.1 // For collision detection

  constructor() {
    super()
    this.createdAt = Date.now()
  }

  update(deltaTime: number) {
    if (!this.active) return

    // Update position based on velocity
    this.position.x += this.velocity.x * deltaTime
    this.position.y += this.velocity.y * deltaTime
    this.position.z += this.velocity.z * deltaTime

    // Check if projectile has exceeded its lifespan
    if (Date.now() - this.createdAt > this.lifespan) {
      this.active = false
    }
  }

  setDirection(x: number, y: number, z: number) {
    this.direction.x = x
    this.direction.y = y
    this.direction.z = z

    // Set velocity based on direction and speed
    this.velocity.x = this.direction.x * this.speed
    this.velocity.y = this.direction.y * this.speed
    this.velocity.z = this.direction.z * this.speed
  }
}
