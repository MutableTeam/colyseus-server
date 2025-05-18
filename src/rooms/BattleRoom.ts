import { Room, type Client } from "colyseus"
import { BattleState } from "../schemas/BattleState"
import { Player } from "../schemas/Player"
import { Projectile } from "../schemas/Projectile"
import { AbilityManager } from "../managers/AbilityManager"
import { CollisionManager } from "../managers/CollisionManager"

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

    // Handle player movement
    this.onMessage("move", (client, message) => {
      const player = this.state.players.get(client.sessionId)
      if (!player) return

      // Update player's movement direction and speed
      player.moveDirection.x = message.x || 0
      player.moveDirection.y = message.y || 0
      player.speed = message.speed || player.speed
    })

    // Handle player shooting
    this.onMessage("shoot", (client, message) => {
      const player = this.state.players.get(client.sessionId)
      if (!player) return

      // Check if player can shoot (cooldown)
      if (player.canShoot()) {
        const projectile = this.createProjectile(player, message.angle, message.type)
        this.state.projectiles.set(projectile.id, projectile)
        player.lastShotTime = Date.now()
      }
    })

    // Handle player using abilities
    this.onMessage("use_ability", (client, message) => {
      const player = this.state.players.get(client.sessionId)
      if (!player) return

      // Always execute ability usage and cooldown setting
      // The canUseAbility check should be done within the abilityManager.useAbility function
      this.abilityManager.useAbility(this, player, message.abilityId, message.targetPosition)
      player.setAbilityCooldown(message.abilityId)
    })

    // Handle player changing character
    this.onMessage("change_character", (client, message) => {
      const player = this.state.players.get(client.sessionId)
      if (!player || this.state.gameStarted) return // Can't change after game starts

      player.characterType = message.characterType
      player.abilities = this.abilityManager.getAbilitiesForCharacter(message.characterType)

      // Broadcast character change to all clients
      this.broadcast("character_changed", {
        playerId: client.sessionId,
        characterType: message.characterType,
      })
    })

    // Handle ready state
    this.onMessage("ready", (client, message) => {
      const player = this.state.players.get(client.sessionId)
      if (!player) return

      player.ready = message.ready

      // Check if all players are ready to start the game
      this.checkGameStart()
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

    // Set abilities based on character type
    player.abilities = this.abilityManager.getAbilitiesForCharacter(player.characterType)

    // Add player to the game state
    this.state.players.set(client.sessionId, player)

    // Broadcast new player joined
    this.broadcast("player_joined", {
      id: player.id,
      name: player.name,
      characterType: player.characterType,
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

  private createProjectile(player: Player, angle: number, type: string): Projectile {
    const projectile = new Projectile()
    projectile.id = `${player.id}_${Date.now()}`
    projectile.ownerId = player.id
    projectile.type = type || "default"

    // Set initial position (at player position)
    projectile.position.x = player.position.x
    projectile.position.y = player.position.y

    // Set velocity based on angle
    const speed = 500 // pixels per second
    projectile.velocity.x = Math.cos(angle) * speed
    projectile.velocity.y = Math.sin(angle) * speed

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
      { x: 100, y: 100 },
      { x: this.mapWidth - 100, y: 100 },
      { x: 100, y: this.mapHeight - 100 },
      { x: this.mapWidth - 100, y: this.mapHeight - 100 },
      { x: this.mapWidth / 2, y: 100 },
      { x: this.mapWidth / 2, y: this.mapHeight - 100 },
      { x: 100, y: this.mapHeight / 2 },
      { x: this.mapWidth - 100, y: this.mapHeight / 2 },
    ]

    this.state.players.forEach((player) => {
      const spawn = spawnPoints[spawnIndex % spawnPoints.length]
      player.position.x = spawn.x
      player.position.y = spawn.y
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
}
