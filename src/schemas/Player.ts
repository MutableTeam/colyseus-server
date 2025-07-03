import { Schema, type } from "@colyseus/schema"

export class Player extends Schema {
  @type("string") id = ""
  @type("string") sessionId = ""
  @type("string") name = ""
  @type("string") characterType = "default"

  // Lobby/Hub specific properties
  @type("boolean") ready = false
  @type("string") selectedGameType = ""

  // Timestamps
  @type("number") joinTime = 0
  @type("number") lastUpdate = 0

  constructor() {
    super()
    this.joinTime = Date.now()
    this.lastUpdate = Date.now()
  }

  // Lobby/Hub methods
  setReady(ready: boolean) {
    this.ready = ready
  }

  selectGameType(gameType: string) {
    this.selectedGameType = gameType
  }

  // Update player state
  update() {
    this.lastUpdate = Date.now()
  }
}
