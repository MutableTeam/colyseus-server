import { Room, type Client, updateLobby } from "@colyseus/core"
import { BattleState, MapObject } from "../schemas/BattleState"
import { Player } from "../schemas/Player"
import { Projectile } from "../schemas/Projectile"
import { AbilityManager } from "../managers/AbilityManager"
import { CollisionManager } from "../managers/CollisionManager"
import { Vector3D } from "../schemas/Vector3D"

export class BattleRoom extends Room<BattleState> {
  maxClients = 16

  // Game settings
  private mapWidth = 100
  private mapLength = 100
  private mapHeight = 50
  private gravity = 9.8
  private tickRate = 60 // 60 updates per second for smooth Three.js rendering
  private abilityManager: AbilityManager = new AbilityManager()
  private collisionManager: CollisionManager = new CollisionManager()

  onCreate(options: any) {
    console.log("BattleRoom created!", options)

    // Set metadata for lobby discovery
    this.setMetadata({
      name: options.roomName || `Battle_${Date.now().toString().substring(8)}`,
      gameMode: options.gameMode || "deathmatch",
      mapTheme: options.mapTheme || "default",
      isPublic: !options.private,
      createdAt: Date.now(),
    })

    // Set map dimensions from options or use defaults
    this.mapWidth = options.mapWidth || this.mapWidth
    this.mapLength = options.mapLength || this.mapLength
    this.mapHeight = options.mapHeight || this.mapHeight
    this.gravity = options.gravity || this.gravity

    // Initialize the room state
    this.setState(new BattleState(this.mapWidth, this.mapLength, this.mapHeight))
    this.state.gravity = this.gravity

    // Set game mode
    this.state.gameMode = options.gameMode || "deathmatch"

    // Set environment settings
    this.state.timeOfDay = options.timeOfDay || "day"
    this.state.weather = options.weather || "clear"

    // Load map objects
    this.loadMapObjects(options.mapId || "default")

    // Set up physics simulation
    this.setSimulationInterval((deltaTime: number) => this.update(deltaTime), 1000 / this.tickRate)

    // Handle player movement
    this.onMessage("move", (client: Client, message: any) => {
      const player = this.state.players.get(client.sessionId)
      if (!player) return

      // Update player's movement direction
      player.moveDirection.x = message.x || 0
      player.moveDirection.y = message.y || 0
      player.moveDirection.z = message.z || 0

      // Update player's rotation (if provided)
      if (message.rotation) {
        player.rotation.x = message.rotation.x || 0
        player.rotation.y = message.rotation.y || 0
        player.rotation.z = message.rotation.z || 0
        player.rotation.w = message.rotation.w || 1
      }

      // Update animation state
      if (player.moveDirection.x !== 0 || player.moveDirection.z !== 0) {
        player.animationState = player.isGrounded ? "running" : "jumping"
      } else {
        player.animationState = player.isGrounded ? "idle" : "jumping"
      }
    })

    // Handle player jumping
    this.onMessage("jump", (client: Client) => {
      const player = this.state.players.get(client.sessionId)
      if (!player || !player.isGrounded) return

      player.velocity.y = player.jumpForce
      player.isGrounded = false
      player.animationState = "jumping"
    })

    // Handle player shooting
    this.onMessage("shoot", (client: Client, message: any) => {
      const player = this.state.players.get(client.sessionId)
      if (!player) return

      // Check if player can shoot (cooldown)
      if (player.canShoot()) {
        const direction = new Vector3D(message.direction.x || 0, message.direction.y || 0, message.direction.z || 0)

        const projectile = this.createProjectile(player, direction, message.type)
        this.state.projectiles.set(projectile.id, projectile)
        player.lastShotTime = Date.now()

        // Set animation state
        player.animationState = "shooting"
      }
    })

    // Handle player using abilities
    this.onMessage("use_ability", (client: Client, message: any) => {
      const player = this.state.players.get(client.sessionId)
      if (!player) return

      let targetPosition = null
      if (message.targetPosition) {
        targetPosition = new Vector3D(
          message.targetPosition.x || 0,
          message.targetPosition.y || 0,
          message.targetPosition.z || 0,
        )
      }

      // Call useAbility outside of conditional logic
      this.abilityManager.useAbility(this, player, message.abilityId, targetPosition)
    })

    // Handle player changing character
    this.onMessage("change_character", (client: Client, message: any) => {
      const player = this.state.players.get(client.sessionId)
      if (!player || this.state.gameStarted) return // Can't change after game starts

      player.characterType = message.characterType
      player.modelType = message.modelType || player.characterType
      player.abilities = this.abilityManager.getAbilitiesForCharacter(message.characterType)

      // Broadcast character change to all clients
      this.broadcast("character_changed", {
        playerId: client.sessionId,
        characterType: message.characterType,
        modelType: player.modelType,
      })
    })

    // Handle ready state - ENHANCED VERSION
    this.onMessage("ready", (client: Client, message: any) => {
      try {
        console.log(`🎯 BattleRoom: Player ${client.sessionId} ready state message:`, message)

        const player = this.state.players.get(client.sessionId)
        if (!player) {
          console.log(`❌ BattleRoom: Player ${client.sessionId} not found in state`)
          client.send("error", { message: "Player not found in battle room" })
          return
        }

        // Validate message
        if (typeof message.ready !== "boolean") {
          console.log(`❌ BattleRoom: Invalid ready state from ${client.sessionId}:`, message.ready)
          client.send("error", { message: "Invalid ready state" })
          return
        }

        // Update player ready state
        const oldReadyState = player.ready
        player.ready = message.ready

        console.log(
          `✅ BattleRoom: Player ${client.sessionId} (${player.name}) ready state changed from ${oldReadyState} to ${player.ready}`,
        )

        // Broadcast ready state change to all clients
        this.broadcast("player_ready_changed", {
          playerId: client.sessionId,
          playerName: player.name,
          ready: player.ready,
          timestamp: Date.now(),
        })

        // Check if all players are ready
        let allReady = true
        let readyCount = 0
        let totalPlayers = 0

        this.state.players.forEach((p) => {
          totalPlayers++
          if (p.ready) {
            readyCount++
          } else {
            allReady = false
          }
        })

        console.log(`📊 BattleRoom: Ready status - ${readyCount}/${totalPlayers} players ready`)

        // Broadcast ready count update
        this.broadcast("battle_ready_update", {
          readyCount,
          totalPlayers,
          allReady,
          timestamp: Date.now(),
        })

        // If all players are ready and we have at least 2 players, start countdown
        if (allReady && totalPlayers >= 2 && !this.state.gameStarted) {
          console.log(`🎉 BattleRoom: All ${totalPlayers} players are ready! Starting game...`)
          this.broadcast("all_players_ready", {
            playerCount: totalPlayers,
            readyCount,
            timestamp: Date.now(),
          })

          // Start the game after a short delay
          this.clock.setTimeout(() => {
            this.startGame()
          }, 3000) // 3 second countdown
        }
      } catch (error) {
        console.error(`❌ BattleRoom: Error handling ready message from ${client.sessionId}:`, error)
        client.send("error", { message: "Failed to process ready state" })
      }
    })

    // Add test message handler for debugging
    this.onMessage("test_message", (client: Client, message: any) => {
      console.log(`🧪 BattleRoom: Test message received from ${client.sessionId}:`, message)
      client.send("test_response", {
        message: "Battle room received your message!",
        timestamp: Date.now(),
        clientId: client.sessionId,
        roomId: this.roomId,
      })
    })

    // Handle ping/heartbeat messages
    this.onMessage("ping", (client: Client, message: any) => {
      client.send("pong", { timestamp: Date.now() })
    })

    console.log(`🎮 BattleRoom ${this.roomId} created and discoverable via lobby`)
  }

