import { Schema, type } from "@colyseus/schema"

export class LobbyPlayer extends Schema {
  @type("string") id = ""
  @type("string") name = ""
  @type("boolean") ready = false
  @type("number") joinedAt = 0
  @type("string") selectedGameType = ""
}
