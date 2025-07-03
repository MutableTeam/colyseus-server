import { Schema, type } from "@colyseus/schema"
import { Vector3D } from "./Vector3D"
import { Quaternion } from "./Quaternion"

export class Player extends Schema {
  @type("string") id = ""
  @type("string") sessionId = ""
  @type("string") name = ""
  @type("string") characterType = "default"
  @type("string") modelType = "default" // For different 3D models

  // 3D position and movement (common for all player types)
  @type(Vector3D) position = new Vector3D()
  @type(Vector3D) velocity = new Vector3D()
  @type(Vector3D) moveDirection = new Vector3D()
  @type(Quaternion) rotation = new Quaternion() // For 3D rotation

  // Physics properties (common for all player types)
  @type("number") speed = 5
  @type("number") jumpForce = 10
  @type("boolean") isGrounded = false
  @type("number") mass = 1
  @type("number") radius = 1 // For collision detection

  // General player state (common for all player types)
  @type("string") animationState = "idle" // idle, running, jumping, attacking, etc.
  @type("number") joinedAt = 0
  @type("string") status = "connected" // e.g., "connected", "in-lobby", "in-game"

  // Lobby specific properties (kept on base Player as it interacts with Hub/Lobby)
  @type("boolean") ready = false
  @type("string") selectedGameType = ""

  constructor() {
    super()
    this.joinedAt = Date.now()
  }

  // Helper method to update rotation from Euler angles (in radians)
  setRotationFromEuler(x: number, y: number, z: number) {
    this.rotation.setFromEuler(x, y, z)
  }

  // Helper to get forward direction vector based on rotation
  getForwardVector(): Vector3D {
    // This is a simplified calculation - in a real implementation
    // you would use quaternion math to get the actual forward vector
    const forward = new Vector3D(0, 0, -1)

    // Simple yaw rotation for this example (assuming Y-up coordinate system)
    // In a real implementation, you would use quaternion to vector conversion
    const angle = Math.atan2(this.rotation.y, this.rotation.w) * 2
    forward.x = Math.sin(angle)
    forward.z = -Math.cos(angle)

    return forward
  }

  // Method to set player ready state (for lobby)
  setReady(isReady: boolean) {
    this.ready = isReady
  }

  // Method to set selected game type (for lobby)
  selectGameType(gameType: string) {
    this.selectedGameType = gameType
  }
}
