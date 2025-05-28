import { Room, type Client } from "@colyseus/core"
import { PlatformerState } from "../schemas/PlatformerState"
import { PlatformerPlayer } from "../schemas/PlatformerPlayer"
import { Platform } from "../schemas/Platform"
import { Collectible } from "../schemas/Collectible"
import { Enemy } from "../schemas/Enemy"

export class PlatformerRoom extends Room<PlatformerState> {
  maxClients = 4

  // Game settings
  private levelWidth = 3000
  private levelHeight = 1000
  private gravity = 980 // pixels per second squared
  private tickRate = 60 // 60 updates per second

  onCreate(options: any) {
    console.log("PlatformerRoom created!", options)

    // Set level dimensions from options or use defaults
    this.levelWidth = options.levelWidth || this.levelWidth
    this.levelHeight = options.levelHeight || this.levelHeight
    this.gravity = options.gravity || this.gravity

    // Initialize the room state
    this.setState(new PlatformerState(this.levelWidth, this.levelHeight))

    // Load level data (platforms, collectibles, enemies)
    this.loadLevel(options.levelId || "level1")

    // Set up physics simulation
    this.setSimulationInterval((deltaTime: number) => this.update(deltaTime), 1000 / this.tickRate)

    // Handle player movement
    this.onMessage("move", (client: Client, message: any) => {
      const player = this.state.players.get(client.sessionId)
      if (!player) return

      // Update player's movement direction
      player.moveDirection = message.direction || 0
    })

    // Handle player jumping
    this.onMessage("jump", (client: Client) => {
      const player = this.state.players.get(client.sessionId)
      if (!player || !player.canJump) return

      player.velocity.y = -player.jumpForce
      player.canJump = false
    })

    // Handle player attacking
    this.onMessage("attack", (client: Client) => {
      const player = this.state.players.get(client.sessionId)
      if (!player || player.attackCooldown > 0) return

      player.attacking = true
      player.attackCooldown = player.attackCooldownTime

      // Broadcast attack
      this.broadcast("player_attack", {
        playerId: player.id,
        position: { x: player.position.x, y: player.position.y },
      })

      // Check for enemy hits
      this.checkAttackHits(player)
    })

    // Handle player using special ability
    this.onMessage("use_ability", (client: Client, message: any) => {
      const player = this.state.players.get(client.sessionId)
      if (!player || player.abilityCooldown > 0) return

      player.usingAbility = true
      player.abilityCooldown = player.abilityCooldownTime

      // Apply ability effect based on character type
      this.applyAbilityEffect(player, message.targetPosition)
    })

    // Handle ready state
    this.onMessage("ready", (client: Client, message: any) => {
      const player = this.state.players.get(client.sessionId)
      if (!player) return

      player.ready = message.ready

      // Check if all players are ready to start the game
      this.checkGameStart()
    })
  }

  onJoin(client: Client, options: any) {
    console.log(`Player ${client.sessionId} joined the platformer room`)

    // Create a new player
    const player = new PlatformerPlayer()
    player.id = client.sessionId
    player.name = options.username || `Player_${client.sessionId.substr(0, 6)}`
    player.characterType = options.characterType || "default"

    // Set initial position at spawn point
    const spawnPoint = this.getSpawnPoint(this.state.players.size)
    player.position.x = spawnPoint.x
    player.position.y = spawnPoint.y

    // Set abilities and stats based on character type
    this.setPlayerCharacteristics(player)

    // Add player to the game state
    this.state.players.set(client.sessionId, player)

    // Broadcast new player joined
    this.broadcast("player_joined", {
      id: player.id,
      name: player.name,
      characterType: player.characterType,
      position: { x: player.position.x, y: player.position.y },
    })

    // Send current level data to the new player
    client.send("level_data", {
      width: this.levelWidth,
      height: this.levelHeight,
      platforms: this.state.platforms.map((p: Platform) => ({
        id: p.id,
        x: p.position.x,
        y: p.position.y,
        width: p.width,
        height: p.height,
        type: p.type,
      })),
      collectibles: this.state.collectibles.map((c: Collectible) => ({
        id: c.id,
        x: c.position.x,
        y: c.position.y,
        type: c.type,
        value: c.value,
      })),
      enemies: this.state.enemies.map((e: Enemy) => ({
        id: e.id,
        x: e.position.x,
        y: e.position.y,
        type: e.type,
        health: e.health,
      })),
    })
  }

