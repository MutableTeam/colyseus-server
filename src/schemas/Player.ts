import { Schema, type } from "@colyseus/schema"

export class Player extends Schema {
  @type("string") id = ""
  @type("string") sessionId = ""
  @type("string") name = ""
  @type("string") characterType = "default"
  @type("number") x = 0
  @type("number") y = 0
  @type("number") z = 0
  @type("string") animationState = "idle"
  @type("boolean") isConnected = true
  @type("number") joinTime = 0
  @type("number") lastUpdateTime = 0

  // Lobby-specific properties
  @type("boolean") ready = false
  @type("string") selectedGameType = ""

  constructor(id?: string, sessionId?: string, name?: string) {
    super()
    if (id) this.id = id
    if (sessionId) this.sessionId = sessionId
    if (name) this.name = name
    this.joinTime = Date.now()
    this.lastUpdateTime = Date.now()
  }

  // Position methods
  setPosition(x: number, y: number, z = 0) {
    this.x = x
    this.y = y
    this.z = z
    this.update()
  }

  // Lobby methods
  setReady(ready: boolean) {
    this.ready = ready
    this.update()
  }

  selectGameType(gameType: string) {
    this.selectedGameType = gameType
    this.update()
  }

  // Update timestamp
  update() {
    this.lastUpdateTime = Date.now()
  }

  // Utility methods
  getDistance(other: Player): number {
    const dx = this.x - other.x
    const dy = this.y - other.y
    const dz = this.z - other.z
    return Math.sqrt(dx * dx + dy * dy + dz * dz)
  }

  isNear(other: Player, distance: number): boolean {
    return this.getDistance(other) <= distance
  }

  // Serialization
  toJSON() {
    return {
      id: this.id,
      sessionId: this.sessionId,
      name: this.name,
      characterType: this.characterType,
      x: this.x,
      y: this.y,
      z: this.z,
      animationState: this.animationState,
      isConnected: this.isConnected,
      ready: this.ready,
      selectedGameType: this.selectedGameType,
      joinTime: this.joinTime,
      lastUpdateTime: this.lastUpdateTime,
    }
  }
}
