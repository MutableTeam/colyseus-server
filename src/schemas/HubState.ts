import { Schema, MapSchema, type } from "@colyseus/schema"
import { LobbyPlayer } from "./LobbyPlayer"

export class HubState extends Schema {
  @type({ map: LobbyPlayer }) players = new MapSchema<LobbyPlayer>()
  @type("number") totalPlayers = 0
  @type("number") onlinePlayers = 0
  @type("string") serverStatus = "online"
  @type("number") lastUpdated = 0
  @type({ map: "string" }) announcements = new MapSchema<string>()
  @type({ map: "number" }) roomCounts = new MapSchema<number>()

  constructor() {
    super()
    this.lastUpdated = Date.now()
    this.serverStatus = "online"
  }

  addPlayer(id: string, name: string, sessionId?: string) {
    const player = new LobbyPlayer()
    player.id = id
    player.name = name
    player.sessionId = sessionId || id
    player.status = "online"
    this.players.set(id, player)
    this.updateStats()
    return player
  }

  removePlayer(id: string) {
    if (this.players.has(id)) {
      this.players.delete(id)
      this.updateStats()
      return true
    }
    return false
  }

  updateStats() {
    this.totalPlayers = this.players.size
    this.onlinePlayers = 0

    this.players.forEach((player) => {
      if (player.status === "online" || player.status === "ready") {
        this.onlinePlayers++
      }
    })

    this.lastUpdated = Date.now()
  }

  addAnnouncement(id: string, message: string) {
    this.announcements.set(id, message)
  }

  removeAnnouncement(id: string) {
    this.announcements.delete(id)
  }

  updateRoomCount(roomType: string, count: number) {
    this.roomCounts.set(roomType, count)
  }

  getOnlinePlayers(): LobbyPlayer[] {
    const onlinePlayers: LobbyPlayer[] = []
    this.players.forEach((player) => {
      if (player.status === "online" || player.status === "ready") {
        onlinePlayers.push(player)
      }
    })
    return onlinePlayers
  }
}