  onLeave(client: Client, consented: boolean) {
    console.log(`Player ${client.sessionId} left the platformer room`)

    // Remove player from the game state
    if (this.state.players.has(client.sessionId)) {
      this.state.players.delete(client.sessionId)

      // Broadcast player left
      this.broadcast("player_left", { id: client.sessionId })

      // Check if game should end (e.g., no players left)
      if (this.state.players.size === 0) {
        this.disconnect()
      }
    }
  }

  onDispose() {
    console.log("Platformer room disposed")
  }

  private loadLevel(levelId: string) {
    // In a real implementation, this would load level data from a database or file
    // For this example, we'll create a simple level with some platforms

    // Add ground platform
    const ground = new Platform()
    ground.id = "ground"
    ground.position.x = this.levelWidth / 2
    ground.position.y = this.levelHeight - 20
    ground.width = this.levelWidth
    ground.height = 40
    ground.type = "ground"
    this.state.platforms.push(ground)

    // Add some floating platforms
    for (let i = 0; i < 10; i++) {
      const platform = new Platform()
      platform.id = `platform_${i}`
      platform.position.x = Math.random() * this.levelWidth
      platform.position.y = Math.random() * (this.levelHeight - 200) + 100
      platform.width = Math.random() * 200 + 100
      platform.height = 20
      platform.type = "normal"
      this.state.platforms.push(platform)
    }

    // Add some collectibles
    for (let i = 0; i < 20; i++) {
      const collectible = new Collectible()
      collectible.id = `collectible_${i}`
      collectible.position.x = Math.random() * this.levelWidth
      collectible.position.y = Math.random() * (this.levelHeight - 100)
      collectible.type = Math.random() > 0.7 ? "gem" : "coin"
      collectible.value = collectible.type === "gem" ? 10 : 1
      this.state.collectibles.push(collectible)
    }

    // Add some enemies
    for (let i = 0; i < 5; i++) {
      const enemy = new Enemy()
      enemy.id = `enemy_${i}`
      enemy.position.x = Math.random() * this.levelWidth
      enemy.position.y = Math.random() * (this.levelHeight - 100)
      enemy.type = Math.random() > 0.5 ? "flying" : "walking"
      enemy.health = enemy.type === "flying" ? 2 : 3
      this.state.enemies.push(enemy)
    }
  }

  private getSpawnPoint(playerIndex: number) {
    // Return different spawn points based on player index
    const spawnPoints = [
      { x: 100, y: 100 },
      { x: 200, y: 100 },
      { x: 300, y: 100 },
      { x: 400, y: 100 },
    ]

    return spawnPoints[playerIndex % spawnPoints.length]
  }

  private setPlayerCharacteristics(player: PlatformerPlayer) {
    // Set player stats based on character type
    switch (player.characterType) {
      case "knight":
        player.jumpForce = 500
        player.speed = 200
        player.attackRange = 50
        player.attackDamage = 2
        break
      case "mage":
        player.jumpForce = 450
        player.speed = 180
        player.attackRange = 200
        player.attackDamage = 1
        break
      case "rogue":
        player.jumpForce = 550
        player.speed = 250
        player.attackRange = 30
        player.attackDamage = 1
        break
      default:
        player.jumpForce = 500
        player.speed = 200
        player.attackRange = 50
        player.attackDamage = 1
    }
  }

