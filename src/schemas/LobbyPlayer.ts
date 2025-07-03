import { Schema, type } from "@colyseus/schema"

export class LobbyPlayer extends Schema {
  @type("string") id = ""
  @type("string") name = ""
  @type("string") username = "" // Added missing username property
  @type("string") sessionId = ""
  @type("boolean") ready = false
  @type("string") selectedGameType = ""
  @type("number") joinedAt = 0
  @type("number") lastActivity = 0
  @type("string") status = "idle" // idle, ready, in_game, disconnected
  @type("number") level = 1
  @type("number") experience = 0
  @type("string") characterType = "default"
  @type("string") avatar = ""
  @type({ map: "string" }) preferences = new Map<string, string>()

  constructor() {
    super()
    this.joinedAt = Date.now()
    this.lastActivity = Date.now()
  }

  updateActivity() {
    this.lastActivity = Date.now()
  }

  setReady(ready: boolean) {
    this.ready = ready
    this.updateActivity()
  }

  selectGameType(gameType: string) {
    this.selectedGameType = gameType
    this.updateActivity()
  }

  isActive(): boolean {
    const now = Date.now()
    const inactiveThreshold = 5 * 60 * 1000 // 5 minutes
    return now - this.lastActivity < inactiveThreshold
  }
}
