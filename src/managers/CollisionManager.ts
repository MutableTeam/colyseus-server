import type { Projectile } from "../schemas/Projectile"
import type { Player } from "../schemas/Player"

export class CollisionManager {
  checkCollision(projectile: Projectile, player: Player): boolean {
    // Simple circle collision detection
    const dx = projectile.position.x - player.position.x
    const dy = projectile.position.y - player.position.y
    const distance = Math.sqrt(dx * dx + dy * dy)

    // Assuming player has a radius of 20
    const playerRadius = 20

    return distance < projectile.radius + playerRadius
  }
}
