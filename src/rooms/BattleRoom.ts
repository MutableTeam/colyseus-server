import { Room, type Client } from "colyseus"
import { BattleState } from "../schemas/BattleState"
import { Player } from "../schemas/Player"
import { Projectile } from "../schemas/Projectile"
import { AbilityManager } from "../managers/AbilityManager"
import { CollisionManager } from "../managers/CollisionManager"
import { Vector2D } from "../schemas/Vector2D"

export class BattleRoom extends Room<BattleState> {
  maxClients = 8

  // Game settings
  private mapWidth = 2000
  private mapHeight = 2000
  private tickRate = 20 // 20 updates per second
  private abilityManager: AbilityManager
  private collisionManager: CollisionManager

  onCreate(options: any) {
    console.log("BattleRoom created!", options)

    // Set metadata for room listing
    this.setMetadata({
      name: options.name || "Battle Arena",
      gameType: "battle",
      mapWidth: this.mapWidth,
      mapHeight: this.mapHeight,
      creatorId: options.creatorId,
      ...options,
    })

    // Set map dimensions from options or use defaults
    this.mapWidth = options.mapWidth || this.mapWidth
    this.mapHeight = options.mapHeight || this.mapHeight

    // Initialize the room state
    this.setState(new BattleState(this.mapWidth, this.mapHeight))

    // Initialize managers
    this.abilityManager = new AbilityManager()
    this.collisionManager = new CollisionManager()

    // Set up physics simulation
    this.setSimulationInterval((deltaTime) => this.update(deltaTime), 1000 / this.tickRate)

    // Handle player movement (updated for Three.js compatibility with validation)
    this.onMessage("move", (client, message) => {
      const player = this.state.players.get(client.sessionId)
      if (!player) return

      // Validate message structure and provide defaults
      if (!message || typeof message !== "object") {
        console.warn(`Invalid move message from ${client.sessionId}:`, message)
        return
      }

      // Update player's movement direction and speed with validation
      player.moveDirection.x = typeof message.x === "number" ? message.x : 0
      player.moveDirection.y = typeof message.y === "number" ? message.y : 0
      player.moveDirection.z = typeof message.z === "number" ? message.z : 0

      // Validate speed
      if (typeof message.speed === "number" && message.speed >= 0) {
        player.speed = Math.min(message.speed, 500) // Cap max speed
      }

      // Update rotation if provided (for 3D) with validation
      if (message.rotation && typeof message.rotation === "object") {
        if (!player.rotation) {
          player.rotation = new Vector2D()
        }
        player.rotation.x = typeof message.rotation.x === "number" ? message.rotation.x : 0
        player.rotation.y = typeof message.rotation.y === "number" ? message.rotation.y : 0
      }
    })

    // Handle player shooting (updated for 3D with validation)
    this.onMessage("shoot", (client, message) => {
      const player = this.state.players.get(client.sessionId)
      if (!player) return

      // Validate message
      if (!message || typeof message !== "object") {
        console.warn(`Invalid shoot message from ${client.sessionId}:`, message)
        return
      }

      // Check if player can shoot (cooldown)
      if (player.canShoot()) {
        // Handle both 2D angle and 3D direction with validation
        let angle = 0
        const direction = { x: 0, y: 0, z: 0 }

        if (typeof message.angle === "number") {
          angle = message.angle
        } else if (message.direction && typeof message.direction === "object") {
          direction.x = typeof message.direction.x === "number" ? message.direction.x : 0
          direction.y = typeof message.direction.y === "number" ? message.direction.y : 0
          direction.z = typeof message.direction.z === "number" ? message.direction.z : 0
          // Calculate angle from direction for 2D compatibility
          angle = Math.atan2(direction.y, direction.x)
        }

        const projectileType = typeof message.type === "string" ? message.type : "default"
        const projectile = this.createProjectile(player, angle, projectileType, direction)
        this.state.projectiles.set(projectile.id, projectile)
        player.lastShotTime = Date.now()
      }
    })

    // Handle player using abilities with validation
    this.onMessage("use_ability", (client, message) => {
      const player = this.state.players.get(client.sessionId)
      if (!player) return

      // Validate message
      if (!message || typeof message !== "object" || typeof message.abilityId !== "string") {
        console.warn(`Invalid use_ability message from ${client.sessionId}:`, message)
        return
      }

      // Validate target position if provided
      let targetPosition = null
      if (message.targetPosition && typeof message.targetPosition === "object") {
        targetPosition = {
          x: typeof message.targetPosition.x === "number" ? message.targetPosition.x : 0,
          y: typeof message.targetPosition.y === "number" ? message.targetPosition.y : 0,
          z: typeof message.targetPosition.z === "number" ? message.targetPosition.z : 0,
        }
      }

      // Always execute ability usage and cooldown setting
      player.setAbilityCooldown(message.abilityId)
      this.useAbility(player, message.abilityId, targetPosition)
    })

    // Handle player changing character with validation
    this.onMessage("change_character", (client, message) => {
      const player = this.state.players.get(client.sessionId)
      if (!player || this.state.gameStarted) return // Can't change after game starts

      // Validate message
      if (!message || typeof message !== "object" || typeof message.characterType !== "string") {
        console.warn(`Invalid change_character message from ${client.sessionId}:`, message)
        return
      }

      player.characterType = message.characterType
      player.abilities = this.abilityManager.getAbilitiesForCharacter(message.characterType)

      // Broadcast character change to all clients
      this.broadcast("character_changed", {
        playerId: client.sessionId,
        characterType: message.characterType,
      })
    })

    // Handle ready state with validation
    this.onMessage("ready", (client, message) => {
      const player = this.state.players.get(client.sessionId)
      if (!player) return

      // Validate message
      if (!message || typeof message !== "object" || typeof message.ready !== "boolean") {
        console.warn(`Invalid ready message from ${client.sessionId}:`, message)
        return
      }

      player.ready = message.ready

      // Check if all players are ready to start the game
      this.checkGameStart()
    })

    // Handle key presses (1-9, shift, space) with validation
    this.onMessage("key_press", (client, message) => {
      const player = this.state.players.get(client.sessionId)
      if (!player) return

      // Validate message
      if (
        !message ||
        typeof message !== "object" ||
        typeof message.key !== "string" ||
        typeof message.pressed !== "boolean"
      ) {
        console.warn(`Invalid key_press message from ${client.sessionId}:`, message)
        return
      }

      const { key, pressed } = message

      // Handle number keys (1-9)
      if (/^[1-9]$/.test(key)) {
        const abilityIndex = Number.parseInt(key) - 1
        if (player.abilities && player.abilities.length > abilityIndex) {
          const abilityId = player.abilities[abilityIndex]
          if (pressed && player.canUseAbility(abilityId)) {
            // Validate target position if provided
            let targetPosition = null
            if (message.targetPosition && typeof message.targetPosition === "object") {
              targetPosition = {
                x: typeof message.targetPosition.x === "number" ? message.targetPosition.x : 0,
                y: typeof message.targetPosition.y === "number" ? message.targetPosition.y : 0,
                z: typeof message.targetPosition.z === "number" ? message.targetPosition.z : 0,
              }
            }

            player.setAbilityCooldown(abilityId)
            this.useAbility(player, abilityId, targetPosition)
          }
        }
      }

      // Handle shift key (sprint)
      if (key === "shift") {
        player.sprinting = pressed
        player.speed = pressed ? 300 : 200 // Increase speed when sprinting
      }

      // Handle space key (jump)
      if (key === "space" && pressed) {
        this.handleJump(player)
      }
    })

    // Handle mouse clicks with validation
    this.onMessage("mouse_click", (client, message) => {
      const player = this.state.players.get(client.sessionId)
      if (!player) return

      // Validate message
      if (!message || typeof message !== "object" || typeof message.button !== "number") {
        console.warn(`Invalid mouse_click message from ${client.sessionId}:`, message)
        return
      }

      const { button } = message

      // Validate position
      const position = { x: 0, y: 0, z: 0 }
      if (message.position && typeof message.position === "object") {
        position.x = typeof message.position.x === "number" ? message.position.x : 0
        position.y = typeof message.position.y === "number" ? message.position.y : 0
        position.z = typeof message.position.z === "number" ? message.position.z : 0
      }

      // Left click (0) - primary action (shoot)
      if (button === 0 && player.canShoot()) {
        const angle = Math.atan2(position.y - player.position.y, position.x - player.position.x)

        const projectile = this.createProjectile(player, angle, "default")
        this.state.projectiles.set(projectile.id, projectile)
        player.lastShotTime = Date.now()
      }

      // Right click (2) - secondary action (special ability)
      if (button === 2 && player.abilities && player.abilities.length > 0) {
        const abilityId = player.abilities[0] // Use first ability
        if (player.canUseAbility(abilityId)) {
          player.setAbilityCooldown(abilityId)
          this.useAbility(player, abilityId, position)
        }
      }
    })
  }

