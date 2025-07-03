import { Schema, type } from "@colyseus/schema"

export class Player extends Schema {
  @type("string") id = ""
  @type("string") sessionId = ""
  @type("string") name = ""
  @type("string") characterType = "default"
  @type("number") x = 0
  @type("number") y = 0
  @type("number") z = 0

  // Lobby/Hub specific properties
  @type("boolean") ready = false
  @type("string") selectedGameType = ""
  @type("string") animationState = "idle"

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
    this.lastUpdate = Date.now()
  }

  selectGameType(gameType: string) {
    this.selectedGameType = gameType
    this.lastUpdate = Date.now()
  }

  // Update player state
  update() {
    this.lastUpdate = Date.now()
  }

  // Set position
  setPosition(x: number, y: number, z = 0) {
    this.x = x
    this.y = y
    this.z = z
    this.lastUpdate = Date.now()
  }
}
