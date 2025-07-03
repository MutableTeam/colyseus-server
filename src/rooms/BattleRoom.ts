import { Room, type Client } from "colyseus"
import { BattleState } from "../schemas/BattleState"
import { Player } from "../schemas/Player"

export class BattleRoom extends Room<BattleState> {
  maxClients = 16
  private gameStarted = false
  private gameMode = "deathmatch"
  private mapTheme = "default"

  onCreate(options: any) {
    this.setState(new BattleState())

    console.log("BattleRoom created with options:", options)

    // Configure room based on options
    this.gameMode = options.gameMode || "deathmatch"
    this.mapTheme = options.mapTheme || "default"
    this.maxClients = options.maxPlayers || 16

    // Set room metadata
    this.setMetadata({
      name: options.roomName || "Battle Arena",
      description: `${this.gameMode} battle on ${this.mapTheme} map`,
      gameType: "battle",
      gameMode: this.gameMode,
      mapTheme: this.mapTheme,
      maxPlayers: this.maxClients,
    })

    // Initialize battle state
    this.state.gameMode = this.gameMode
    this.state.mapTheme = this.mapTheme
    this.state.gameStarted = false
    this.state.gameTime = 0

    // Game loop for Three.js synchronization
    this.clock.setInterval(() => {
      if (this.gameStarted) {
        this.state.gameTime += 1 / 60 // 60 FPS
        this.updateGameLogic()
      }
    }, 1000 / 60) // 60 FPS

    // Send periodic battle room updates
    this.clock.setInterval(() => {
      this.broadcast("battle_room_stats_update", {
        totalPlayers: this.clients.length,
        gameStarted: this.gameStarted,
        gameTime: this.state.gameTime,
        gameMode: this.gameMode,
      })
    }, 2000)
  }

  onJoin(client: Client, options: any) {
    console.log(`${client.sessionId} joined BattleRoom with options:`, options)

    // Create player entity
    const player = new Player()
    player.sessionId = client.sessionId
    player.username = options.username || `Player_${client.sessionId.substring(0, 6)}`
    player.position.x = Math.random() * 20 - 10 // Random spawn position
    player.position.y = 0
    player.position.z = Math.random() * 20 - 10
    player.health = 100
    player.isAlive = true
    player.score = 0
    player.kills = 0
    player.deaths = 0

    // Add to state
    this.state.players.set(client.sessionId, player)

    // Welcome message
    client.send("battle_room_joined", {
      message: "Welcome to the Battle Arena!",
      playerCount: this.clients.length,
      gameMode: this.gameMode,
      mapTheme: this.mapTheme,
      sessionId: client.sessionId,
      spawnPosition: {
        x: player.position.x,
        y: player.position.y,
        z: player.position.z,
      },
    })

    // Start game if enough players
    if (this.clients.length >= 2 && !this.gameStarted) {
      this.startGame()
    }

    // Broadcast player count update
    this.broadcast(
      "player_count_update",
      {
        count: this.clients.length,
        action: "joined",
        playerId: client.sessionId,
      },
      { except: client },
    )
  }

  onMessage(client: Client, type: string, message: any) {
    console.log(`BattleRoom received message from ${client.sessionId}:`, type, message)

    const player = this.state.players.get(client.sessionId)
    if (!player) {
      console.log(`Player ${client.sessionId} not found in battle state`)
      return
    }

    switch (type) {
      case "move":
        // Update player position for Three.js
        if (message.position) {
          player.position.x = message.position.x
          player.position.y = message.position.y
          player.position.z = message.position.z
        }
        if (message.rotation) {
          player.rotation.x = message.rotation.x
          player.rotation.y = message.rotation.y
          player.rotation.z = message.rotation.z
          player.rotation.w = message.rotation.w
        }
        break

      case "shoot":
        this.handleShooting(client, message)
        break

      case "ability":
        this.handleAbility(client, message)
        break

      case "get_battle_state":
        client.send("battle_room_stats_update", {
          totalPlayers: this.clients.length,
          gameStarted: this.gameStarted,
          gameTime: this.state.gameTime,
          gameMode: this.gameMode,
        })
        break

      case "test":
        client.send("test_response", {
          message: "Battle room test successful",
          totalPlayers: this.clients.length,
          gameStarted: this.gameStarted,
          gameMode: this.gameMode,
          timestamp: Date.now(),
        })
        break

      default:
        console.log(`Unknown message type in BattleRoom: ${type}`)
        break
    }
  }

