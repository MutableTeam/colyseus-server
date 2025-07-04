import { Schema, type } from "@colyseus/schema"
import { Vector3D } from "./Vector3D"

export class MapObject extends Schema {
  @type("string") id = ""
  @type("string") type = ""
  @type(Vector3D) position = new Vector3D()
  @type(Vector3D) scale = new Vector3D(1, 1, 1)
  @type("number") rotation = 0 // Simple Y-axis rotation for static objects
}
