import { Schema, type } from "@colyseus/schema"

export class BattlePlayer extends Schema {
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

  // Battle-specific properties
  @type("number") health = 100
  @type("number") maxHealth = 100
  @type("number") armor = 0
  @type("number") shield = 0
  @type("number") energy = 100
  @type("number") maxEnergy = 100
  @type("boolean") isAlive = true
  @type("boolean") isRespawning = false
  @type("number") respawnTime = 5
  @type("number") lastDamageTime = 0

  // Combat stats
  @type("number") kills = 0
  @type("number") deaths = 0
  @type("number") assists = 0
  @type("number") score = 0
  @type("number") damageDealt = 0
  @type("number") damageTaken = 0

  // Abilities and cooldowns
  @type("number") primaryAbilityCooldown = 0
  @type("number") secondaryAbilityCooldown = 0
  @type("number") ultimateAbilityCooldown = 0
  @type("number") dashCooldown = 0

  // Movement and combat state
  @type("number") speed = 5
  @type("number") jumpHeight = 10
  @type("boolean") isGrounded = true
  @type("boolean") isJumping = false
  @type("boolean") isDashing = false
  @type("boolean") isAttacking = false
  @type("boolean") isBlocking = false
  @type("boolean") isStunned = false
  @type("number") stunDuration = 0

  // Weapon and equipment
  @type("string") primaryWeapon = "default"
  @type("string") secondaryWeapon = "none"
  @type("number") ammo = 30
  @type("number") maxAmmo = 30

  constructor() {
    super()
    this.joinTime = Date.now()
    this.lastUpdateTime = Date.now()
    this.health = this.maxHealth
    this.energy = this.maxEnergy
    this.isAlive = true
  }

  // Position methods
  setPosition(x: number, y: number, z = 0) {
    this.x = x
    this.y = y
    this.z = z
    this.update()
  }

  // Health and damage methods
  takeDamage(damage: number, attackerId?: string): boolean {
    if (!this.isAlive || this.isRespawning) return false

    const actualDamage = Math.max(0, damage - this.armor)
    this.health = Math.max(0, this.health - actualDamage)
    this.damageTaken += actualDamage
    this.lastDamageTime = Date.now()

    if (this.health <= 0) {
      this.die()
      return true
    }

    this.update()
    return false
  }

  heal(amount: number) {
    if (!this.isAlive) return

    this.health = Math.min(this.maxHealth, this.health + amount)
    this.update()
  }

  die() {
    this.isAlive = false
    this.health = 0
    this.deaths++
    this.isRespawning = true
    this.animationState = "dead"
    this.update()
  }

  respawn() {
    this.isAlive = true
    this.health = this.maxHealth
    this.energy = this.maxEnergy
    this.isRespawning = false
    this.animationState = "idle"
    this.isGrounded = true
    this.isJumping = false
    this.isDashing = false
    this.isAttacking = false
    this.isBlocking = false
    this.isStunned = false
    this.stunDuration = 0
    this.update()
  }

  // Combat methods
  addKill() {
    this.kills++
    this.score += 100
    this.update()
  }

  addAssist() {
    this.assists++
    this.score += 50
    this.update()
  }

  addDamageDealt(damage: number) {
    this.damageDealt += damage
    this.score += Math.floor(damage / 10)
    this.update()
  }

  // Ability methods
  canUseAbility(abilityType: string): boolean {
    if (!this.isAlive || this.isStunned) return false

    const now = Date.now()
    switch (abilityType) {
      case "primary":
        return now >= this.primaryAbilityCooldown
      case "secondary":
        return now >= this.secondaryAbilityCooldown
      case "ultimate":
        return now >= this.ultimateAbilityCooldown
      case "dash":
        return now >= this.dashCooldown && !this.isDashing
      default:
        return false
    }
  }

  setAbilityCooldown(abilityType: string) {
    const now = Date.now()
    switch (abilityType) {
      case "primary":
        this.primaryAbilityCooldown = now + 2000 // 2 seconds
        break
      case "secondary":
        this.secondaryAbilityCooldown = now + 5000 // 5 seconds
        break
      case "ultimate":
        this.ultimateAbilityCooldown = now + 30000 // 30 seconds
        break
      case "dash":
        this.dashCooldown = now + 3000 // 3 seconds
        this.isDashing = true
        setTimeout(() => {
          this.isDashing = false
        }, 500) // Dash lasts 0.5 seconds
        break
    }
    this.update()
  }

  // Energy methods
  useEnergy(amount: number): boolean {
    if (this.energy >= amount) {
      this.energy -= amount
      this.update()
      return true
    }
    return false
  }

  regenerateEnergy(amount: number) {
    this.energy = Math.min(this.maxEnergy, this.energy + amount)
    this.update()
  }

  // Weapon methods
  reload() {
    this.ammo = this.maxAmmo
    this.update()
  }

  useAmmo(amount = 1): boolean {
    if (this.ammo >= amount) {
      this.ammo -= amount
      this.update()
      return true
    }
    return false
  }

  // Status effects
  stun(duration: number) {
    this.isStunned = true
    this.stunDuration = duration
    this.animationState = "stunned"
    this.update()

    setTimeout(() => {
      this.isStunned = false
      this.stunDuration = 0
      if (this.animationState === "stunned") {
        this.animationState = "idle"
      }
      this.update()
    }, duration)
  }

  // Movement methods
  jump() {
    if (this.isGrounded && !this.isJumping) {
      this.isJumping = true
      this.isGrounded = false
      this.animationState = "jumping"
      this.update()
    }
  }

  land() {
    this.isGrounded = true
    this.isJumping = false
    if (this.animationState === "jumping") {
      this.animationState = "idle"
    }
    this.update()
  }

  startAttack() {
    if (!this.isAttacking && this.isAlive) {
      this.isAttacking = true
      this.animationState = "attacking"
      this.update()
    }
  }

  stopAttack() {
    this.isAttacking = false
    if (this.animationState === "attacking") {
      this.animationState = "idle"
    }
    this.update()
  }

  startBlocking() {
    if (!this.isBlocking && this.isAlive) {
      this.isBlocking = true
      this.animationState = "blocking"
      this.update()
    }
  }

  stopBlocking() {
    this.isBlocking = false
    if (this.animationState === "blocking") {
      this.animationState = "idle"
    }
    this.update()
  }

  // Update timestamp
  update() {
    this.lastUpdateTime = Date.now()
  }

  // Utility methods
  getDistance(other: BattlePlayer): number {
    const dx = this.x - other.x
    const dy = this.y - other.y
    const dz = this.z - other.z
    return Math.sqrt(dx * dx + dy * dy + dz * dz)
  }

  isNear(other: BattlePlayer, distance: number): boolean {
    return this.getDistance(other) <= distance
  }

  getHealthPercentage(): number {
    return (this.health / this.maxHealth) * 100
  }

  getEnergyPercentage(): number {
    return (this.energy / this.maxEnergy) * 100
  }

  // Get player stats
  getStats() {
    return {
      kills: this.kills,
      deaths: this.deaths,
      assists: this.assists,
      score: this.score,
      damageDealt: this.damageDealt,
      damageTaken: this.damageTaken,
      kdr: this.deaths > 0 ? this.kills / this.deaths : this.kills,
    }
  }
}
