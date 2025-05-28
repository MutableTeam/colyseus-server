import type { Room } from "colyseus"
import type { Player } from "../schemas/Player"
import { Vector3D } from "../schemas/Vector3D"
import { Projectile } from "../schemas/Projectile"

export class AbilityManager {
  getAbilitiesForCharacter(characterType: string): string[] {
    switch (characterType) {
      case "warrior":
        return ["charge", "shockwave", "berserk"]
      case "mage":
        return ["fireball", "teleport", "frostNova"]
      case "archer":
        return ["multishot", "trap", "rapidFire"]
      case "rogue":
        return ["stealth", "smokeBomb", "backstab"]
      case "healer":
        return ["heal", "shield", "revive"]
      default:
        return ["basicAttack"]
    }
  }

  useAbility(room: Room, player: Player, abilityId: string, targetPosition: Vector3D | null): boolean {
    // Check if player can use ability (cooldown)
    if (!player.canUseAbility(abilityId)) {
      return false
    }

    let success = false

    switch (abilityId) {
      case "charge":
        success = this.useChargeAbility(room, player, targetPosition)
        break
      case "shockwave":
        success = this.useShockwaveAbility(room, player)
        break
      case "berserk":
        success = this.useBerserkAbility(room, player)
        break
      case "fireball":
        success = this.useFireballAbility(room, player, targetPosition)
        break
      case "teleport":
        success = this.useTeleportAbility(room, player, targetPosition)
        break
      case "frostNova":
        success = this.useFrostNovaAbility(room, player)
        break
      case "multishot":
        success = this.useMultishotAbility(room, player, targetPosition)
        break
      case "trap":
        success = this.useTrapAbility(room, player, targetPosition)
        break
      case "rapidFire":
        success = this.useRapidFireAbility(room, player)
        break
      case "stealth":
        success = this.useStealthAbility(room, player)
        break
      case "smokeBomb":
        success = this.useSmokeBombAbility(room, player)
        break
      case "backstab":
        success = this.useBackstabAbility(room, player, targetPosition)
        break
      case "heal":
        success = this.useHealAbility(room, player, targetPosition)
        break
      case "shield":
        success = this.useShieldAbility(room, player, targetPosition)
        break
      case "revive":
        success = this.useReviveAbility(room, player, targetPosition)
        break
      default:
        // No ability or basic attack
        return false
    }

    if (success) {
      // Set ability cooldown
      player.setAbilityCooldown(abilityId)

      // Broadcast ability used
      room.broadcast("ability_used", {
        playerId: player.id,
        abilityId: abilityId,
        targetPosition: targetPosition
          ? {
              x: targetPosition.x,
              y: targetPosition.y,
              z: targetPosition.z,
            }
          : null,
      })
    }

    return success
  }

  private useChargeAbility(room: Room, player: Player, targetPosition: Vector3D | null): boolean {
    console.log(`Player ${player.id} used charge ability`)

    // Get forward direction if no target position
    const direction = new Vector3D()

    if (targetPosition) {
      // Direction to target
      direction.x = targetPosition.x - player.position.x
      direction.y = 0 // Keep y-component zero to charge horizontally
      direction.z = targetPosition.z - player.position.z

      // Normalize
      const length = Math.sqrt(direction.x * direction.x + direction.z * direction.z)
      if (length > 0) {
        direction.x /= length
        direction.z /= length
      }
    } else {
      // Use player's forward direction
      const forward = player.getForwardVector()
      direction.x = forward.x
      direction.z = forward.z
    }

    // Apply charge impulse
    const chargeSpeed = 30
    player.velocity.x = direction.x * chargeSpeed
    player.velocity.z = direction.z * chargeSpeed

    // Set animation state
    player.animationState = "charging"

    return true
  }

  private useShockwaveAbility(room: Room, player: Player): boolean {
    console.log(`Player ${player.id} used shockwave ability`)

    // Create a shockwave effect
    // In Three.js, this would be visualized as an expanding ring

    // Affect all players within range
    const shockwaveRadius = 10
    const knockbackForce = 15
    const damage = 20

    room.state.players.forEach((otherPlayer) => {
      // Skip self
      if (otherPlayer.id === player.id) return

      // Calculate distance
      const dx = otherPlayer.position.x - player.position.x
      const dy = otherPlayer.position.y - player.position.y
      const dz = otherPlayer.position.z - player.position.z
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)

      if (distance <= shockwaveRadius) {
        // Apply knockback
        const knockbackDirection = new Vector3D(dx, 0, dz)
        const length = Math.sqrt(
          knockbackDirection.x * knockbackDirection.x + knockbackDirection.z * knockbackDirection.z,
        )

        if (length > 0) {
          knockbackDirection.x /= length
          knockbackDirection.z /= length

          otherPlayer.velocity.x = knockbackDirection.x * knockbackForce
          otherPlayer.velocity.y = 5 // Up force
          otherPlayer.velocity.z = knockbackDirection.z * knockbackForce
        }

        // Apply damage
        otherPlayer.health -= damage

        // Check if player died
        if (otherPlayer.health <= 0) {
          this.handlePlayerDeath(room, otherPlayer, player.id)
        }
      }
    })

