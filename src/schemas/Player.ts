import { Schema, type } from "@colyseus/schema"

export class Player extends Schema {
  @type("string") id: string
  @type("string") sessionId: string
  @type("string") name: string
  @type("number") x = 0
  @type("number") y = 0
  @type("number") z = 0 // Keeping z for potential future 3D, but not actively used for movement in simplified version
  @type("string") characterType = "default"
  @type("string") animationState = "idle"

  constructor(id?: string, sessionId?: string, name?: string) {
    super()
    this.id = id || ""
    this.sessionId = sessionId || ""
    this.name = name || "Player"
  }
}