  onJoin(client: Client, options: any) {
    console.log(`Player ${client.sessionId} joined the battle room`)

    // Create a new player
    const player = new Player()
    player.id = client.sessionId
    player.name = options.username || `Player_${client.sessionId.substr(0, 6)}`
    player.characterType = options.characterType || "default"

    // Set initial position (random within the map)
    player.position.x = Math.random() * this.mapWidth
    player.position.y = Math.random() * this.mapHeight
    player.position.z = 0 // Default Z position for 3D compatibility

    // Initialize rotation for 3D
    player.rotation = new Vector2D()
    player.rotation.x = 0
    player.rotation.y = 0

    // Set abilities based on character type
    player.abilities = this.abilityManager.getAbilitiesForCharacter(player.characterType)

    // Add player to the game state
    this.state.players.set(client.sessionId, player)

    // Broadcast new player joined
    this.broadcast("player_joined", {
      id: player.id,
      name: player.name,
      characterType: player.characterType,
      position: {
        x: player.position.x,
        y: player.position.y,
        z: player.position.z,
      },
    })
  }

  onLeave(client: Client, consented: boolean) {
    console.log(`Player ${client.sessionId} left the battle room`)

    // Remove player from the game state
    if (this.state.players.has(client.sessionId)) {
      this.state.players.delete(client.sessionId)

      // Broadcast player left
      this.broadcast("player_left", { id: client.sessionId })

      // Check if game should end (e.g., only one player left)
      this.checkGameEnd()
    }
  }

