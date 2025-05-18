import { Schema, type } from "@colyseus/schema"

export class Vector2D extends Schema {
  @type("number") x = 0
  @type("number") y = 0
}
