import { Schema, MapSchema, type } from "@colyseus/schema"
import { LobbyPlayer } from "./LobbyPlayer"

export class DiscoveredLobby extends Schema {
  @type("string") id = ""
  @type("string") name = ""
  @type("string") type = ""
  @type("number") currentPlayers = 0
  @type("number") maxPlayers = 0
  @type("number") createdAt = 0
  @type("boolean") locked = false
  @type("boolean") private = false
}

export class HubState extends Schema {
  @type({ map: LobbyPlayer }) players = new MapSchema<LobbyPlayer>()
  @type({ map: DiscoveredLobby }) discoveredLobbies = new MapSchema<DiscoveredLobby>()
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
    player.username = name // Set username same as name
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

  // Added missing method for lobby discovery
  updateAvailableLobbies(lobbies: any[]) {
    // Clear existing lobbies
    this.discoveredLobbies.clear()

    // Add new lobbies
    lobbies.forEach((lobbyData) => {
      const lobby = new DiscoveredLobby()
      lobby.id = lobbyData.id
      lobby.name = lobbyData.name
      lobby.type = lobbyData.type
      lobby.currentPlayers = lobbyData.currentPlayers
      lobby.maxPlayers = lobbyData.maxPlayers
      lobby.createdAt = lobbyData.createdAt
      lobby.locked = lobbyData.locked
      lobby.private = lobbyData.private

      this.discoveredLobbies.set(lobbyData.id, lobby)
    })

    this.lastUpdated = Date.now()
  }

  getAllAvailableLobbies() {
    const lobbies: any[] = []
    this.discoveredLobbies.forEach((lobby) => {
      lobbies.push({
        id: lobby.id,
        name: lobby.name,
        type: lobby.type,
        currentPlayers: lobby.currentPlayers,
        maxPlayers: lobby.maxPlayers,
        createdAt: lobby.createdAt,
        locked: lobby.locked,
        private: lobby.private,
      })
    })
    return lobbies
  }

  getLobbiesByType(gameType: string) {
    const lobbies: any[] = []
    this.discoveredLobbies.forEach((lobby) => {
      if (lobby.type === gameType) {
        lobbies.push({
          id: lobby.id,
          name: lobby.name,
          type: lobby.type,
          currentPlayers: lobby.currentPlayers,
          maxPlayers: lobby.maxPlayers,
          createdAt: lobby.createdAt,
          locked: lobby.locked,
          private: lobby.private,
        })
      }
    })
    return lobbies
  }
}
