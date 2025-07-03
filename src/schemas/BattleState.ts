import { Schema, MapSchema, type } from "@colyseus/schema"
import { Player } from "./Player"
import { Projectile } from "./Projectile"

export class BattleState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>()
  @type({ map: Projectile }) projectiles = new MapSchema<Projectile>()
  @type("string") gameMode = "deathmatch"
  @type("string") mapTheme = "default"
  @type("number") maxPlayers = 16
  @type("number") gameStartTime = 0
  @type("boolean") gameActive = false
  @type("number") gameTimeLimit = 600000 // 10 minutes in milliseconds
  @type("string") roomName = ""

  // Real-time statistics for client synchronization
  @type("number") totalPlayers = 0
  @type("number") alivePlayers = 0
  @type("number") spectators = 0

  addPlayer(id: string, name: string, characterType = "default"): Player {
    const player = new Player()
    player.id = id
    player.name = name
    player.characterType = characterType
    player.score = 0
    player.isAlive = true
    player.health = player.maxHealth

    // Set initial position (you might want to randomize this)
    player.position.x = Math.random() * 20 - 10
    player.position.y = 0
    player.position.z = Math.random() * 20 - 10

    this.players.set(id, player)
    this.updatePlayerCounts()
    return player
  }

  removePlayer(id: string): boolean {
    if (this.players.has(id)) {
      this.players.delete(id)
      this.updatePlayerCounts()
      return true
    }
    return false
  }

  addProjectile(
    id: string,
    playerId: string,
    position: { x: number; y: number; z: number },
    direction: { x: number; y: number; z: number },
    weaponType = "default",
  ): Projectile {
    const projectile = new Projectile()
    projectile.id = id
    projectile.playerId = playerId
    projectile.weaponType = weaponType

    // Set position
    projectile.position.x = position.x
    projectile.position.y = position.y
    projectile.position.z = position.z

    // Set direction and velocity
    projectile.direction.x = direction.x
    projectile.direction.y = direction.y
    projectile.direction.z = direction.z
    projectile.setDirection(direction.x, direction.y, direction.z)

    this.projectiles.set(id, projectile)
    return projectile
  }

  usePlayerAbility(playerId: string, abilityId: string): boolean {
    const player = this.players.get(playerId)
    if (!player || !player.canUseAbility(abilityId)) {
      return false
    }

    player.setAbilityCooldown(abilityId)
    return true
  }

  updatePlayerCounts() {
    this.totalPlayers = this.players.size
    this.alivePlayers = 0
    this.spectators = 0

    this.players.forEach((player) => {
      if (player.isAlive) {
        this.alivePlayers++
      } else {
        this.spectators++
      }
    })
  }

  update(deltaTime: number) {
    // Update all projectiles
    this.projectiles.forEach((projectile, id) => {
      projectile.update(deltaTime)
      if (!projectile.active) {
        this.projectiles.delete(id)
      }
    })

    // Update player cooldowns
    this.players.forEach((player) => {
      player.updateCooldowns()
    })
  }

  getPlayerStats() {
    return {
      totalPlayers: this.totalPlayers,
      alivePlayers: this.alivePlayers,
      spectators: this.spectators,
      gameActive: this.gameActive,
      gameMode: this.gameMode,
      roomName: this.roomName,
    }
  }
}
