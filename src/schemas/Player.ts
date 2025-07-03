import { Schema, type } from "@colyseus/schema"
import { Vector3D } from "./Vector3D"
import { Quaternion } from "./Quaternion"

export class Player extends Schema {
  @type("string") id = ""
  @type("string") sessionId = ""
  @type("string") name = ""
  @type("string") characterType = "default"
  @type(Vector3D) position = new Vector3D()
  @type(Vector3D) velocity = new Vector3D()
  @type(Quaternion) rotation = new Quaternion()

  // Health and combat
  @type("number") health = 100
  @type("number") maxHealth = 100
  @type("boolean") isAlive = true
  @type("number") armor = 0
  @type("number") shield = 0

  // Game stats
  @type("number") score = 0
  @type("number") kills = 0
  @type("number") deaths = 0
  @type("number") assists = 0
  @type("number") level = 1
  @type("number") experience = 0

  // Player state
  @type("string") animationState = "idle"
  @type("boolean") isGrounded = true
  @type("boolean") isJumping = false
  @type("boolean") isCrouching = false
  @type("boolean") isRunning = false
  @type("boolean") isShooting = false
  @type("boolean") isReloading = false
  @type("boolean") isRespawning = false

  // Equipment and abilities
  @type("string") currentWeapon = "pistol"
  @type("number") ammo = 30
  @type("number") maxAmmo = 30
  @type("number") grenades = 2
  @type({ map: "number" }) abilityCooldowns = new Map<string, number>()

  // Timing
  @type("number") joinedAt = 0
  @type("number") lastActivity = 0
  @type("number") lastShotTime = 0
  @type("number") respawnTime = 5 // seconds
  @type("number") invulnerabilityTime = 0

  // Physics properties
  @type("number") radius = 0.5 // For collision detection
  @type("number") speed = 5
  @type("number") jumpForce = 10

  constructor() {
    super()
    this.joinedAt = Date.now()
    this.lastActivity = Date.now()
    this.health = this.maxHealth
    this.isAlive = true
  }

  updateActivity() {
    this.lastActivity = Date.now()
  }

  takeDamage(damage: number): boolean {
    if (!this.isAlive || this.invulnerabilityTime > Date.now()) {
      return false
    }

    // Apply armor reduction
    const actualDamage = Math.max(1, damage - this.armor)
    this.health = Math.max(0, this.health - actualDamage)

    if (this.health <= 0) {
      this.die()
      return true // Player died
    }

    return false // Player survived
  }

  heal(amount: number) {
    if (this.isAlive) {
      this.health = Math.min(this.maxHealth, this.health + amount)
    }
  }

  die() {
    this.isAlive = false
    this.health = 0
    this.deaths++
    this.animationState = "dead"
    this.isRespawning = false
  }

  respawn() {
    this.isAlive = true
    this.health = this.maxHealth
    this.animationState = "idle"
    this.isRespawning = false
    this.ammo = this.maxAmmo
    this.invulnerabilityTime = Date.now() + 3000 // 3 seconds of invulnerability
  }

  addKill() {
    this.kills++
    this.score += 100
    this.experience += 50
  }

  addAssist() {
    this.assists++
    this.score += 25
    this.experience += 15
  }

  canShoot(): boolean {
    if (!this.isAlive || this.isReloading || this.ammo <= 0) {
      return false
    }

    const shotCooldown = 100 // 100ms between shots
    return Date.now() - this.lastShotTime >= shotCooldown
  }

  shoot() {
    if (this.canShoot()) {
      this.ammo = Math.max(0, this.ammo - 1)
      this.lastShotTime = Date.now()
      this.isShooting = true

      // Reset shooting state after a short time
      setTimeout(() => {
        this.isShooting = false
      }, 200)

      return true
    }
    return false
  }

  reload() {
    if (!this.isReloading && this.ammo < this.maxAmmo) {
      this.isReloading = true

      // Simulate reload time
      setTimeout(() => {
        this.ammo = this.maxAmmo
        this.isReloading = false
      }, 2000) // 2 second reload
    }
  }

  canUseAbility(abilityId: string): boolean {
    const cooldown = this.abilityCooldowns.get(abilityId) || 0
    return Date.now() >= cooldown
  }

  setAbilityCooldown(abilityId: string, cooldownMs = 5000) {
    this.abilityCooldowns.set(abilityId, Date.now() + cooldownMs)
  }

  updateCooldowns() {
    const now = Date.now()
    this.abilityCooldowns.forEach((cooldownTime, abilityId) => {
      if (now >= cooldownTime) {
        this.abilityCooldowns.delete(abilityId)
      }
    })
  }

  setPosition(x: number, y: number, z: number) {
    this.position.x = x
    this.position.y = y
    this.position.z = z
    this.updateActivity()
  }

  setRotation(x: number, y: number, z: number, w: number) {
    this.rotation.x = x
    this.rotation.y = y
    this.rotation.z = z
    this.rotation.w = w
    this.updateActivity()
  }

  setVelocity(x: number, y: number, z: number) {
    this.velocity.x = x
    this.velocity.y = y
    this.velocity.z = z
  }

  jump() {
    if (this.isGrounded && !this.isJumping) {
      this.isJumping = true
      this.isGrounded = false
      this.velocity.y = this.jumpForce
      this.animationState = "jumping"
    }
  }

  land() {
    this.isGrounded = true
    this.isJumping = false
    if (this.animationState === "jumping") {
      this.animationState = "idle"
    }
  }

  startRunning() {
    this.isRunning = true
    if (this.animationState === "idle") {
      this.animationState = "running"
    }
  }

  stopRunning() {
    this.isRunning = false
    if (this.animationState === "running") {
      this.animationState = "idle"
    }
  }

  crouch() {
    this.isCrouching = true
    this.animationState = "crouching"
  }

  standUp() {
    this.isCrouching = false
    if (this.animationState === "crouching") {
      this.animationState = "idle"
    }
  }

  isActive(): boolean {
    const now = Date.now()
    const inactiveThreshold = 5 * 60 * 1000 // 5 minutes
    return now - this.lastActivity < inactiveThreshold
  }

  getStats() {
    return {
      kills: this.kills,
      deaths: this.deaths,
      assists: this.assists,
      score: this.score,
      level: this.level,
      experience: this.experience,
      kdr: this.deaths > 0 ? this.kills / this.deaths : this.kills,
    }
  }
}
