import { Schema, MapSchema, type } from "@colyseus/schema"
import { Player } from "./Player"
import { GameListing } from "./GameListing"

export class HubState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>()
  @type({ map: GameListing }) availableLobbies = new MapSchema<GameListing>()
  @type("number") totalPlayers = 0
  @type("string") serverStatus = "online"
  @type("number") lastUpdated = Date.now()

  addPlayer(id: string, name: string) {
    const player = new Player()
    player.id = id
    player.name = name
    this.players.set(id, player)
    this.totalPlayers = this.players.size
    this.lastUpdated = Date.now()
    return player
  }

  removePlayer(id: string) {
    if (this.players.has(id)) {
      this.players.delete(id)
      this.totalPlayers = this.players.size
      this.lastUpdated = Date.now()
      return true
    }
    return false
  }

  updateAvailableLobbies(lobbies: GameListing[]) {
    // Clear existing lobbies
    this.availableLobbies.clear()

    // Add new lobbies
    lobbies.forEach((lobby) => {
      this.availableLobbies.set(lobby.id, lobby)
    })

    this.lastUpdated = Date.now()
  }

  addLobby(lobby: GameListing) {
    this.availableLobbies.set(lobby.id, lobby)
    this.lastUpdated = Date.now()
  }

  removeLobby(lobbyId: string) {
    if (this.availableLobbies.has(lobbyId)) {
      this.availableLobbies.delete(lobbyId)
      this.lastUpdated = Date.now()
      return true
    }
    return false
  }

  getLobbiesByType(gameType: string) {
    const lobbies: GameListing[] = []
    this.availableLobbies.forEach((lobby) => {
      if (lobby.type === gameType && !lobby.locked && lobby.currentPlayers < lobby.maxPlayers) {
        lobbies.push(lobby)
      }
    })
    return lobbies.sort((a, b) => b.createdAt - a.createdAt)
  }

  getAllAvailableLobbies() {
    const lobbies: GameListing[] = []
    this.availableLobbies.forEach((lobby) => {
      if (!lobby.locked && lobby.currentPlayers < lobby.maxPlayers) {
        lobbies.push(lobby)
      }
    })
    return lobbies.sort((a, b) => b.createdAt - a.createdAt)
  }
}
