import { Room, type Client } from "@colyseus/core"
import { BattleRoomState } from "./schema/BattleRoomState"

export class BattleRoom extends Room<BattleRoomState> {
  maxClients = 4

  onCreate(options: any) {
    this.setState(new BattleRoomState())

    this.onMessage("type", (client, message) => {
      //
      // handle "type" message.
      //
    })

    console.log(`🎮 BattleRoom ${this.roomId} created!`)
  }

  onJoin(client: Client, options: any) {
    console.log(`🚪 BattleRoom: Player ${client.sessionId} joined the battle room`)

    try {
      const username = options.username || `Player_${client.sessionId.substr(0, 6)}`

      // Add player to battle state
      const player = this.state.addPlayer(client.sessionId, username, options.team || "team1")

      console.log(`✅ BattleRoom: Player ${username} (${client.sessionId}) added to battle state`)

      // Send current battle room state to the new player
      const playersArray: Array<{ id: string; name: string; ready: boolean; team: string }> = []
      this.state.players.forEach((player, id) => {
        playersArray.push({
          id: id,
          name: player.name,
          ready: player.ready,
          team: player.team,
        })
      })

      client.send("battle_room_state", {
        players: playersArray,
        battleRoomId: this.roomId,
        gameMode: this.state.gameMode,
        playerCount: playersArray.length,
        timestamp: Date.now(),
      })

      // Send welcome message
      client.send("battle_room_welcome", {
        message: `Welcome to the battle room!`,
        playerId: client.sessionId,
        playerName: username,
        playerCount: playersArray.length,
        timestamp: Date.now(),
      })

      // Broadcast player joined to all other clients
      this.broadcast(
        "player_joined",
        {
          id: client.sessionId,
          name: username,
          team: player.team,
          playerCount: playersArray.length,
          timestamp: Date.now(),
        },
        { except: client },
      )

      // Broadcast updated player count
      this.broadcast("battle_room_stats_update", {
        totalPlayers: playersArray.length,
        timestamp: Date.now(),
      })

      console.log(`📊 BattleRoom: Now has ${this.clients.length} clients, ${playersArray.length} players`)
    } catch (error) {
      console.error(`❌ BattleRoom: Error in onJoin for ${client.sessionId}:`, error)
      client.send("error", { message: "Failed to join battle room" })
    }
  }

  onLeave(client: Client, consented: boolean) {
    console.log(`🚪 BattleRoom: Player ${client.sessionId} left the battle room`)
  }

  onDispose() {
    console.log(`🗑 BattleRoom ${this.roomId} disposing...`)
  }
}
