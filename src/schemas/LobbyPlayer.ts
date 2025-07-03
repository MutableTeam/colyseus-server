import { Schema, type } from "@colyseus/schema"

export class LobbyPlayer extends Schema {
  @type("string") id = ""
  @type("string") sessionId = ""
  @type("string") username = ""
  @type("string") name = ""
  @type("boolean") ready = false
  @type("boolean") isHost = false
  @type("string") characterType = "default"
  @type("number") joinedAt = 0
  @type("number") lastActivity = 0

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

  setHost(isHost: boolean) {
    this.isHost = isHost
    this.updateActivity()
  }

  setCharacterType(characterType: string) {
    this.characterType = characterType
    this.updateActivity()
  }

  isActive(): boolean {
    const now = Date.now()
    const inactiveThreshold = 5 * 60 * 1000 // 5 minutes
    return now - this.lastActivity < inactiveThreshold
  }
}
