import { Schema, type } from "@colyseus/schema"
import { Vector2D } from "./Vector2D"

export class Player extends Schema {
  @type("string") id: string
  @type("string") name: string
  @type("string") characterType = "default"

  @type(Vector2D) position = new Vector2D()
  @type(Vector2D) moveDirection = new Vector2D()
  @type("number") speed = 200

  @type("number") health = 100
  @type("number") maxHealth = 100
  @type("number") kills = 0

  @type("boolean") ready = false

  @type("number") lastShotTime = 0
  @type({ array: "string" }) abilities = new Array<string>()
  @type({ map: "number" }) abilityCooldowns = new Map<string, number>()

  canShoot(): boolean {
    const now = Date.now()
    const cooldown = 500 // 0.5 seconds
    return now - this.lastShotTime > cooldown
  }

  canUseAbility(abilityId: string): boolean {
    return !this.abilityCooldowns.has(abilityId) || this.abilityCooldowns.get(abilityId) <= 0
  }

  setAbilityCooldown(abilityId: string, cooldown = 5000) {
    this.abilityCooldowns.set(abilityId, cooldown)
  }

  updateCooldowns() {
    const now = Date.now()
    this.abilityCooldowns.forEach((cooldown, abilityId) => {
      if (cooldown <= 0) {
        this.abilityCooldowns.delete(abilityId)
      }
    })
  }
}
