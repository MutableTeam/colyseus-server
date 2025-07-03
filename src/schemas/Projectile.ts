import { Schema, type } from "@colyseus/schema"
import { Vector3D } from "./Vector3D"

export class Projectile extends Schema {
  @type("string") id: string
  @type("string") ownerId: string
  @type(Vector3D) position = new Vector3D()
  @type(Vector3D) velocity = new Vector3D()
  @type("number") damage = 25
  @type("number") createdAt: number
}