  private update(deltaTime: number) {
    // Convert to seconds for physics calculations
    const dt = deltaTime / 1000

    // Skip updates if game hasn't started
    if (!this.state.gameStarted) return

    // Update players
    this.state.players.forEach((player: PlatformerPlayer) => {
      // Apply gravity
      player.velocity.y += this.gravity * dt

      // Apply horizontal movement
      player.velocity.x = player.moveDirection * player.speed

      // Update position
      player.position.x += player.velocity.x * dt
      player.position.y += player.velocity.y * dt

      // Keep player within level boundaries
      player.position.x = Math.max(0, Math.min(this.levelWidth, player.position.x))

      // Check platform collisions
      let onGround = false
      this.state.platforms.forEach((platform: Platform) => {
        if (this.checkPlatformCollision(player, platform)) {
          onGround = true
        }
      })

      // Update jump state
      player.canJump = onGround

      // Check collectible collisions
      this.checkCollectibleCollisions(player)

      // Check enemy collisions
      this.checkEnemyCollisions(player)

      // Update cooldowns
      if (player.attackCooldown > 0) {
        player.attackCooldown -= dt
        if (player.attackCooldown <= 0) {
          player.attackCooldown = 0
          player.attacking = false
        }
      }

      if (player.abilityCooldown > 0) {
        player.abilityCooldown -= dt
        if (player.abilityCooldown <= 0) {
          player.abilityCooldown = 0
          player.usingAbility = false
        }
      }

      // Check if player fell out of the level
      if (player.position.y > this.levelHeight) {
        this.respawnPlayer(player)
      }
    })

    // Update enemies
    this.state.enemies.forEach((enemy: Enemy) => {
      // Simple AI movement
      if (enemy.type === "walking") {
        enemy.position.x += enemy.direction * enemy.speed * dt

        // Change direction if hitting level boundary
        if (enemy.position.x <= 0 || enemy.position.x >= this.levelWidth) {
          enemy.direction *= -1
        }

        // Check platform edges
        let onPlatform = false
        this.state.platforms.forEach((platform: Platform) => {
          if (
            enemy.position.x >= platform.position.x - platform.width / 2 &&
            enemy.position.x <= platform.position.x + platform.width / 2 &&
            enemy.position.y + enemy.height / 2 >= platform.position.y - platform.height / 2 &&
            enemy.position.y + enemy.height / 2 <= platform.position.y + platform.height / 2
          ) {
            onPlatform = true
          }
        })

        if (!onPlatform) {
          enemy.direction *= -1
        }
      } else if (enemy.type === "flying") {
        // Flying enemies move in a sine wave pattern
        enemy.time += dt
        enemy.position.x += enemy.direction * enemy.speed * dt
        enemy.position.y = enemy.startY + Math.sin(enemy.time) * 50

        // Change direction if hitting level boundary
        if (enemy.position.x <= 0 || enemy.position.x >= this.levelWidth) {
          enemy.direction *= -1
        }
      }
    })

    // Update game time
    this.state.gameTime += dt
  }

  private checkPlatformCollision(player: PlatformerPlayer, platform: Platform): boolean {
    // Check if player is colliding with platform
    const playerBottom = player.position.y + player.height / 2
    const playerTop = player.position.y - player.height / 2
    const playerLeft = player.position.x - player.width / 2
    const playerRight = player.position.x + player.width / 2

    const platformTop = platform.position.y - platform.height / 2
    const platformBottom = platform.position.y + platform.height / 2
    const platformLeft = platform.position.x - platform.width / 2
    const platformRight = platform.position.x + platform.width / 2

    // Check if player is colliding with platform
    if (
      playerRight >= platformLeft &&
      playerLeft <= platformRight &&
      playerBottom >= platformTop &&
      playerTop <= platformBottom
    ) {
      // Determine collision side
      const bottomCollision = playerBottom - platformTop
      const topCollision = platformBottom - playerTop
      const leftCollision = playerRight - platformLeft
      const rightCollision = platformRight - playerLeft

      // Find smallest collision
      const minCollision = Math.min(bottomCollision, topCollision, leftCollision, rightCollision)

      if (minCollision === bottomCollision && player.velocity.y > 0) {
        // Landing on top of platform
        player.position.y = platformTop - player.height / 2
        player.velocity.y = 0
        return true
      } else if (minCollision === topCollision && player.velocity.y < 0) {
        // Hitting bottom of platform
        player.position.y = platformBottom + player.height / 2
        player.velocity.y = 0
      } else if (minCollision === leftCollision) {
        // Hitting left side of platform
        player.position.x = platformLeft - player.width / 2
      } else if (minCollision === rightCollision) {
        // Hitting right side of platform
        player.position.x = platformRight + player.width / 2
      }
    }

    return false
  }

