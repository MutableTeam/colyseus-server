import { Schema, type } from "@colyseus/schema"
import { Vector3D } from "./Vector3D"
import { Quaternion } from "./Quaternion"

export class Player extends Schema {
  @type("string") id = ""
  @type("string") name = ""
  @type("string") sessionId = ""
  @type("string") characterType = "default"
  @type("string") modelType = "default" // For different 3D models

  // 3D position and movement
  @type(Vector3D) position = new Vector3D()
  @type(Vector3D) velocity = new Vector3D()
  @type(Vector3D) moveDirection = new Vector3D()
  @type(Quaternion) rotation = new Quaternion() // For 3D rotation

  // Physics properties
  @type("number") speed = 5
  @type("number") jumpForce = 10
  @type("boolean") isGrounded = false
  @type("number") mass = 1
  @type("number") radius = 1 // For collision detection

  // Game state
  @type("number") health = 100
  @type("number") maxHealth = 100
  @type("number") kills = 0
  @type("number") deaths = 0
  @type("number") level = 1
  @type("number") experience = 0
  @type("boolean") isRespawning = false
  @type("number") respawnTime = 3 // seconds

  // Battle room specific properties
  @type("number") score = 0
  @type("boolean") isAlive = true

  // Combat
  @type("number") lastShotTime = 0
  @type({ array: "string" }) abilities = new Array<string>()
  @type({ map: "number" }) abilityCooldowns = new Map<string, number>()
  @type("number") lastAbilityUseTime = 0

  // Animation state - useful for client-side animation
  @type("string") animationState = "idle" // idle, running, jumping, attacking, etc.

  canShoot(): boolean {
    const now = Date.now()
    const cooldown = 500 // 0.5 seconds
    return now - this.lastShotTime > cooldown
  }

  canUseAbility(abilityId: string): boolean {
    return !this.abilityCooldowns.has(abilityId) || (this.abilityCooldowns.get(abilityId) || 0) <= 0
  }

  setAbilityCooldown(abilityId: string, cooldown = 5000) {
    this.abilityCooldowns.set(abilityId, cooldown)
    this.lastAbilityUseTime = Date.now()
  }

  updateCooldowns() {
    const now = Date.now()

    this.abilityCooldowns.forEach((cooldownEnd, abilityId) => {
      if (now >= cooldownEnd) {
        this.abilityCooldowns.delete(abilityId)
      }
    })
  }

  // Helper method to update rotation from Euler angles (in radians)
  setRotationFromEuler(x: number, y: number, z: number) {
    this.rotation.setFromEuler(x, y, z)
  }

  // Helper to get forward direction vector based on rotation
  getForwardVector(): Vector3D {
    // This is a simplified calculation - in a real implementation
    // you would use quaternion math to get the actual forward vector
    const forward = new Vector3D(0, 0, -1)

    // Simple yaw rotation for this example (assuming Y-up coordinate system)
    // In a real implementation, you would use quaternion to vector conversion
    const angle = Math.atan2(this.rotation.y, this.rotation.w) * 2
    forward.x = Math.sin(angle)
    forward.z = -Math.cos(angle)

    return forward
  }

  takeDamage(damage: number): boolean {
    this.health = Math.max(0, this.health - damage)
    if (this.health <= 0 && this.isAlive) {
      this.isAlive = false
      this.deaths++
      this.isRespawning = true
      return true // Player died
    }
    return false // Player still alive
  }

  heal(amount: number) {
    this.health = Math.min(this.maxHealth, this.health + amount)
  }

  respawn() {
    this.health = this.maxHealth
    this.isAlive = true
    this.isRespawning = false
    this.position.x = 0
    this.position.y = 0
    this.position.z = 0
  }

  addKill() {
    this.kills++
    this.score += 100 // 100 points per kill
    this.experience += 50 // 50 XP per kill
  }

  addScore(points: number) {
    this.score += points
  }
}
