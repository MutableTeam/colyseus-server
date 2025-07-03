import type { Player } from "../schemas/Player"
import type { Vector3D } from "../schemas/Vector3D"
import type { BattleState } from "../schemas/BattleState"

export class AbilityManager {
  getAbilitiesForCharacter(characterType: string): string[] {
    switch (characterType) {
      case "warrior":
        return ["charge", "shockwave"]
      case "mage":
        return ["fireball", "teleport"]
      case "archer":
        return ["multishot", "rapidFire"]
      default:
        return ["basicAttack"]
    }
  }

  useAbility(player: Player, abilityId: string, targetPosition: Vector3D | null, battleState: BattleState): boolean {
    // Check if player can use ability (cooldown)
    if (!player.canUseAbility(abilityId)) {
      return false
    }

    // Set animation state
    player.animationState = "casting"

    // Simple ability effects
    let success = false

    switch (abilityId) {
      case "charge":
        // Simple charge forward
        const forward = player.getForwardVector()
        player.velocity.x = forward.x * 20
        player.velocity.z = forward.z * 20
        success = true
        break

      case "shockwave":
        // Simple area damage
        battleState.players.forEach((otherPlayer: Player) => {
          if (otherPlayer.id !== player.id) {
            const dx = otherPlayer.position.x - player.position.x
            const dz = otherPlayer.position.z - player.position.z
            const distance = Math.sqrt(dx * dx + dz * dz)

            if (distance < 10) {
              otherPlayer.takeDamage(20)
            }
          }
        })
        success = true
        break

      case "fireball":
        // Create a projectile for fireball
        if (targetPosition) {
          const projectileId = `fireball_${player.id}_${Date.now()}`
          const direction = {
            x: targetPosition.x - player.position.x,
            y: targetPosition.y - player.position.y,
            z: targetPosition.z - player.position.z,
          }

          // Normalize direction
          const length = Math.sqrt(direction.x * direction.x + direction.y * direction.y + direction.z * direction.z)
          if (length > 0) {
            direction.x /= length
            direction.y /= length
            direction.z /= length
          }

          battleState.createProjectile(
            projectileId,
            player.id,
            player.position,
            direction,
            30, // speed
            40, // damage
          )
        }
        success = true
        break

      case "teleport":
        // Simple teleport to target position
        if (targetPosition) {
          player.position.x = targetPosition.x
          player.position.y = targetPosition.y
          player.position.z = targetPosition.z
        }
        success = true
        break

      default:
        success = false
    }

    if (success) {
      // Set ability cooldown
      player.setAbilityCooldown(abilityId)
    }

    return success
  }
}