  private checkCollectibleCollisions(player: PlatformerPlayer) {
    const playerRadius = player.width / 2

    for (let i = this.state.collectibles.length - 1; i >= 0; i--) {
      const collectible = this.state.collectibles[i]

      // Simple circle collision
      const dx = player.position.x - collectible.position.x
      const dy = player.position.y - collectible.position.y
      const distance = Math.sqrt(dx * dx + dy * dy)

      if (distance < playerRadius + collectible.radius) {
        // Collect the item
        player.score += collectible.value

        // Broadcast collectible collected
        this.broadcast("collectible_collected", {
          playerId: player.id,
          collectibleId: collectible.id,
          value: collectible.value,
          newScore: player.score,
        })

        // Remove collectible from the game
        this.state.collectibles.splice(i, 1)
      }
    }
  }

  private checkEnemyCollisions(player: PlatformerPlayer) {
    // Skip if player is invulnerable
    if (player.invulnerable) return

    const playerRadius = player.width / 2

    for (let i = 0; i < this.state.enemies.length; i++) {
      const enemy = this.state.enemies[i]

      // Simple circle collision
      const dx = player.position.x - enemy.position.x
      const dy = player.position.y - enemy.position.y
      const distance = Math.sqrt(dx * dx + dy * dy)

      if (distance < playerRadius + enemy.radius) {
        // Player takes damage
        player.health -= 1
        player.invulnerable = true

        // Set invulnerability timer
        this.clock.setTimeout(() => {
          player.invulnerable = false
        }, 1000)

        // Broadcast player damaged
        this.broadcast("player_damaged", {
          playerId: player.id,
          health: player.health,
        })

        // Check if player died
        if (player.health <= 0) {
          this.respawnPlayer(player)
        } else {
          // Knockback
          const knockbackDirection = dx > 0 ? 1 : -1
          player.velocity.x = knockbackDirection * 300
          player.velocity.y = -300
        }
      }
    }
  }

  private checkAttackHits(player: PlatformerPlayer) {
    for (let i = this.state.enemies.length - 1; i >= 0; i--) {
      const enemy = this.state.enemies[i]

      // Check if enemy is within attack range
      const dx = enemy.position.x - player.position.x
      const dy = enemy.position.y - player.position.y
      const distance = Math.sqrt(dx * dx + dy * dy)

      if (distance < player.attackRange) {
        // Enemy takes damage
        enemy.health -= player.attackDamage

        // Broadcast enemy damaged
        this.broadcast("enemy_damaged", {
          enemyId: enemy.id,
          health: enemy.health,
        })

        // Check if enemy died
        if (enemy.health <= 0) {
          // Award points
          player.score += 5

          // Broadcast enemy defeated
          this.broadcast("enemy_defeated", {
            enemyId: enemy.id,
            playerId: player.id,
            newScore: player.score,
          })

          // Remove enemy from the game
          this.state.enemies.splice(i, 1)
        }
      }
    }
  }

