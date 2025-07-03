import type { Player } from "../schemas/Player"
import type { Projectile } from "../schemas/Projectile"
import type { Vector3D } from "../schemas/Vector3D"

export class CollisionManager {
  checkPlayerCollision(player1: Player, player2: Player): boolean {
    const dx = player1.position.x - player2.position.x
    const dy = player1.position.y - player2.position.y
    const dz = player1.position.z - player2.position.z
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)

    return distance < player1.radius + player2.radius
  }

  checkProjectilePlayerCollision(projectile: Projectile, player: Player): boolean {
    const dx = projectile.position.x - player.position.x
    const dy = projectile.position.y - player.position.y
    const dz = projectile.position.z - player.position.z
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)

    return distance < projectile.radius + player.radius
  }

  checkBoundaryCollision(position: Vector3D, mapWidth: number, mapLength: number, mapHeight: number): boolean {
    return (
      position.x < -mapWidth / 2 ||
      position.x > mapWidth / 2 ||
      position.z < -mapLength / 2 ||
      position.z > mapLength / 2 ||
      position.y < 0 ||
      position.y > mapHeight
    )
  }

  getDistance(pos1: Vector3D, pos2: Vector3D): number {
    const dx = pos1.x - pos2.x
    const dy = pos1.y - pos2.y
    const dz = pos1.z - pos2.z
    return Math.sqrt(dx * dx + dy * dy + dz * dz)
  }

  isPointInSphere(point: Vector3D, center: Vector3D, radius: number): boolean {
    return this.getDistance(point, center) <= radius
  }

  raycastToPlayer(origin: Vector3D, direction: Vector3D, player: Player, maxDistance: number): boolean {
    // Simple raycast implementation
    const steps = Math.floor(maxDistance)
    const stepSize = maxDistance / steps

    for (let i = 0; i <= steps; i++) {
      const testPoint = {
        x: origin.x + direction.x * stepSize * i,
        y: origin.y + direction.y * stepSize * i,
        z: origin.z + direction.z * stepSize * i,
      }

      if (this.getDistance(testPoint, player.position) <= player.radius) {
        return true
      }
    }

    return false
  }
}
