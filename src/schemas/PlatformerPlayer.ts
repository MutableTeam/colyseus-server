import { Schema, type, view } from "@colyseus/schema"
import { Vector2D } from "./Vector2D"

export class PlatformerPlayer extends Schema {
  @type("string") id: string
  @type("string") name: string
  @type("string") characterType = "default"

  @view() @type(Vector2D) position = new Vector2D()
  @view() @type(Vector2D) velocity = new Vector2D()
  @view() @type("number") moveDirection = 0 // -1 (left), 0 (none), 1 (right)
  @view() @type("boolean") facingRight = true

  @type("number") width = 40
  @type("number") height = 80

  @type("number") speed = 200
  @type("number") jumpForce = 500
  @view() @type("boolean") canJump = false

  @view() @type("number") health = 3
  @type("number") maxHealth = 3
  @type("number") lives = 3
  @view() @type("number") score = 0

  @view() @type("boolean") attacking = false
  @view() @type("number") attackCooldown = 0
  @type("number") attackCooldownTime = 0.5 // 0.5 seconds
  @type("number") attackRange = 50
  @type("number") attackDamage = 1

  @view() @type("boolean") usingAbility = false
  @view() @type("number") abilityCooldown = 0
  @type("number") abilityCooldownTime = 5 // 5 seconds

  @view() @type("boolean") invulnerable = false
  @type("boolean") ready = false
  @view() @type("boolean") gameOver = false
}
