import { Schema, MapSchema, type } from "@colyseus/schema"
import { GameListing } from "./GameListing"

export class HubState extends Schema {
  @type({ map: GameListing }) availableRooms = new MapSchema<GameListing>()
  @type({ map: GameListing }) availableLobbies = new MapSchema<GameListing>()
  @type("number") totalPlayers = 0
  @type("number") totalRooms = 0
  @type("number") totalLobbies = 0
  @type("number") lastUpdated = 0

  constructor() {
    super()
    this.lastUpdated = Date.now()
  }

  addRoom(roomId: string, roomData: any) {
    const listing = new GameListing()
    listing.roomId = roomId
    listing.name = roomData.name || `Room_${roomId.substring(0, 8)}`
    listing.gameType = roomData.gameType || "unknown"
    listing.currentPlayers = roomData.currentPlayers || 0
    listing.maxPlayers = roomData.maxPlayers || 8
    listing.isPublic = roomData.isPublic !== false
    listing.gameStarted = roomData.gameStarted || false
    listing.createdAt = roomData.createdAt || Date.now()

    this.availableRooms.set(roomId, listing)
    this.updateCounts()
  }

  addLobby(lobbyId: string, lobbyData: any) {
    const listing = new GameListing()
    listing.roomId = lobbyId
    listing.name = lobbyData.name || `Lobby_${lobbyId.substring(0, 8)}`
    listing.gameType = "lobby"
    listing.currentPlayers = lobbyData.currentPlayers || 0
    listing.maxPlayers = lobbyData.maxPlayers || 8
    listing.isPublic = lobbyData.isPublic !== false
    listing.gameStarted = false
    listing.createdAt = lobbyData.createdAt || Date.now()

    this.availableLobbies.set(lobbyId, listing)
    this.updateCounts()
  }

  removeRoom(roomId: string) {
    if (this.availableRooms.has(roomId)) {
      this.availableRooms.delete(roomId)
      this.updateCounts()
    }
  }

  removeLobby(lobbyId: string) {
    if (this.availableLobbies.has(lobbyId)) {
      this.availableLobbies.delete(lobbyId)
      this.updateCounts()
    }
  }

  updateRoom(roomId: string, roomData: any) {
    const listing = this.availableRooms.get(roomId)
    if (listing) {
      listing.currentPlayers = roomData.currentPlayers || listing.currentPlayers
      listing.gameStarted = roomData.gameStarted || listing.gameStarted
      this.updateCounts()
    }
  }

  updateLobby(lobbyId: string, lobbyData: any) {
    const listing = this.availableLobbies.get(lobbyId)
    if (listing) {
      listing.currentPlayers = lobbyData.currentPlayers || listing.currentPlayers
      this.updateCounts()
    }
  }

  private updateCounts() {
    this.totalRooms = this.availableRooms.size
    this.totalLobbies = this.availableLobbies.size

    let playerCount = 0
    this.availableRooms.forEach((room) => {
      playerCount += room.currentPlayers
    })
    this.availableLobbies.forEach((lobby) => {
      playerCount += lobby.currentPlayers
    })

    this.totalPlayers = playerCount
    this.lastUpdated = Date.now()
  }

  updateAvailableLobbies(lobbies: any[]) {
    // Clear existing lobbies
    this.availableLobbies.clear()

    // Add new lobbies
    lobbies.forEach((lobby) => {
      this.addLobby(lobby.roomId, lobby)
    })
  }

  getPublicRooms(): GameListing[] {
    const publicRooms: GameListing[] = []
    this.availableRooms.forEach((room) => {
      if (room.isPublic) {
        publicRooms.push(room)
      }
    })
    return publicRooms
  }

  getPublicLobbies(): GameListing[] {
    const publicLobbies: GameListing[] = []
    this.availableLobbies.forEach((lobby) => {
      if (lobby.isPublic) {
        publicLobbies.push(lobby)
      }
    })
    return publicLobbies
  }
}
