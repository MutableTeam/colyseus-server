import { Schema, type } from "@colyseus/schema"

export class BattlePlayer extends Schema {
  @type("string") id = ""
  @type("string") sessionId = ""
  @type("string") name = ""
  @type("string") characterType = "default"
  @type("number") x = 0
  @type("number") y = 0
  @type("number") z = 0
  @type("number") health = 100
  @type("number") maxHealth = 100
  @type("number") score = 0
  @type("number") kills = 0
  @type("number") deaths = 0
  @type("boolean") isAlive = true
  @type("boolean") ready = false
  @type("number") level = 1
  @type("string") animationState = "idle"
  @type("boolean") isConnected = true
  @type("number") joinTime = 0
  @type("number") lastUpdateTime = 0

  // Battle-specific properties
  @type("number") armor = 0
  @type("number") shield = 0
  @type("number") energy = 100
  @type("number") maxEnergy = 100
  @type("boolean") isRespawning = false
  @type("number") respawnTime = 5
  @type("number") lastDamageTime = 0

  // Combat stats
  @type("number") assists = 0
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
    this.ready = false
    this.level = 1
  }

  // Position methods
  setPosition(x: number, y: number, z = 0) {
    this.x = x
    this.y = y
    this.z = z
    this.update()
  }

  // Health and damage methods
  takeDamage(damage: number) {
    this.health = Math.max(0, this.health - damage)
    if (this.health <= 0) {
      this.isAlive = false
      this.deaths++
    }
    this.update()
  }

  heal(amount: number) {
    this.health = Math.min(this.maxHealth, this.health + amount)
    this.update()
  }

  // Combat methods
  addScore(points: number) {
    this.score += points
    this.update()
  }

  addKill() {
    this.kills++
    this.addScore(100)
    this.update()
  }

  addAssist() {
    this.assists++
    this.addScore(50)
    this.update()
  }

  addDamageDealt(damage: number) {
    this.damageDealt += damage
    this.addScore(Math.floor(damage / 10))
    this.update()
  }

  // Ready state methods
  setReady(ready: boolean) {
    this.ready = ready
    this.update()
  }

  toggleReady() {
    this.ready = !this.ready
    this.update()
  }

  // Level methods
  setLevel(level: number) {
    this.level = Math.max(1, level)
    this.update()
  }

  addExperience(exp: number) {
    // Simple leveling system
    this.score += exp
    const newLevel = Math.floor(this.score / 1000) + 1
    if (newLevel > this.level) {
      this.level = newLevel
      console.log(`Player ${this.name} leveled up to ${this.level}!`)
    }
    this.update()
  }

  levelUp() {
    this.level++
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
    this.setAnimationState("stunned")

    setTimeout(() => {
      this.isStunned = false
      this.stunDuration = 0
      if (this.animationState === "stunned") {
        this.setAnimationState("idle")
      }
      this.update()
    }, duration)
  }

  // Movement methods
  jump() {
    if (this.isGrounded && !this.isJumping) {
      this.isJumping = true
      this.isGrounded = false
      this.setAnimationState("jumping")
    }
  }

  land() {
    this.isGrounded = true
    this.isJumping = false
    if (this.animationState === "jumping") {
      this.setAnimationState("idle")
    }
    this.update()
  }

  startAttack() {
    if (!this.isAttacking && this.isAlive) {
      this.isAttacking = true
      this.setAnimationState("attacking")
    }
  }

  stopAttack() {
    this.isAttacking = false
    if (this.animationState === "attacking") {
      this.setAnimationState("idle")
    }
    this.update()
  }

  startBlocking() {
    if (!this.isBlocking && this.isAlive) {
      this.isBlocking = true
      this.setAnimationState("blocking")
    }
  }

  stopBlocking() {
    this.isBlocking = false
    if (this.animationState === "blocking") {
      this.setAnimationState("idle")
    }
    this.update()
  }

  // Respawn method
  respawn() {
    this.health = this.maxHealth
    this.isAlive = true
    this.setAnimationState("idle")
    this.isGrounded = true
    this.isJumping = false
    this.isDashing = false
    this.isAttacking = false
    this.isBlocking = false
    this.isStunned = false
    this.stunDuration = 0
    this.update()
  }

  // Animation state method
  setAnimationState(state: string) {
    this.animationState = state
    this.update()
  }

  // Connection state method
  setConnected(connected: boolean) {
    this.isConnected = connected
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
      level: this.level,
      ready: this.ready,
    }
  }
}
