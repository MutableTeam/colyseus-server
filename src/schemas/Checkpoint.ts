import { Schema, type } from "@colyseus/schema"

export class Checkpoint extends Schema {
  @type("number") id = 0
  @type("number") position = 0 // Distance along the track
}
