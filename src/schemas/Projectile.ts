import { Schema, type } from "@colyseus/schema"
import { Vector3D } from "./Vector3D"

export class Projectile extends Schema {
  @type("string") id = ""
  @type("string") ownerId = ""
  @type("string") type = "bullet" // bullet, fireball, arrow, etc.
  @type(Vector3D) position = new Vector3D()
  @type(Vector3D) direction = new Vector3D()
  @type("number") speed = 50
  @type("number") damage = 25
  @type("number") radius = 0.1 // For collision detection
  @type("boolean") isActive = true
  @type("number") createdAt = 0
  @type("number") distanceTraveled = 0
  @type("number") maxDistance = 100
  @type("number") lifeTime = 5000 // 5 seconds in milliseconds

  constructor() {
    super()
    this.createdAt = Date.now()
  }

  update(deltaTime: number) {
    if (!this.isActive) return

    // Update position
    const moveDistance = this.speed * deltaTime
    this.position.x += this.direction.x * moveDistance
    this.position.y += this.direction.y * moveDistance
    this.position.z += this.direction.z * moveDistance

    // Update distance traveled
    this.distanceTraveled += moveDistance

    // Check if projectile should be destroyed
    if (this.distanceTraveled >= this.maxDistance || Date.now() - this.createdAt >= this.lifeTime) {
      this.isActive = false
    }
  }

  destroy() {
    this.isActive = false
  }

  setDirection(x: number, y: number, z: number) {
    // Normalize the direction vector
    const length = Math.sqrt(x * x + y * y + z * z)
    if (length > 0) {
      this.direction.x = x / length
      this.direction.y = y / length
      this.direction.z = z / length
    }
  }

  setPosition(x: number, y: number, z: number) {
    this.position.x = x
    this.position.y = y
    this.position.z = z
  }
}
