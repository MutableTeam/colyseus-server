import type { Room } from "@colyseus/core"
import type { Player } from "../schemas/Player"
import type { Vector3D } from "../schemas/Vector3D"

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

  useAbility(room: Room, player: Player, abilityId: string, targetPosition: Vector3D | null): boolean {
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
        room.state.players.forEach((otherPlayer: Player) => {
          if (otherPlayer.id !== player.id) {
            const dx = otherPlayer.position.x - player.position.x
            const dz = otherPlayer.position.z - player.position.z
            const distance = Math.sqrt(dx * dx + dz * dz)

            if (distance < 10) {
              otherPlayer.health -= 20
            }
          }
        })
        success = true
        break

      case "fireball":
        // Just broadcast the effect
        room.broadcast("ability_used", {
          playerId: player.id,
          abilityId: "fireball",
        })
        success = true
        break

      default:
        success = false
    }

    if (success) {
      // Set ability cooldown
      player.setAbilityCooldown(abilityId)

      // Broadcast ability used
      room.broadcast("ability_used", {
        playerId: player.id,
        abilityId: abilityId,
      })
    }

    return success
  }
}