  onJoin(client: Client, options: any) {
    console.log(`Player ${client.sessionId} joined the battle room`)

    // Create a new player
    const player = new Player()
    player.id = client.sessionId
    player.name = options.username || `Player_${client.sessionId.substr(0, 6)}`
    player.characterType = options.characterType || "default"
    player.modelType = options.modelType || player.characterType

    // Set initial position (random within the map)
    const spawnPoint = this.getRandomSpawnPoint()
    player.position.x = spawnPoint.x
    player.position.y = spawnPoint.y
    player.position.z = spawnPoint.z

    // Set abilities based on character type
    player.abilities = this.abilityManager.getAbilitiesForCharacter(player.characterType)

    // Add player to the game state
    this.state.players.set(client.sessionId, player)

    // Update lobby with new player count
    this.updateLobbyMetadata()

    // Broadcast new player joined
    this.broadcast("player_joined", {
      id: player.id,
      name: player.name,
      characterType: player.characterType,
      modelType: player.modelType,
      position: {
        x: player.position.x,
        y: player.position.y,
        z: player.position.z,
      },
    })

    // Send current ready state to the new player
    let readyCount = 0
    let totalPlayers = 0
    this.state.players.forEach((player) => {
      totalPlayers++
      if (player.ready) readyCount++
    })

    client.send("battle_ready_update", {
      readyCount,
      totalPlayers,
      allReady: readyCount === totalPlayers,
      timestamp: Date.now(),
    })

    console.log(`📊 BattleRoom now has ${this.clients.length} players`)
  }