    // Set animation state
    player.animationState = "shockwave"

    return true
  }

  private useBerserkAbility(room: Room, player: Player): boolean {
    console.log(`Player ${player.id} used berserk ability`)

    // Increase player's damage and speed temporarily
    // This would be implemented with a buff system
    // For now, we'll just broadcast it and let the client handle visual effects

    // Set animation state
    player.animationState = "berserk"

    return true
  }

  private useFireballAbility(room: Room, player: Player, targetPosition: Vector3D | null): boolean {
    console.log(`Player ${player.id} used fireball ability`)

    // Create a fireball projectile
    const projectile = new Projectile()
    projectile.id = `fireball_${player.id}_${Date.now()}`
    projectile.ownerId = player.id
    projectile.type = "fireball"
    projectile.damage = 30
    projectile.radius = 0.8
    projectile.lifetime = 3
    projectile.effectType = "fire"

    // Set initial position at player position (slightly forward)
    const forward = player.getForwardVector()
    projectile.position.x = player.position.x + forward.x * 1.5
    projectile.position.y = player.position.y + 1.5 // Adjust for height
    projectile.position.z = player.position.z + forward.z * 1.5

    // Set velocity based on target or forward direction
    const direction = new Vector3D()

    if (targetPosition) {
      // Direction to target
      direction.x = targetPosition.x - projectile.position.x
      direction.y = targetPosition.y - projectile.position.y
      direction.z = targetPosition.z - projectile.position.z

      // Normalize
      const length = Math.sqrt(direction.x * direction.x + direction.y * direction.y + direction.z * direction.z)
      if (length > 0) {
        direction.x /= length
        direction.y /= length
        direction.z /= length
      }
    } else {
      // Use player's forward direction
      direction.copy(forward)
      direction.y = 0.1 // Slight upward trajectory
    }

    // Set velocity
    projectile.velocity.x = direction.x * projectile.speed
    projectile.velocity.y = direction.y * projectile.speed
    projectile.velocity.z = direction.z * projectile.speed

    // Add projectile to game state
    room.state.projectiles.set(projectile.id, projectile)

    // Set animation state
    player.animationState = "casting"

    return true
  }

  private useTeleportAbility(room: Room, player: Player, targetPosition: Vector3D | null): boolean {
    console.log(`Player ${player.id} used teleport ability`)

    if (!targetPosition) {
      // Need a target position for teleport
      return false
    }

    // Check if target position is valid (within map boundaries)
    if (!this.isValidPosition(targetPosition, room.state.mapWidth, room.state.mapLength, room.state.mapHeight)) {
      return false
    }

    // Set animation state before teleport
    player.animationState = "teleporting"

    // Teleport player to target position
    player.position.x = targetPosition.x
    player.position.y = targetPosition.y
    player.position.z = targetPosition.z

    // Reset velocity
    player.velocity.x = 0
    player.velocity.y = 0
    player.velocity.z = 0

    return true
  }

  private useFrostNovaAbility(room: Room, player: Player): boolean {
    console.log(`Player ${player.id} used frost nova ability`)

    // Similar to shockwave but with freezing effect
    // For now, we'll just broadcast it and let the client handle visual effects

    // Set animation state
    player.animationState = "frostNova"

    return true
  }

  private useMultishotAbility(room: Room, player: Player, targetPosition: Vector3D | null): boolean {
    console.log(`Player ${player.id} used multishot ability`)

    // Create multiple arrow projectiles in a spread pattern
    const numArrows = 5
    const spreadAngle = Math.PI / 6 // 30 degrees

    // Get base direction
    const baseDirection = new Vector3D()

    if (targetPosition) {
      // Direction to target
      baseDirection.x = targetPosition.x - player.position.x
      baseDirection.y = targetPosition.y - player.position.y
      baseDirection.z = targetPosition.z - player.position.z

      // Normalize
      const length = Math.sqrt(
        baseDirection.x * baseDirection.x + baseDirection.y * baseDirection.y + baseDirection.z * baseDirection.z,
      )
      if (length > 0) {
        baseDirection.x /= length
        baseDirection.y /= length
        baseDirection.z /= length
      }
    } else {
      // Use player's forward direction
      const forward = player.getForwardVector()
      baseDirection.copy(forward)
    }

    // Create arrows with spread
    for (let i = 0; i < numArrows; i++) {
      const angle = spreadAngle * (i - (numArrows - 1) / 2)

      // Rotate direction around Y axis
      const direction = new Vector3D()
      direction.x = baseDirection.x * Math.cos(angle) - baseDirection.z * Math.sin(angle)
      direction.y = baseDirection.y
      direction.z = baseDirection.x * Math.sin(angle) + baseDirection.z * Math.cos(angle)

      // Create arrow projectile
      const projectile = new Projectile()
      projectile.id = `arrow_${player.id}_${Date.now()}_${i}`
      projectile.ownerId = player.id
      projectile.type = "arrow"
      projectile.damage = 15
      projectile.radius = 0.3
      projectile.lifetime = 2

      // Set initial position at player position
      projectile.position.x = player.position.x + direction.x * 1.5
      projectile.position.y = player.position.y + 1.5 // Adjust for height
      projectile.position.z = player.position.z + direction.z * 1.5

      // Set velocity
      projectile.velocity.x = direction.x * projectile.speed
      projectile.velocity.y = direction.y * projectile.speed
      projectile.velocity.z = direction.z * projectile.speed

      // Add projectile to game state
      room.state.projectiles.set(projectile.id, projectile)
    }

    // Set animation state
    player.animationState = "shooting"

    return true
  }

  private useTrapAbility(room: Room, player: Player, targetPosition: Vector3D | null): boolean {
    console.log(`Player ${player.id} used trap ability`)

    // In a full implementation, you would create a trap object in the game state
    // For now, we'll just broadcast it and let the client handle visual effects

    // Set animation state
    player.animationState = "placing"

    return true
  }

  private useRapidFireAbility(room: Room, player: Player): boolean {
    console.log(`Player ${player.id} used rapid fire ability`)

    // In a full implementation, this would modify the player's attack speed
    // For now, we'll just broadcast it and let the client handle visual effects

    // Set animation state
    player.animationState = "rapidFire"

    return true
  }

  private useStealthAbility(room: Room, player: Player): boolean {
    console.log(`Player ${player.id} used stealth ability`)

    // In a full implementation, this would make the player invisible
    // For now, we'll just broadcast it and let the client handle visual effects

    // Set animation state
    player.animationState = "stealth"

    return true
  }

  private useSmokeBombAbility(room: Room, player: Player): boolean {
    console.log(`Player ${player.id} used smoke bomb ability`)

    // In a full implementation, this would create a smoke effect
    // For now, we'll just broadcast it and let the client handle visual effects

    // Set animation state
    player.animationState = "smokeBomb"

    return true
  }

  private useBackstabAbility(room: Room, player: Player, targetPosition: Vector3D | null): boolean {
    console.log(`Player ${player.id} used backstab ability`)

    // In a full implementation, this would teleport behind a target and attack
    // For now, we'll just broadcast it and let the client handle visual effects

    // Set animation state
    player.animationState = "backstab"

    return true
  }

  private useHealAbility(room: Room, player: Player, targetPosition: Vector3D | null): boolean {
    console.log(`Player ${player.id} used heal ability`)

    // Heal self or target
    const healAmount = 30

    if (targetPosition) {
      // Find closest player to target position
      let closestPlayer: Player | null = null
      let closestDistance = 5 // Maximum heal range

      room.state.players.forEach((otherPlayer) => {
        const dx = otherPlayer.position.x - targetPosition.x
        const dy = otherPlayer.position.y - targetPosition.y
        const dz = otherPlayer.position.z - targetPosition.z
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)

        if (distance < closestDistance) {
          closestDistance = distance
          closestPlayer = otherPlayer
        }
      })

      if (closestPlayer) {
        // Heal target
        closestPlayer.health = Math.min(closestPlayer.maxHealth, closestPlayer.health + healAmount)

        // Broadcast heal effect
        room.broadcast("player_healed", {
          healerId: player.id,
          targetId: closestPlayer.id,
          amount: healAmount,
        })
      }
    } else {
      // Heal self
      player.health = Math.min(player.maxHealth, player.health + healAmount)

      // Broadcast heal effect
      room.broadcast("player_healed", {
        healerId: player.id,
        targetId: player.id,
        amount: healAmount,
      })
    }

    // Set animation state
    player.animationState = "healing"

    return true
  }

  private useShieldAbility(room: Room, player: Player, targetPosition: Vector3D | null): boolean {
    console.log(`Player ${player.id} used shield ability`)

    // In a full implementation, this would create a shield effect
    // For now, we'll just broadcast it and let the client handle visual effects

    // Set animation state
    player.animationState = "shielding"

    return true
  }

  private useReviveAbility(room: Room, player: Player, targetPosition: Vector3D | null): boolean {
    console.log(`Player ${player.id} used revive ability`)

    // In a full implementation, this would revive a dead player
    // For now, we'll just broadcast it and let the client handle visual effects

    // Set animation state
    player.animationState = "reviving"

    return true
  }

  // Helper methods
  private isValidPosition(position: Vector3D, mapWidth: number, mapLength: number, mapHeight: number): boolean {
    return (
      position.x >= 0 &&
      position.x <= mapWidth &&
      position.z >= 0 &&
      position.z <= mapLength &&
      position.y >= 0 &&
      position.y <= mapHeight
    )
  }

  private handlePlayerDeath(room: Room, player: Player, killerId: string) {
    // Broadcast player death
    room.broadcast("player_died", {
      playerId: player.id,
      killerId: killerId,
    })

    // Update kill count for killer
    if (killerId && room.state.players.has(killerId)) {
      const killer = room.state.players.get(killerId)
      if (killer) {
        killer.kills += 1
      }
    }
  }
}