  onDispose() {
    console.log("Battle room disposed")
  }

  private handleJump(player: Player) {
    // Implement jump logic here
    // For example, set a vertical velocity if the player is on the ground
    if (player.onGround) {
      player.velocity.y = -10 // Negative is up in many game engines
      player.onGround = false

      // Broadcast jump event
      this.broadcast("player_jump", {
        playerId: player.id,
      })
    }
  }

  private update(deltaTime: number) {
    // Convert to seconds for physics calculations
    const dt = deltaTime / 1000

    // Update player positions
    this.state.players.forEach((player) => {
      // Skip dead players
      if (player.health <= 0) return

      // Update position based on movement direction and speed
      player.position.x += player.moveDirection.x * player.speed * dt
      player.position.y += player.moveDirection.y * player.speed * dt

      // Update Z position for 3D
      if (player.moveDirection.z) {
        player.position.z += player.moveDirection.z * player.speed * dt
      }

      // Apply gravity and velocity for jumping
      if (!player.onGround) {
        player.velocity.y += 20 * dt // Gravity
        player.position.y += player.velocity.y * dt

        // Check if player landed
        if (player.position.y >= 0) {
          // Assuming 0 is ground level
          player.position.y = 0
          player.velocity.y = 0
          player.onGround = true
        }
      }

      // Keep player within map boundaries
      player.position.x = Math.max(0, Math.min(this.mapWidth, player.position.x))
      player.position.y = Math.max(0, Math.min(this.mapHeight, player.position.y))

      // Update cooldowns
      player.updateCooldowns()
    })

    // Update projectiles
    this.state.projectiles.forEach((projectile) => {
      // Update position based on velocity
      projectile.position.x += projectile.velocity.x * dt
      projectile.position.y += projectile.velocity.y * dt

      // Update Z position for 3D projectiles
      if (projectile.velocity.z) {
        projectile.position.z += projectile.velocity.z * dt
      }

      // Check if projectile is out of bounds
      if (
        projectile.position.x < 0 ||
        projectile.position.x > this.mapWidth ||
        projectile.position.y < 0 ||
        projectile.position.y > this.mapHeight
      ) {
        this.state.projectiles.delete(projectile.id)
        return
      }

      // Check lifetime
      projectile.lifetime -= dt
      if (projectile.lifetime <= 0) {
        this.state.projectiles.delete(projectile.id)
        return
      }

      // Check collisions with players
      this.state.players.forEach((player) => {
        // Skip if it's the player who shot the projectile or if player is dead
        if (player.id === projectile.ownerId || player.health <= 0) return

        // Check collision
        if (this.collisionManager.checkCollision(projectile, player)) {
          // Apply damage to player
          player.health -= projectile.damage

          // Check if player died
          if (player.health <= 0) {
            this.handlePlayerDeath(player, projectile.ownerId)
          }

          // Remove projectile
          this.state.projectiles.delete(projectile.id)
        }
      })
    })

    // Update game time
    if (this.state.gameStarted && !this.state.gameEnded) {
      this.state.gameTime += dt

      // Check time-based game end conditions
      if (this.state.gameTime >= this.state.maxGameTime) {
        this.endGame("time_limit")
      }
    }
  }