  private applyAbilityEffect(player: PlatformerPlayer, targetPosition: any) {
    switch (player.characterType) {
      case "knight":
        // Shield bash - pushes enemies away
        this.state.enemies.forEach((enemy: Enemy) => {
          const dx = enemy.position.x - player.position.x
          const dy = enemy.position.y - player.position.y
          const distance = Math.sqrt(dx * dx + dy * dy)

          if (distance < 100) {
            // Push enemy away
            const pushDirection = dx > 0 ? 1 : -1
            enemy.position.x += pushDirection * 100

            // Stun enemy
            enemy.stunned = true
            this.clock.setTimeout(() => {
              enemy.stunned = false
            }, 2000)
          }
        })
        break

      case "mage":
        // Fireball - damages enemies in an area
        if (targetPosition) {
          this.state.enemies.forEach((enemy: Enemy) => {
            const dx = enemy.position.x - targetPosition.x
            const dy = enemy.position.y - targetPosition.y
            const distance = Math.sqrt(dx * dx + dy * dy)

            if (distance < 100) {
              // Enemy takes damage
              enemy.health -= 2

              // Broadcast enemy damaged
              this.broadcast("enemy_damaged", {
                enemyId: enemy.id,
                health: enemy.health,
              })

              // Check if enemy died
              if (enemy.health <= 0) {
                // Award points
                player.score += 5

                // Remove enemy from the game (handled in next update)
              }
            }
          })

          // Broadcast ability effect
          this.broadcast("ability_used", {
            playerId: player.id,
            type: "fireball",
            position: targetPosition,
          })
        }
        break

      case "rogue":
        // Dash - quick movement
        const dashDistance = 200
        const dashDirection = player.moveDirection !== 0 ? player.moveDirection : player.facingRight ? 1 : -1

        player.position.x += dashDirection * dashDistance

        // Keep player within level boundaries
        player.position.x = Math.max(0, Math.min(this.levelWidth, player.position.x))

        // Broadcast ability effect
        this.broadcast("ability_used", {
          playerId: player.id,
          type: "dash",
          direction: dashDirection,
        })
        break

      default:
        // Default ability - jump boost
        player.velocity.y = -player.jumpForce * 1.5
        player.canJump = false

        // Broadcast ability effect
        this.broadcast("ability_used", {
          playerId: player.id,
          type: "jump_boost",
        })
    }
  }

  private respawnPlayer(player: PlatformerPlayer) {
    // Decrement lives
    player.lives--

    // Broadcast player died
    this.broadcast("player_died", {
      playerId: player.id,
      livesRemaining: player.lives,
    })

    if (player.lives <= 0) {
      // Game over for this player
      player.gameOver = true

      // Broadcast game over for player
      this.broadcast("player_game_over", {
        playerId: player.id,
        score: player.score,
      })

      // Check if all players are game over
      let allGameOver = true
      this.state.players.forEach((p: PlatformerPlayer) => {
        if (!p.gameOver) {
          allGameOver = false
        }
      })

      if (allGameOver) {
        this.endGame()
      }
    } else {
      // Respawn player
      const spawnPoint = this.getSpawnPoint(0) // Use first spawn point
      player.position.x = spawnPoint.x
      player.position.y = spawnPoint.y
      player.velocity.x = 0
      player.velocity.y = 0
      player.health = player.maxHealth
      player.invulnerable = true

      // Set invulnerability timer
      this.clock.setTimeout(() => {
        player.invulnerable = false
      }, 2000)

      // Broadcast player respawned
      this.broadcast("player_respawned", {
        playerId: player.id,
        position: { x: player.position.x, y: player.position.y },
        health: player.health,
        livesRemaining: player.lives,
      })
    }
  }

  private checkGameStart() {
    // Don't start if already started
    if (this.state.gameStarted) return

    // Check if all players are ready
    let allReady = true

    this.state.players.forEach((player: PlatformerPlayer) => {
      if (!player.ready) {
        allReady = false
      }
    })

    // Start game if all players are ready
    if (allReady && this.state.players.size > 0) {
      this.startGame()
    }
  }

  private startGame() {
    this.state.gameStarted = true
    this.state.gameStartTime = Date.now()

    // Broadcast game start
    this.broadcast("game_started", {
      startTime: this.state.gameStartTime,
    })
  }

  private endGame() {
    this.state.gameEnded = true
    this.state.gameEndTime = Date.now()

    // Calculate final scores and rankings
    const playerResults = Array.from(this.state.players.entries())
      .map(([id, player]: [string, PlatformerPlayer]) => ({
        id: id,
        name: player.name,
        score: player.score,
        lives: player.lives,
      }))
      .sort((a, b) => b.score - a.score)

    // Broadcast game end
    this.broadcast("game_ended", {
      gameTime: this.state.gameTime,
      playerResults: playerResults,
    })

    // Schedule room disposal
    this.clock.setTimeout(() => {
      this.disconnect()
    }, 10000) // Give clients 10 seconds to receive final state
  }
}
