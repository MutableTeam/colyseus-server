import { Room, type Client } from "@colyseus/core"
import { RaceState } from "../schemas/RaceState"
import { RacePlayer } from "../schemas/RacePlayer"
import { Checkpoint } from "../schemas/Checkpoint"

export class RaceRoom extends Room<RaceState> {
  maxClients = 8

  // Race settings
  private trackLength = 5000 // Length of the race track
  private numCheckpoints = 5 // Number of checkpoints
  private tickRate = 20 // 20 updates per second
  private countdownTime = 3 // Countdown in seconds before race starts

  onCreate(options: any) {
    console.log("RaceRoom created!", options)

    // Initialize the room state
    this.setState(new RaceState())

    // Set track settings from options or use defaults
    this.trackLength = options.trackLength || this.trackLength
    this.numCheckpoints = options.numCheckpoints || this.numCheckpoints

    // Create checkpoints
    this.createCheckpoints()

    // Set up physics simulation
    this.setSimulationInterval((deltaTime: number) => this.update(deltaTime), 1000 / this.tickRate)

    // Handle player movement
    this.onMessage("move", (client: Client, message: any) => {
      const player = this.state.players.get(client.sessionId)
      if (!player) return

      // Update player's acceleration and steering
      player.acceleration = message.acceleration || 0
      player.steering = message.steering || 0
    })

    // Handle player using boost
    this.onMessage("use_boost", (client: Client) => {
      const player = this.state.players.get(client.sessionId)
      if (!player || !player.canUseBoost()) return

      player.activateBoost()
    })

    // Handle ready state
    this.onMessage("ready", (client: Client, message: any) => {
      const player = this.state.players.get(client.sessionId)
      if (!player) return

      player.ready = message.ready

      // Check if all players are ready to start the race
      this.checkRaceStart()
    })
  }

  onJoin(client: Client, options: any) {
    console.log(`Player ${client.sessionId} joined the race room`)

    // Create a new player
    const player = new RacePlayer()
    player.id = client.sessionId
    player.name = options.username || `Player_${client.sessionId.substr(0, 6)}`
    player.vehicleType = options.vehicleType || "default"

    // Set initial position at starting line
    player.position = 0
    player.lane = this.state.players.size + 1 // Assign lane based on join order

    // Add player to the game state
    this.state.players.set(client.sessionId, player)

    // Broadcast new player joined
    this.broadcast("player_joined", {
      id: player.id,
      name: player.name,
      vehicleType: player.vehicleType,
      lane: player.lane,
    })
  }

  onLeave(client: Client, consented: boolean) {
    console.log(`Player ${client.sessionId} left the race room`)

    // Remove player from the game state
    if (this.state.players.has(client.sessionId)) {
      this.state.players.delete(client.sessionId)

      // Broadcast player left
      this.broadcast("player_left", { id: client.sessionId })

      // If race hasn't started yet, check if we should start
      if (!this.state.raceStarted) {
        this.checkRaceStart()
      }
      // If race is in progress, check if it should end (e.g., only one player left)
      else if (!this.state.raceEnded) {
        this.checkRaceEnd()
      }
    }
  }

  onDispose() {
    console.log("Race room disposed")
  }

  private createCheckpoints() {
    // Create evenly spaced checkpoints along the track
    for (let i = 1; i <= this.numCheckpoints; i++) {
      const checkpoint = new Checkpoint()
      checkpoint.id = i
      checkpoint.position = (i * this.trackLength) / (this.numCheckpoints + 1)
      this.state.checkpoints.push(checkpoint)
    }
  }