  onLeave(client: Client, consented: boolean) {
    console.log(`${client.sessionId} left BattleRoom (consented: ${consented})`)

    // Remove player from state
    this.state.players.delete(client.sessionId)

    // Broadcast player count update
    this.broadcast("player_count_update", {
      count: this.clients.length,
      action: "left",
      playerId: client.sessionId,
    })

    // End game if not enough players
    if (this.clients.length < 2 && this.gameStarted) {
      this.endGame()
    }
  }

  onDispose() {
    console.log("BattleRoom disposed")
  }

  private startGame() {
    console.log("Starting battle game!")
    this.gameStarted = true
    this.state.gameStarted = true
    this.state.gameTime = 0

    this.broadcast("game_started", {
      message: "Battle has begun!",
      gameMode: this.gameMode,
      mapTheme: this.mapTheme,
    })
  }

  private endGame() {
    console.log("Ending battle game!")
    this.gameStarted = false
    this.state.gameStarted = false

    // Calculate winner
    let winner = null
    let highestScore = -1

    this.state.players.forEach((player) => {
      if (player.score > highestScore) {
        highestScore = player.score
        winner = player
      }
    })

    this.broadcast("game_ended", {
      message: "Battle has ended!",
      winner: winner
        ? {
            sessionId: winner.sessionId,
            username: winner.username,
            score: winner.score,
          }
        : null,
    })
  }

  private updateGameLogic() {
    // Update projectiles, abilities, etc.
    // This runs at 60 FPS for smooth Three.js synchronization

    // Update projectiles
    this.state.projectiles.forEach((projectile, id) => {
      // Move projectile
      projectile.position.x += projectile.velocity.x * (1 / 60)
      projectile.position.y += projectile.velocity.y * (1 / 60)
      projectile.position.z += projectile.velocity.z * (1 / 60)

      // Check for collisions with players
      this.state.players.forEach((player) => {
        if (player.sessionId !== projectile.ownerId && player.isAlive) {
          const distance = Math.sqrt(
            Math.pow(player.position.x - projectile.position.x, 2) +
              Math.pow(player.position.y - projectile.position.y, 2) +
              Math.pow(player.position.z - projectile.position.z, 2),
          )

          if (distance < 1.0) {
            // Hit!
            this.handlePlayerHit(player, projectile)
            this.state.projectiles.delete(id)
          }
        }
      })

      // Remove projectile if it's too old
      if (Date.now() - projectile.createdAt > 5000) {
        this.state.projectiles.delete(id)
      }
    })
  }

  private handleShooting(client: Client, message: any) {
    const player = this.state.players.get(client.sessionId)
    if (!player || !player.isAlive) return

    // Create projectile
    const projectileId = `${client.sessionId}_${Date.now()}`
    const projectile = {
      id: projectileId,
      ownerId: client.sessionId,
      position: { ...player.position },
      velocity: message.direction || { x: 0, y: 0, z: 1 },
      damage: 25,
      createdAt: Date.now(),
    }

    this.state.projectiles.set(projectileId, projectile)

    // Broadcast shooting event
    this.broadcast("player_shot", {
      playerId: client.sessionId,
      projectile: projectile,
    })
  }

  private handleAbility(client: Client, message: any) {
    const player = this.state.players.get(client.sessionId)
    if (!player || !player.isAlive) return

    // Handle different abilities
    switch (message.abilityType) {
      case "heal":
        player.health = Math.min(100, player.health + 25)
        break
      case "speed_boost":
        // This would be handled client-side in Three.js
        break
      case "shield":
        // Temporary invincibility
        break
    }

    this.broadcast("player_ability", {
      playerId: client.sessionId,
      abilityType: message.abilityType,
    })
  }

  private handlePlayerHit(player: any, projectile: any) {
    player.health -= projectile.damage

    if (player.health <= 0) {
      player.isAlive = false
      player.deaths += 1

      // Award kill to shooter
      const shooter = this.state.players.get(projectile.ownerId)
      if (shooter) {
        shooter.kills += 1
        shooter.score += 100
      }

      this.broadcast("player_killed", {
        victimId: player.sessionId,
        killerId: projectile.ownerId,
      })

      // Respawn after 3 seconds
      this.clock.setTimeout(() => {
        player.health = 100
        player.isAlive = true
        player.position.x = Math.random() * 20 - 10
        player.position.z = Math.random() * 20 - 10

        this.broadcast("player_respawned", {
          playerId: player.sessionId,
          position: player.position,
        })
      }, 3000)
    } else {
      this.broadcast("player_hit", {
        playerId: player.sessionId,
        damage: projectile.damage,
        health: player.health,
      })
    }
  }
}
