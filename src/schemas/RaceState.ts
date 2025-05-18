import { Schema, MapSchema, ArraySchema, type } from "@colyseus/schema"
import { RacePlayer } from "./RacePlayer"
import { Checkpoint } from "./Checkpoint"

export class RaceState extends Schema {
  @type({ map: RacePlayer }) players = new MapSchema<RacePlayer>()
  @type([Checkpoint]) checkpoints = new ArraySchema<Checkpoint>()

  @type("boolean") countdownActive = false
  @type("number") countdownTime = 0

  @type("boolean") raceStarted = false
  @type("boolean") raceEnded = false

  @type("number") raceStartTime = 0
  @type("number") raceEndTime = 0
  @type("number") raceTime = 0
  @type("number") maxRaceTime = 300 // 5 minutes

  @type("number") finishedPlayers = 0
}
