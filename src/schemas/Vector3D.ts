import { Schema, type } from "@colyseus/schema"

export class Vector3D extends Schema {
  @type("number") x = 0
  @type("number") y = 0
  @type("number") z = 0

  constructor(x = 0, y = 0, z = 0) {
    super()
    this.x = x
    this.y = y
    this.z = z
  }

  set(x: number, y: number, z: number) {
    this.x = x
    this.y = y
    this.z = z
  }

  copy(vector: Vector3D) {
    this.x = vector.x
    this.y = vector.y
    this.z = vector.z
  }

  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z)
  }

  normalize() {
    const length = this.length()
    if (length > 0) {
      this.x /= length
      this.y /= length
      this.z /= length
    }
    return this
  }
}
