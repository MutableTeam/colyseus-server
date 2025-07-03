import { Schema, MapSchema, ArraySchema, type } from "@colyseus/schema"
import { Player } from "./Player"

export class GameLobby extends Schema {
  @type("string") id = ""
  @type("string") name = ""
  @type("string") gameType = ""
  @type("string") gameMode = ""
  @type("string") mapTheme = ""
  @type("number") maxPlayers = 8
  @type("number") currentPlayers = 0
  @type("boolean") isPublic = true
  @type("boolean") isStarted = false
  @type("string") hostId = ""
  @type("number") createdAt = 0

  constructor(id: string, name: string, gameType: string, hostId: string) {
    super()
    this.id = id
    this.name = name
    this.gameType = gameType
    this.hostId = hostId
    this.createdAt = Date.now()
  }
}

export class LobbyState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>()
  @type([GameLobby]) availableLobbies = new ArraySchema<GameLobby>()
  @type("string") lobbyName = ""
  @type("string") gameType = ""
  @type("string") gameMode = "deathmatch"
  @type("string") mapTheme = "default"
  @type("number") maxPlayers = 8
  @type("boolean") isPublic = true
  @type("string") hostId = ""
  @type("boolean") gameStarted = false
  @type("number") countdown = 0
  @type("number") lastUpdate = 0

  constructor() {
    super()
    this.lastUpdate = Date.now()
  }

  addPlayer(sessionId: string, name: string, characterType = "default"): Player {
    const player = new Player(sessionId, sessionId, name)
    player.characterType = characterType
    player.ready = false
    player.selectedGameType = this.gameType

    this.players.set(sessionId, player)
    this.lastUpdate = Date.now()

    console.log(`✅ LobbyState: Added player ${name} (${sessionId})`)
    return player
  }

  removePlayer(sessionId: string): boolean {
    if (this.players.has(sessionId)) {
      this.players.delete(sessionId)
      this.lastUpdate = Date.now()
      console.log(`✅ LobbyState: Removed player ${sessionId}`)
      return true
    }
    return false
  }

  setPlayerReady(sessionId: string, ready: boolean): boolean {
    const player = this.players.get(sessionId)
    if (player) {
      player.ready = ready
      this.lastUpdate = Date.now()
      console.log(`✅ LobbyState: Player ${player.name} ready: ${ready}`)
      return true
    }
    return false
  }

  getAllPlayers(): Player[] {
    const playerList: Player[] = []
    this.players.forEach((player) => {
      playerList.push(player)
    })
    return playerList
  }

  getReadyPlayers(): Player[] {
    const readyPlayers: Player[] = []
    this.players.forEach((player) => {
      if (player.ready) {
        readyPlayers.push(player)
      }
    })
    return readyPlayers
  }

  areAllPlayersReady(): boolean {
    if (this.players.size === 0) return false

    let allReady = true
    this.players.forEach((player) => {
      if (!player.ready) {
        allReady = false
      }
    })
    return allReady
  }

  getPlayerCount(): number {
    return this.players.size
  }

  canStartGame(): boolean {
    const playerCount = this.getPlayerCount()
    const readyCount = this.getReadyPlayers().length

    // Need at least 2 players and all must be ready
    return playerCount >= 2 && readyCount === playerCount && this.areAllPlayersReady()
  }

  setGameType(gameType: string) {
    this.gameType = gameType
    this.lastUpdate = Date.now()

    // Update all players' selected game type
    this.players.forEach((player) => {
      player.selectedGameType = gameType
    })
  }

  setGameMode(gameMode: string) {
    this.gameMode = gameMode
    this.lastUpdate = Date.now()
  }

  setMapTheme(mapTheme: string) {
    this.mapTheme = mapTheme
    this.lastUpdate = Date.now()
  }

  addAvailableLobby(lobby: GameLobby) {
    this.availableLobbies.push(lobby)
    this.lastUpdate = Date.now()
  }

  removeAvailableLobby(lobbyId: string): boolean {
    for (let i = 0; i < this.availableLobbies.length; i++) {
      if (this.availableLobbies[i].id === lobbyId) {
        // Use splice to remove the item at index i
        this.availableLobbies.splice(i, 1)
        this.lastUpdate = Date.now()
        return true
      }
    }
    return false
  }

  updateLobbyPlayerCount(lobbyId: string, playerCount: number) {
    for (let i = 0; i < this.availableLobbies.length; i++) {
      if (this.availableLobbies[i].id === lobbyId) {
        this.availableLobbies[i].currentPlayers = playerCount
        this.lastUpdate = Date.now()
        break
      }
    }
  }

  getAvailableLobbies(): GameLobby[] {
    const lobbies: GameLobby[] = []
    this.availableLobbies.forEach((lobby) => {
      lobbies.push(lobby)
    })
    return lobbies
  }

  startCountdown(seconds = 5) {
    this.countdown = seconds
    this.lastUpdate = Date.now()
  }

  updateCountdown(): boolean {
    if (this.countdown > 0) {
      this.countdown--
      this.lastUpdate = Date.now()
      return this.countdown === 0
    }
    return false
  }

  resetCountdown() {
    this.countdown = 0
    this.lastUpdate = Date.now()
  }

  startGame() {
    this.gameStarted = true
    this.countdown = 0
    this.lastUpdate = Date.now()
  }

  resetGame() {
    this.gameStarted = false
    this.countdown = 0
    this.lastUpdate = Date.now()

    // Reset all players' ready status
    this.players.forEach((player) => {
      player.ready = false
    })
  }

  // Get lobby statistics
  getLobbyStats() {
    return {
      totalPlayers: this.getPlayerCount(),
      readyPlayers: this.getReadyPlayers().length,
      gameType: this.gameType,
      gameMode: this.gameMode,
      mapTheme: this.mapTheme,
      canStart: this.canStartGame(),
      gameStarted: this.gameStarted,
      countdown: this.countdown,
      availableLobbies: this.availableLobbies.length,
    }
  }
}
