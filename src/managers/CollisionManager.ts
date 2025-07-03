import type { Projectile } from "../schemas/Projectile"
import type { Player } from "../schemas/Player"
import type { MapObject } from "../schemas/BattleState"
import type { Vector3D } from "../schemas/Vector3D"

export class CollisionManager {
  // Check collision between projectile and player
  checkProjectilePlayerCollision(projectile: Projectile, player: Player): boolean {
    // Skip if it's the player who shot the projectile
    if (player.id === projectile.ownerId) return false

    // Simple sphere collision detection in 3D
    const dx = projectile.position.x - player.position.x
    const dy = projectile.position.y - player.position.y
    const dz = projectile.position.z - player.position.z
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)

    return distance < projectile.radius + player.radius
  }

  // Check collision between player and map object
  checkPlayerMapObjectCollision(player: Player, mapObject: MapObject): boolean {
    // This is a simplified collision check
    // In a real implementation, you would use more sophisticated collision detection
    // based on the shape of the map object (box, sphere, mesh, etc.)

    // Simple box collision example
    const playerRadius = player.radius

    // Assuming mapObject has a box shape with dimensions defined by scale
    const halfWidth = mapObject.scale.x / 2
    const halfHeight = mapObject.scale.y / 2
    const halfLength = mapObject.scale.z / 2

    // Check if player sphere intersects with object box
    const dx = Math.abs(player.position.x - mapObject.position.x)
    const dy = Math.abs(player.position.y - mapObject.position.y)
    const dz = Math.abs(player.position.z - mapObject.position.z)

    if (dx > halfWidth + playerRadius) return false
    if (dy > halfHeight + playerRadius) return false
    if (dz > halfLength + playerRadius) return false

    if (dx <= halfWidth) return true
    if (dy <= halfHeight) return true
    if (dz <= halfLength) return true

    // Check corners
    const cornerDistanceSq = Math.pow(dx - halfWidth, 2) + Math.pow(dy - halfHeight, 2) + Math.pow(dz - halfLength, 2)

    return cornerDistanceSq <= Math.pow(playerRadius, 2)
  }

  // Check if player is on ground
  checkPlayerGround(player: Player, groundY: number): boolean {
    return player.position.y - player.radius <= groundY
  }

  // Check if a point is within map boundaries
  isWithinMapBoundaries(position: Vector3D, mapWidth: number, mapLength: number, mapHeight: number): boolean {
    return (
      position.x >= 0 &&
      position.x <= mapWidth &&
      position.z >= 0 &&
      position.z <= mapLength &&
      position.y >= 0 &&
      position.y <= mapHeight
    )
  }

  // Resolve collision by adjusting position
  resolveCollision(player: Player, mapObject: MapObject): void {
    // Simple position adjustment
    // In a real implementation, you would use more sophisticated collision response

    // Calculate displacement vector
    const dx = player.position.x - mapObject.position.x
    const dy = player.position.y - mapObject.position.y
    const dz = player.position.z - mapObject.position.z

    // Normalize
    const length = Math.sqrt(dx * dx + dy * dy + dz * dz)
    const nx = dx / length
    const ny = dy / length
    const nz = dz / length

    // Calculate penetration depth
    const penetrationDepth = player.radius - length

    // Adjust position
    if (penetrationDepth > 0) {
      player.position.x += nx * penetrationDepth
      player.position.y += ny * penetrationDepth
      player.position.z += nz * penetrationDepth

      // Adjust velocity (bounce/slide effect)
      // This is a simplified physics response
      const dot = player.velocity.x * nx + player.velocity.y * ny + player.velocity.z * nz
      player.velocity.x -= 2 * dot * nx
      player.velocity.y -= 2 * dot * ny
      player.velocity.z -= 2 * dot * nz
    }
  }
}
