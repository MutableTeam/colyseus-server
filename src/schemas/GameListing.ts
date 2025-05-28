import { Schema, MapSchema, type } from "@colyseus/schema"

export class GameListing extends Schema {
  @type("string") id = ""
  @type("string") type = ""
  @type("string") name = ""
  @type("number") maxPlayers = 4
  @type("number") currentPlayers = 0
  @type("string") creatorId = ""
  @type("number") createdAt: number = Date.now()
  @type("boolean") locked = false
  @type({ map: "string" }) playerIds = new MapSchema<string>()
}
