import { Schema, type } from "@colyseus/schema"
import { Vector3D } from "./Vector3D"

export class Projectile extends Schema {
  @type("string") id = ""
  @type("string") ownerId = ""
  @type(Vector3D) position = new Vector3D()
  @type(Vector3D) direction = new Vector3D()
  @type("number") speed = 50
  @type("number") damage = 25
  @type("boolean") isActive = true
  @type("number") createdAt = 0
  @type("number") distanceTraveled = 0
  @type("string") projectileType = "bullet"

  constructor() {
    super()
    this.createdAt = Date.now()
  }

  update(deltaTime: number) {
    if (!this.isActive) return

    const moveDistance = this.speed * deltaTime

    this.position.x += this.direction.x * moveDistance
    this.position.y += this.direction.y * moveDistance
    this.position.z += this.direction.z * moveDistance

    this.distanceTraveled += moveDistance
  }

  deactivate() {
    this.isActive = false
  }
}
