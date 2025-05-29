import { Schema, MapSchema, type } from "@colyseus/schema"

export class HubPlayer extends Schema {
  @type("string") sessionId = ""
  @type("string") username = ""
  @type("number") joinedAt = 0
}

export class HubState extends Schema {
  @type({ map: HubPlayer }) players = new MapSchema<HubPlayer>()
  @type("string") serverStatus = "online"
  @type("number") totalPlayers = 0
  @type("number") lastUpdate: number = Date.now()

  addPlayer(sessionId: string, username: string) {
    const player = new HubPlayer()
    player.sessionId = sessionId
    player.username = username
    player.joinedAt = Date.now()

    this.players.set(sessionId, player)
    this.totalPlayers = this.players.size
    this.lastUpdate = Date.now()
  }

  removePlayer(sessionId: string) {
    this.players.delete(sessionId)
    this.totalPlayers = this.players.size
    this.lastUpdate = Date.now()
  }

  getAllAvailableLobbies() {
    // For now return empty array - this will be populated by lobby discovery
    return []
  }

  getLobbiesByType(gameType: string) {
    // For now return empty array - this will be populated by lobby discovery
    return []
  }

  updateAvailableLobbies(lobbies: any[]) {
    // This will be implemented when we add lobby discovery
    this.lastUpdate = Date.now()
  }
}