  onLeave(client: Client, consented: boolean) {
    console.log(`Player ${client.sessionId} left the battle room`)

    // Remove player from the game state
    if (this.state.players.has(client.sessionId)) {
      this.state.players.delete(client.sessionId)

      // Update lobby with new player count
      this.updateLobbyMetadata()

      // Broadcast player left
      this.broadcast("player_left", { id: client.sessionId })

      // Update ready count after player leaves
      let readyCount = 0
      let totalPlayers = 0
      this.state.players.forEach((player: Player) => {
        totalPlayers++
        if (player.ready) readyCount++
      })

      this.broadcast("battle_ready_update", {
        readyCount,
        totalPlayers,
        allReady: readyCount === totalPlayers && totalPlayers > 0,
        timestamp: Date.now(),
      })

      // Check if game should end (e.g., only one player left)
      this.checkGameEnd()
    }

    console.log(`📊 BattleRoom now has ${this.clients.length} players`)
  }

  private async updateLobbyMetadata() {
    try {
      await this.setMetadata({
        ...this.metadata,
        currentPlayers: this.clients.length,
        maxPlayers: this.maxClients,
        gameStarted: this.state.gameStarted,
        gameEnded: this.state.gameEnded,
      })

      // Notify lobby of the update
      updateLobby(this)
    } catch (error) {
      console.error("Failed to update lobby metadata:", error)
    }
  }

  onDispose() {
    console.log("Battle room disposed")
  }

