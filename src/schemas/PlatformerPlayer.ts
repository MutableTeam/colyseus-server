import { Schema, type } from "@colyseus/schema"
import { Vector2D } from "./Vector2D"

export class PlatformerPlayer extends Schema {
  @type("string") id: string
  @type("string") name: string
  @type("string") characterType = "default"

  @type(Vector2D) position = new Vector2D()
  @type(Vector2D) velocity = new Vector2D()
  @type("number") moveDirection = 0 // -1 (left), 0 (none), 1 (right)
  @type("boolean") facingRight = true

  @type("number") width = 40
  @type("number") height = 80

  @type("number") speed = 200
  @type("number") jumpForce = 500
  @type("boolean") canJump = false

  @type("number") health = 3
  @type("number") maxHealth = 3
  @type("number") lives = 3
  @type("number") score = 0

  @type("boolean") attacking = false
  @type("number") attackCooldown = 0
  @type("number") attackCooldownTime = 0.5 // 0.5 seconds
  @type("number") attackRange = 50
  @type("number") attackDamage = 1

  @type("boolean") usingAbility = false
  @type("number") abilityCooldown = 0
  @type("number") abilityCooldownTime = 5 // 5 seconds

  @type("boolean") invulnerable = false
  @type("boolean") ready = false
  @type("boolean") gameOver = false
}
