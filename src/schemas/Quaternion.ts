import { Schema, type } from "@colyseus/schema"

export class Quaternion extends Schema {
  @type("number") x = 0
  @type("number") y = 0
  @type("number") z = 0
  @type("number") w = 1

  constructor(x = 0, y = 0, z = 0, w = 1) {
    super()
    this.x = x
    this.y = y
    this.z = z
    this.w = w
  }

  set(x: number, y: number, z: number, w: number) {
    this.x = x
    this.y = y
    this.z = z
    this.w = w
  }

  copy(quaternion: Quaternion) {
    this.x = quaternion.x
    this.y = quaternion.y
    this.z = quaternion.z
    this.w = quaternion.w
  }

  // Convert Euler angles (in radians) to quaternion
  setFromEuler(x: number, y: number, z: number) {
    const c1 = Math.cos(x / 2)
    const c2 = Math.cos(y / 2)
    const c3 = Math.cos(z / 2)
    const s1 = Math.sin(x / 2)
    const s2 = Math.sin(y / 2)
    const s3 = Math.sin(z / 2)

    this.x = s1 * c2 * c3 + c1 * s2 * s3
    this.y = c1 * s2 * c3 - s1 * c2 * s3
    this.z = c1 * c2 * s3 + s1 * s2 * c3
    this.w = c1 * c2 * c3 - s1 * s2 * s3
  }
}