  private update(deltaTime: number) {
    // Convert to seconds for physics calculations
    const dt = deltaTime / 1000

    // Skip updates if game hasn't started
    if (!this.state.gameStarted) return

    // Update player positions
    this.state.players.forEach((player: Player) => {
      // Skip dead players
      if (player.health <= 0) {
        if (!player.isRespawning) {
          player.isRespawning = true

          // Schedule respawn
          this.clock.setTimeout(() => {
            this.respawnPlayer(player)
          }, player.respawnTime * 1000)
        }
        return
      }

      // Apply gravity if not grounded
      if (!player.isGrounded) {
        player.velocity.y -= this.gravity * dt
      }

      // Calculate movement based on direction and speed
      const moveSpeed = player.speed

      // Apply movement in the direction the player is facing
      const forward = player.getForwardVector()

      // Calculate velocity from input direction and forward vector
      if (player.moveDirection.x !== 0 || player.moveDirection.z !== 0) {
        // This is a simplified movement calculation
        // In a real implementation, you would use the rotation quaternion
        // to transform the input direction
        player.velocity.x = player.moveDirection.x * moveSpeed
        player.velocity.z = player.moveDirection.z * moveSpeed
      } else {
        // Decelerate when no input
        player.velocity.x *= 0.9
        player.velocity.z *= 0.9

        // Stop completely below threshold
        if (Math.abs(player.velocity.x) < 0.1) player.velocity.x = 0
        if (Math.abs(player.velocity.z) < 0.1) player.velocity.z = 0
      }

      // Update position based on velocity
      player.position.x += player.velocity.x * dt
      player.position.y += player.velocity.y * dt
      player.position.z += player.velocity.z * dt

      // Check map boundaries
      if (player.position.x < 0) {
        player.position.x = 0
        player.velocity.x = 0
      } else if (player.position.x > this.mapWidth) {
        player.position.x = this.mapWidth
        player.velocity.x = 0
      }

      if (player.position.z < 0) {
        player.position.z = 0
        player.velocity.z = 0
      } else if (player.position.z > this.mapLength) {
        player.position.z = this.mapLength
        player.velocity.z = 0
      }

      // Check floor collision
      if (player.position.y < player.radius) {
        player.position.y = player.radius
        player.velocity.y = 0
        player.isGrounded = true
      } else {
        // Check if still on ground
        player.isGrounded = this.collisionManager.checkPlayerGround(player, 0)
      }

      // Check ceiling collision
      if (player.position.y > this.mapHeight - player.radius) {
        player.position.y = this.mapHeight - player.radius
        player.velocity.y = 0
      }

      // Check collisions with map objects
      this.state.mapObjects.forEach((mapObject: MapObject) => {
        if (this.collisionManager.checkPlayerMapObjectCollision(player, mapObject)) {
          this.collisionManager.resolveCollision(player, mapObject)
        }
      })

      // Update cooldowns
      player.updateCooldowns()

      // Check if player fell out of the map
      if (player.position.y > this.mapHeight + 10) {
        // Player fell out of the map, respawn
        player.health = 0
        this.handlePlayerDeath(player, "")
      }
    })

    // Update projectiles
    this.state.projectiles.forEach((projectile: Projectile) => {
      // Apply gravity if projectile is affected by it
      if (projectile.gravity > 0) {
        projectile.velocity.y -= projectile.gravity * dt
      }

      // Update position based on velocity
      projectile.position.x += projectile.velocity.x * dt
      projectile.position.y += projectile.velocity.y * dt
      projectile.position.z += projectile.velocity.z * dt

      // Check if projectile is out of bounds
      if (
        !this.collisionManager.isWithinMapBoundaries(projectile.position, this.mapWidth, this.mapLength, this.mapHeight)
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

      // Check collisions with map objects
      for (const mapObject of this.state.mapObjects) {
        // Simple collision check - in a real implementation you would use
        // more sophisticated collision detection based on the shape of the map object
        const dx = projectile.position.x - mapObject.position.x
        const dy = projectile.position.y - mapObject.position.y
        const dz = projectile.position.z - mapObject.position.z

        // Simple sphere vs box collision
        if (
          Math.abs(dx) < mapObject.scale.x / 2 + projectile.radius &&
          Math.abs(dy) < mapObject.scale.y / 2 + projectile.radius &&
          Math.abs(dz) < mapObject.scale.z / 2 + projectile.radius
        ) {
          // Projectile hit map object
          this.state.projectiles.delete(projectile.id)

          // Broadcast projectile impact
          this.broadcast("projectile_impact", {
            projectileId: projectile.id,
            position: {
              x: projectile.position.x,
              y: projectile.position.y,
              z: projectile.position.z,
            },
            normal: {
              x: dx > 0 ? 1 : -1,
              y: dy > 0 ? 1 : -1,
              z: dz > 0 ? 1 : -1,
            },
            objectId: mapObject.id,
          })

          return
        }
      }

      // Check collisions with players
      this.state.players.forEach((player: Player) => {
        // Skip if it's the player who shot the projectile or if player is dead
        if (player.id === projectile.ownerId || player.health <= 0 || player.isRespawning) return

        // Check collision
        if (this.collisionManager.checkProjectilePlayerCollision(projectile, player)) {
          // Apply damage to player
          player.health -= projectile.damage

          // Broadcast projectile hit
          this.broadcast("projectile_hit", {
            projectileId: projectile.id,
            playerId: player.id,
            damage: projectile.damage,
            position: {
              x: projectile.position.x,
              y: projectile.position.y,
              z: projectile.position.z,
            },
          })

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

  private createProjectile(player: Player, direction: Vector3D, type: string): Projectile {
    const projectile = new Projectile()
    projectile.id = `${player.id}_${Date.now()}`
    projectile.ownerId = player.id
    projectile.type = type || "default"

    // Set initial position (at player position, adjusted for height)
    projectile.position.x = player.position.x
    projectile.position.y = player.position.y + 1.5 // Adjust for player height
    projectile.position.z = player.position.z

    // Normalize direction
    const length = direction.length()
    if (length > 0) {
      direction.x /= length
      direction.y /= length
      direction.z /= length
    } else {
      // Default to forward if no direction provided
      const forward = player.getForwardVector()
      direction.x = forward.x
      direction.y = 0
      direction.z = forward.z
    }

    // Set properties based on projectile type
    switch (projectile.type) {
      case "fireball":
        projectile.damage = 20
        projectile.radius = 0.8
        projectile.lifetime = 2
        projectile.speed = 20
        projectile.gravity = 0
        projectile.effectType = "fire"
        break
      case "arrow":
        projectile.damage = 15
        projectile.radius = 0.3
        projectile.lifetime = 1.5
        projectile.speed = 30
        projectile.gravity = 5 // Arrows are affected by gravity
        projectile.effectType = "pierce"
        break
      case "laser":
        projectile.damage = 10
        projectile.radius = 0.2
        projectile.lifetime = 1
        projectile.speed = 50
        projectile.gravity = 0
        projectile.effectType = "energy"
        break
      default:
        projectile.damage = 10
        projectile.radius = 0.5
        projectile.lifetime = 2
        projectile.speed = 25
        projectile.gravity = 0
        projectile.effectType = "default"
    }

    // Set velocity based on direction and speed
    projectile.velocity.x = direction.x * projectile.speed
    projectile.velocity.y = direction.y * projectile.speed
    projectile.velocity.z = direction.z * projectile.speed

    return projectile
  }

  private handlePlayerDeath(player: Player, killerId: string) {
    // Broadcast player death
    this.broadcast("player_died", {
      playerId: player.id,
      killerId: killerId,
      position: {
        x: player.position.x,
        y: player.position.y,
        z: player.position.z,
      },
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

  private respawnPlayer(player: Player) {
    // Reset player state
    player.health = player.maxHealth
    player.isRespawning = false

    // Get spawn point
    const spawnPoint = this.getRandomSpawnPoint()
    player.position.x = spawnPoint.x
    player.position.y = spawnPoint.y
    player.position.z = spawnPoint.z

    // Reset velocity
    player.velocity.x = 0
    player.velocity.y = 0
    player.velocity.z = 0

    // Reset animation state
    player.animationState = "idle"

    // Broadcast player respawned
    this.broadcast("player_respawned", {
      playerId: player.id,
      position: {
        x: player.position.x,
        y: player.position.y,
        z: player.position.z,
      },
    })
  }

  private getRandomSpawnPoint(): Vector3D {
    // In a real implementation, you would have predefined spawn points
    // For now, we'll just return a random position within the map
    return new Vector3D(
      Math.random() * this.mapWidth,
      5, // Start a bit above the ground
      Math.random() * this.mapLength,
    )
  }

  private loadMapObjects(mapId: string) {
    // In a real implementation, you would load map data from a database or file
    // For this example, we'll create a simple map with some objects

    // Add ground
    const ground = new MapObject()
    ground.id = "ground"
    ground.type = "ground"
    ground.position.x = this.mapWidth / 2
    ground.position.y = 0
    ground.position.z = this.mapLength / 2
    ground.scale.x = this.mapWidth
    ground.scale.y = 1
    ground.scale.z = this.mapLength
    this.state.mapObjects.push(ground)

    // Add some platforms
    for (let i = 0; i < 10; i++) {
      const platform = new MapObject()
      platform.id = `platform_${i}`
      platform.type = "platform"
      platform.position.x = Math.random() * this.mapWidth
      platform.position.y = Math.random() * (this.mapHeight / 2) + 5
      platform.position.z = Math.random() * this.mapLength
      platform.scale.x = Math.random() * 10 + 5
      platform.scale.y = 1
      platform.scale.z = Math.random() * 10 + 5
      this.state.mapObjects.push(platform)
    }

    // Add some walls
    for (let i = 0; i < 5; i++) {
      const wall = new MapObject()
      wall.id = `wall_${i}`
      wall.type = "wall"
      wall.position.x = Math.random() * this.mapWidth
      wall.position.y = 5
      wall.position.z = Math.random() * this.mapLength
      wall.scale.x = 1
      wall.scale.y = 10
      wall.scale.z = Math.random() * 20 + 10
      wall.rotation = Math.random() * Math.PI * 2
      this.state.mapObjects.push(wall)
    }
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
    this.state.players.forEach((player: Player) => {
      const spawnPoint = this.getRandomSpawnPoint()
      player.position.x = spawnPoint.x
      player.position.y = spawnPoint.y
      player.position.z = spawnPoint.z
      player.health = player.maxHealth
      player.kills = 0
      player.animationState = "idle"
    })

    // Update lobby metadata
    this.updateLobbyMetadata()

    // Broadcast game start
    this.broadcast("game_started", {
      mapWidth: this.mapWidth,
      mapLength: this.mapLength,
      mapHeight: this.mapHeight,
      maxGameTime: this.state.maxGameTime,
      gameMode: this.state.gameMode,
      timeOfDay: this.state.timeOfDay,
      weather: this.state.weather,
    })
  }

  private checkGameEnd() {
    // Don't check if game hasn't started or already ended
    if (!this.state.gameStarted || this.state.gameEnded) return

    // Count alive players
    let alivePlayers = 0
    let lastAlivePlayerId = ""

    this.state.players.forEach((player: Player) => {
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

      this.state.players.forEach((player: Player) => {
        if (player.kills > maxKills) {
          maxKills = player.kills
          winnerId = player.id
        }
      })
    }

    // Update lobby metadata
    this.updateLobbyMetadata()

    // Broadcast game end
    const playerStats: Array<{ id: string; name: string; kills: number; characterType: string }> = []

    this.state.players.forEach((player: Player, id: string) => {
      playerStats.push({
        id: id,
        name: player.name,
        kills: player.kills,
        characterType: player.characterType,
      })
    })

    this.broadcast("game_ended", {
      reason: reason,
      winnerId: winnerId,
      gameTime: this.state.gameTime,
      playerStats: playerStats,
    })

    // Schedule room disposal
    this.clock.setTimeout(() => {
      this.disconnect()
    }, 10000) // Give clients 10 seconds to receive final state
  }
}
