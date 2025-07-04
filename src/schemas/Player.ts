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
  @type("boolean") ready = false
  @type("string") selectedGameType = ""
  @type("number") joinTime = 0
  @type("number") lastUpdateTime = 0

  constructor() {
    super()
    this.joinTime = Date.now()
    this.lastUpdateTime = Date.now()
  }

  setPosition(x: number, y: number, z = 0) {
    this.x = x
    this.y = y
    this.z = z
    this.update()
  }

  setReady(ready: boolean) {
    this.ready = ready
    this.update()
  }

  selectGameType(gameType: string) {
    this.selectedGameType = gameType
    this.update()
  }

  setAnimationState(state: string) {
    this.animationState = state
    this.update()
  }

  setConnected(connected: boolean) {
    this.isConnected = connected
    this.update()
  }

  update() {
    this.lastUpdateTime = Date.now()
  }

  getDistance(other: Player): number {
    const dx = this.x - other.x
    const dy = this.y - other.y
    const dz = this.z - other.z
    return Math.sqrt(dx * dx + dy * dy + dz * dz)
  }

  isNear(other: Player, distance: number): boolean {
    return this.getDistance(other) <= distance
  }
}