  private update(deltaTime: number) {
    // Convert to seconds for physics calculations
    const dt = deltaTime / 1000

    // Handle countdown
    if (this.state.countdownActive) {
      this.state.countdownTime -= dt

      if (this.state.countdownTime <= 0) {
        this.state.countdownActive = false
        this.state.raceStarted = true
        this.state.raceStartTime = Date.now()

        // Broadcast race start
        this.broadcast("race_started", {
          startTime: this.state.raceStartTime,
        })
      }
    }

    // Skip updates if race hasn't started or has ended
    if (!this.state.raceStarted || this.state.raceEnded) return

    // Update player positions
    this.state.players.forEach((player: RacePlayer) => {
      // Skip finished players
      if (player.finished) return

      // Apply physics
      // Calculate acceleration based on player input and current speed
      const maxSpeed = player.boostActive ? player.maxSpeed * 1.5 : player.maxSpeed
      const targetSpeed = player.acceleration * maxSpeed

      // Apply acceleration/deceleration
      if (player.speed < targetSpeed) {
        player.speed += player.accelerationRate * dt
        if (player.speed > targetSpeed) player.speed = targetSpeed
      } else if (player.speed > targetSpeed) {
        player.speed -= player.brakeRate * dt
        if (player.speed < targetSpeed) player.speed = targetSpeed
      }

      // Update position
      player.position += player.speed * dt

      // Check for checkpoint crossings
      this.state.checkpoints.forEach((checkpoint: Checkpoint) => {
        if (!player.checkpoints.includes(checkpoint.id) && player.position >= checkpoint.position) {
          player.checkpoints.push(checkpoint.id)

          // Broadcast checkpoint reached
          this.broadcast("checkpoint_reached", {
            playerId: player.id,
            checkpointId: checkpoint.id,
          })
        }
      })

      // Check if player finished the race
      if (player.position >= this.trackLength && !player.finished) {
        this.playerFinished(player)
      }

      // Update boost status
      if (player.boostActive) {
        player.boostTimeRemaining -= dt
        if (player.boostTimeRemaining <= 0) {
          player.boostActive = false
        }
      } else {
        player.boostCooldown -= dt
        if (player.boostCooldown < 0) {
          player.boostCooldown = 0
        }
      }
    })

    // Update race time
    this.state.raceTime = (Date.now() - this.state.raceStartTime) / 1000

    // Check if race should end (time limit or all players finished)
    if (this.state.raceTime >= this.state.maxRaceTime) {
      this.endRace("time_limit")
    } else {
      this.checkRaceEnd()
    }
  }

  private playerFinished(player: RacePlayer) {
    player.finished = true
    player.finishTime = this.state.raceTime
    player.finishPosition = this.state.finishedPlayers + 1
    this.state.finishedPlayers++

    // Broadcast player finished
    this.broadcast("player_finished", {
      playerId: player.id,
      finishTime: player.finishTime,
      position: player.finishPosition,
    })
  }

  private checkRaceStart() {
    // Don't start if already started
    if (this.state.raceStarted || this.state.countdownActive) return

    // Check if all players are ready
    let allReady = true
    let playerCount = 0

    this.state.players.forEach((player: RacePlayer) => {
      playerCount++
      if (!player.ready) {
        allReady = false
      }
    })

    // Need at least 2 players and all must be ready
    if (playerCount >= 2 && allReady) {
      this.startRaceCountdown()
    }
  }

  private startRaceCountdown() {
    this.state.countdownActive = true
    this.state.countdownTime = this.countdownTime

    // Broadcast countdown start
    this.broadcast("countdown_started", {
      countdownTime: this.countdownTime,
    })
  }

  private checkRaceEnd() {
    // Don't check if race hasn't started or already ended
    if (!this.state.raceStarted || this.state.raceEnded) return

    // Count players who haven't finished
    let unfinishedPlayers = 0

    this.state.players.forEach((player: RacePlayer) => {
      if (!player.finished) {
        unfinishedPlayers++
      }
    })

    // End race if all players have finished
    if (unfinishedPlayers === 0) {
      this.endRace("all_finished")
    }
  }

  private endRace(reason: string) {
    this.state.raceEnded = true
    this.state.raceEndTime = Date.now()

    // Broadcast race end
    this.broadcast("race_ended", {
      reason: reason,
      raceTime: this.state.raceTime,
      playerResults: Array.from(this.state.players.entries())
        .map(([id, player]: [string, RacePlayer]) => ({
          id: id,
          name: player.name,
          finished: player.finished,
          finishTime: player.finishTime,
          position: player.finishPosition,
        }))
        .sort((a, b) => {
          // Sort by position (finished players first)
          if (a.finished && !b.finished) return -1
          if (!a.finished && b.finished) return 1
          if (a.finished && b.finished) return a.position - b.position
          return 0
        }),
    })

    // Schedule room disposal
    this.clock.setTimeout(() => {
      this.disconnect()
    }, 10000) // Give clients 10 seconds to receive final state
  }
}
