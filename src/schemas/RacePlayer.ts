import { Schema, type } from "@colyseus/schema"

export class RacePlayer extends Schema {
  @type("string") id: string
  @type("string") name: string
  @type("string") vehicleType = "default"

  @type("number") position = 0 // Distance along the track
  @type("number") lane = 1
  @type("number") speed = 0
  @type("number") maxSpeed = 500
  @type("number") acceleration = 0 // -1 to 1
  @type("number") steering = 0 // -1 to 1

  @type("number") accelerationRate = 200
  @type("number") brakeRate = 400

  @type("boolean") boostActive = false
  @type("number") boostTimeRemaining = 0
  @type("number") boostCooldown = 0
  @type("number") boostDuration = 3 // 3 seconds
  @type("number") boostCooldownTime = 10 // 10 seconds

  @type("boolean") ready = false
  @type("boolean") finished = false
  @type("number") finishTime = 0
  @type("number") finishPosition = 0

  @type(["number"]) checkpoints = []

  canUseBoost(): boolean {
    return !this.boostActive && this.boostCooldown <= 0
  }

  activateBoost() {
    this.boostActive = true
    this.boostTimeRemaining = this.boostDuration
    this.boostCooldown = this.boostCooldownTime
  }
}