  private createProjectile(player: Player, angle: number, type: string, direction?: any): Projectile {
    const projectile = new Projectile()
    projectile.id = `${player.id}_${Date.now()}`
    projectile.ownerId = player.id
    projectile.type = type || "default"

    // Set initial position (at player position)
    projectile.position.x = player.position.x
    projectile.position.y = player.position.y
    projectile.position.z = player.position.z || 0

    // Set velocity based on angle or direction
    const speed = 500 // pixels per second

    if (direction && (direction.x !== 0 || direction.y !== 0 || direction.z !== 0)) {
      // 3D direction
      projectile.velocity.x = direction.x * speed
      projectile.velocity.y = direction.y * speed
      projectile.velocity.z = direction.z * speed
    } else {
      // 2D angle
      projectile.velocity.x = Math.cos(angle) * speed
      projectile.velocity.y = Math.sin(angle) * speed
      projectile.velocity.z = 0
    }

    // Set properties based on projectile type
    switch (projectile.type) {
      case "fireball":
        projectile.damage = 20
        projectile.radius = 10
        projectile.lifetime = 2
        break
      case "arrow":
        projectile.damage = 15
        projectile.radius = 5
        projectile.lifetime = 1.5
        break
      case "laser":
        projectile.damage = 10
        projectile.radius = 3
        projectile.lifetime = 1
        break
      default:
        projectile.damage = 10
        projectile.radius = 5
        projectile.lifetime = 2
    }

    return projectile
  }

  private handlePlayerDeath(player: Player, killerId: string) {
    // Broadcast player death
    this.broadcast("player_died", {
      playerId: player.id,
      killerId: killerId,
    })

    // Update kill count for killer
    if (killerId && this.state.players.has(killerId)) {
      const killer = this.state.players.get(killerId)
      if (killer) {
        killer.kills += 1
      }
    }

    // Check if game should end
    this.checkGameEnd()
  }

  private checkGameStart() {
    // Don't start if already started
    if (this.state.gameStarted) return

    // Check if all players are ready
    let allReady = true
    let playerCount = 0

    this.state.players.forEach((player) => {
      playerCount++
      if (!player.ready) {
        allReady = false
      }
    })

    // Need at least 2 players and all must be ready
    if (playerCount >= 2 && allReady) {
      this.startGame()
    }
  }

  private startGame() {
    this.state.gameStarted = true
    this.state.gameStartTime = Date.now()

    // Reset player positions to spawn points
    let spawnIndex = 0
    const spawnPoints = [
      { x: 100, y: 100, z: 0 },
      { x: this.mapWidth - 100, y: 100, z: 0 },
      { x: 100, y: this.mapHeight - 100, z: 0 },
      { x: this.mapWidth - 100, y: this.mapHeight - 100, z: 0 },
      { x: this.mapWidth / 2, y: 100, z: 0 },
      { x: this.mapWidth / 2, y: this.mapHeight - 100, z: 0 },
      { x: 100, y: this.mapHeight / 2, z: 0 },
      { x: this.mapWidth - 100, y: this.mapHeight / 2, z: 0 },
    ]

    this.state.players.forEach((player) => {
      const spawn = spawnPoints[spawnIndex % spawnPoints.length]
      player.position.x = spawn.x
      player.position.y = spawn.y
      player.position.z = spawn.z
      player.health = 100 // Reset health
      player.kills = 0 // Reset kills
      spawnIndex++
    })

    // Broadcast game start
    this.broadcast("game_started", {
      mapWidth: this.mapWidth,
      mapHeight: this.mapHeight,
      maxGameTime: this.state.maxGameTime,
    })
  }

  private checkGameEnd() {
    // Don't check if game hasn't started or already ended
    if (!this.state.gameStarted || this.state.gameEnded) return

    // Count alive players
    let alivePlayers = 0
    let lastAlivePlayerId = ""

    this.state.players.forEach((player) => {
      if (player.health > 0) {
        alivePlayers++
        lastAlivePlayerId = player.id
      }
    })

    // End game if only one player left
    if (alivePlayers <= 1) {
      this.endGame("last_player_standing", lastAlivePlayerId)
    }
  }

  private endGame(reason: string, winnerId?: string) {
    this.state.gameEnded = true
    this.state.gameEndTime = Date.now()

    // Find player with most kills if no winner by last standing
    if (!winnerId) {
      let maxKills = -1

      this.state.players.forEach((player) => {
        if (player.kills > maxKills) {
          maxKills = player.kills
          winnerId = player.id
        }
      })
    }

    // Broadcast game end
    this.broadcast("game_ended", {
      reason: reason,
      winnerId: winnerId,
      gameTime: this.state.gameTime,
      playerStats: Array.from(this.state.players.entries()).map(([id, player]) => ({
        id: id,
        name: player.name,
        kills: player.kills,
        characterType: player.characterType,
      })),
    })

    // Schedule room disposal
    this.clock.setTimeout(() => {
      this.disconnect()
    }, 10000) // Give clients 10 seconds to receive final state
  }

  private useAbility(player: Player, abilityId: string, targetPosition?: any) {
    this.abilityManager.useAbility(this, player, abilityId, targetPosition)
  }
}
