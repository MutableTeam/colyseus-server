import { Schema, MapSchema, type } from "@colyseus/schema"

export class HubPlayer extends Schema {
  @type("string") sessionId = ""
  @type("string") username = ""
  @type("number") joinedAt = 0
}

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
  @type({ map: HubPlayer }) players = new MapSchema<HubPlayer>()
  @type({ map: DiscoveredLobby }) discoveredLobbies = new MapSchema<DiscoveredLobby>()
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

    console.log(`🔄 HubState: Added player ${username}, total players now: ${this.totalPlayers}`)

    // Return the updated count for immediate broadcasting
    return this.totalPlayers
  }

  removePlayer(sessionId: string) {
    const removed = this.players.delete(sessionId)
    this.totalPlayers = this.players.size
    this.lastUpdate = Date.now()

    console.log(`🔄 HubState: Removed player ${sessionId}, total players now: ${this.totalPlayers}`)

    // Return the updated count for immediate broadcasting
    return { removed, totalPlayers: this.totalPlayers }
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

      // Ensure createdAt is always a number (timestamp)
      if (typeof lobbyData.createdAt === "number") {
        lobby.createdAt = lobbyData.createdAt
      } else if (typeof lobbyData.createdAt === "string") {
        lobby.createdAt = new Date(lobbyData.createdAt).getTime()
      } else {
        lobby.createdAt = Date.now()
      }

      lobby.locked = lobbyData.locked
      lobby.private = lobbyData.private

      this.discoveredLobbies.set(lobbyData.id, lobby)
    })

    this.lastUpdate = Date.now()
  }
}
