Colyseus Multiplayer Game Server - Client Integration Guide
This comprehensive guide explains how to integrate client applications with our Colyseus multiplayer game server. It covers connection setup, room types, schema structures, and provides examples for various platforms.

Table of Contents
Installation
JavaScript/TypeScript
Unity
Other Platforms
Connection Setup
Room Types
Lobby Room
Battle Room
Race Room
Platformer Room
Schema Structures
Player Schema
Vector2D Schema
Projectile Schema
Other Schemas
Manager Interactions
Collision Manager
Ability Manager
Authentication
Examples
Web Client Example
Unity Client Example
Troubleshooting
API Reference
Installation
JavaScript/TypeScript
Install the Colyseus client library using npm:

npm install colyseus.js

For browser environments, you can use the CDN:

```html
<script src="https://unpkg.com/colyseus.js@^0.14.0/dist/colyseus.js"></script>
```

### Unity

1. Download the latest [Colyseus Unity SDK](https://github.com/colyseus/colyseus-unity3d/releases)
2. Import the package into your Unity project
3. Configure the WebSocket libraries as per the Unity SDK documentation


### Other Platforms

- Defold: [colyseus-defold](https://github.com/colyseus/colyseus-defold)
- Haxe: [colyseus-hx](https://github.com/colyseus/colyseus-hx)
- Cocos Creator: [colyseus-cocos2d-x](https://github.com/colyseus/colyseus-cocos2d-x)


## Connection Setup

### Basic Connection

```typescript
import { Client } from "colyseus.js";

// Create a Colyseus client instance
const client = new Client("ws://your-server-url:2567");

// Connect to a room
async function connectToRoom() {
  try {
    const room = await client.joinOrCreate("lobby", {
      username: "Player1",
      // Additional options can be passed here
    });
    
    console.log("Connected to room:", room.id);
    
    // Set up event listeners
    setupRoomListeners(room);
    
    return room;
  } catch (error) {
    console.error("Failed to join room:", error);
  }
}

function setupRoomListeners(room) {
  // Listen for state changes
  room.onStateChange((state) => {
    console.log("Room state updated:", state);
  });
  
  // Listen for specific state changes
  room.state.players.onAdd((player, sessionId) => {
    console.log("Player added:", sessionId, player);
  });
  
  room.state.players.onRemove((player, sessionId) => {
    console.log("Player removed:", sessionId);
  });
  
  // Listen for custom messages
  room.onMessage("game_started", (message) => {
    console.log("Game started:", message);
  });
  
  // Handle disconnection
  room.onLeave((code) => {
    console.log("Left room:", code);
  });
}
```

### Reconnection

```typescript
// Store session id for reconnection
localStorage.setItem("sessionId", room.sessionId);

// Reconnect using the stored session id
async function reconnect() {
  try {
    const room = await client.reconnect(
      localStorage.getItem("roomId"),
      localStorage.getItem("sessionId")
    );
    console.log("Reconnected successfully!");
    return room;
  } catch (error) {
    console.error("Failed to reconnect:", error);
  }
}
```

## Room Types

Our server provides four different room types, each with specific functionality:

### Lobby Room

The Lobby Room serves as a matchmaking hub where players can create and join games.

```typescript
// Join the lobby
const lobby = await client.joinOrCreate("lobby", { username: "Player1" });

// Listen for available games
lobby.onMessage("available_games", (games) => {
  console.log("Available games:", games);
});

// Create a new game
lobby.send("create_game", {
  gameType: "battle",
  gameName: "My Battle Room",
  maxPlayers: 4
});

// Join an existing game
lobby.send("join_game", {
  gameId: "game_id_here",
  gameType: "battle"
});

// Leave a game
lobby.send("leave_game", {
  gameId: "game_id_here"
});
```

### Battle Room

The Battle Room is an arena where players can fight against each other using different characters with unique abilities and projectiles.

```typescript
// Join a battle room
const battleRoom = await client.joinOrCreate("battle", {
  username: "Player1",
  characterType: "warrior"
});

// Set up battle room listeners
battleRoom.onStateChange((state) => {
  // Update game state (players, projectiles, etc.)
});

// Player movement
battleRoom.send("move", {
  x: 1, // -1 for left, 1 for right, 0 for no horizontal movement
  y: 0, // -1 for up, 1 for down, 0 for no vertical movement
  speed: 200
});

// Player shooting
battleRoom.send("shoot", {
  angle: Math.PI / 4, // Angle in radians
  type: "fireball" // Projectile type
});

// Using abilities
battleRoom.send("use_ability", {
  abilityId: "shockwave",
  targetPosition: { x: 500, y: 300 }
});

// Change character
battleRoom.send("change_character", {
  characterType: "mage"
});

// Ready up
battleRoom.send("ready", {
  ready: true
});

// Listen for game events
battleRoom.onMessage("player_joined", (data) => {
  console.log("Player joined:", data);
});

battleRoom.onMessage("player_left", (data) => {
  console.log("Player left:", data);
});

battleRoom.onMessage("game_started", (data) => {
  console.log("Game started:", data);
});

battleRoom.onMessage("player_died", (data) => {
  console.log("Player died:", data);
});

battleRoom.onMessage("game_ended", (data) => {
  console.log("Game ended:", data);
});
```

### Race Room

The Race Room is for racing games where players compete to reach the finish line first.

```typescript
// Join a race room
const raceRoom = await client.joinOrCreate("race", {
  username: "Player1",
  vehicleType: "sports"
});

// Set up race room listeners
raceRoom.onStateChange((state) => {
  // Update race state (player positions, checkpoints, etc.)
});

// Player movement
raceRoom.send("move", {
  acceleration: 1, // -1 to 1 (brake to full acceleration)
  steering: -0.5 // -1 to 1 (left to right)
});

// Use boost
raceRoom.send("use_boost");

// Ready up
raceRoom.send("ready", {
  ready: true
});

// Listen for race events
raceRoom.onMessage("countdown_started", (data) => {
  console.log("Countdown started:", data);
});

raceRoom.onMessage("race_started", (data) => {
  console.log("Race started:", data);
});

raceRoom.onMessage("checkpoint_reached", (data) => {
  console.log("Checkpoint reached:", data);
});

raceRoom.onMessage("player_finished", (data) => {
  console.log("Player finished:", data);
});

raceRoom.onMessage("race_ended", (data) => {
  console.log("Race ended:", data);
});
```

### Platformer Room

The Platformer Room is for cooperative or competitive platformer games with collectibles, enemies, and character abilities.

```typescript
// Join a platformer room
const platformerRoom = await client.joinOrCreate("platformer", {
  username: "Player1",
  characterType: "knight"
});

// Set up platformer room listeners
platformerRoom.onStateChange((state) => {
  // Update game state (players, platforms, collectibles, enemies, etc.)
});

// Player movement
platformerRoom.send("move", {
  direction: 1 // -1 for left, 0 for none, 1 for right
});

// Player jumping
platformerRoom.send("jump");

// Player attacking
platformerRoom.send("attack");

// Using abilities
platformerRoom.send("use_ability", {
  targetPosition: { x: 500, y: 300 }
});

// Ready up
platformerRoom.send("ready", {
  ready: true
});

// Listen for platformer events
platformerRoom.onMessage("level_data", (data) => {
  console.log("Level data received:", data);
});

platformerRoom.onMessage("game_started", (data) => {
  console.log("Game started:", data);
});

platformerRoom.onMessage("collectible_collected", (data) => {
  console.log("Collectible collected:", data);
});

platformerRoom.onMessage("enemy_defeated", (data) => {
  console.log("Enemy defeated:", data);
});

platformerRoom.onMessage("player_died", (data) => {
  console.log("Player died:", data);
});

platformerRoom.onMessage("player_respawned", (data) => {
  console.log("Player respawned:", data);
});

platformerRoom.onMessage("game_ended", (data) => {
  console.log("Game ended:", data);
});
```

## Schema Structures

Our server uses Colyseus Schema to synchronize state between server and clients. Here are the key schema structures:

### Player Schema

```typescript
// Client-side schema definition
import { Schema, type } from "@colyseus/schema";

class Vector2D extends Schema {
  @type("number") x = 0;
  @type("number") y = 0;
}

class Player extends Schema {
  @type("string") id: string;
  @type("string") name: string;
  @type("string") characterType = "default";

  @type(Vector2D) position = new Vector2D();
  @type(Vector2D) moveDirection = new Vector2D();
  @type("number") speed = 200;

  @type("number") health = 100;
  @type("number") maxHealth = 100;
  @type("number") kills = 0;

  @type("boolean") ready = false;

  @type("number") lastShotTime = 0;
  @type(["string"]) abilities = [];
}
```

### Vector2D Schema

```typescript
class Vector2D extends Schema {
  @type("number") x = 0;
  @type("number") y = 0;
}
```

### Projectile Schema

```typescript
class Projectile extends Schema {
  @type("string") id: string;
  @type("string") ownerId: string;
  @type("string") type = "default";

  @type(Vector2D) position = new Vector2D();
  @type(Vector2D) velocity = new Vector2D();

  @type("number") damage = 10;
  @type("number") radius = 5;
  @type("number") lifetime = 2; // seconds
}
```

### Other Schemas

For complete schema definitions, refer to the following files in the server repository:

- `src/schemas/BattleState.ts`
- `src/schemas/RaceState.ts`
- `src/schemas/PlatformerState.ts`
- `src/schemas/LobbyState.ts`
- `src/schemas/RacePlayer.ts`
- `src/schemas/PlatformerPlayer.ts`
- `src/schemas/Checkpoint.ts`
- `src/schemas/Platform.ts`
- `src/schemas/Collectible.ts`
- `src/schemas/Enemy.ts`


## Manager Interactions

The server uses several manager classes to handle game logic. Here's how clients interact with them:

### Collision Manager

The Collision Manager handles collision detection between game objects. Clients don't interact with it directly, but they receive the results of collision detection through state updates and messages.

### Ability Manager

The Ability Manager handles character abilities. Clients trigger abilities by sending messages to the server:

```typescript
// Using an ability
room.send("use_ability", {
  abilityId: "fireball",
  targetPosition: { x: 500, y: 300 }
});

// Listen for ability effects
room.onMessage("ability_used", (data) => {
  console.log("Ability used:", data);
  // data contains: playerId, abilityId, targetPosition, etc.
  
  // Handle visual effects based on ability type
  switch(data.abilityId) {
    case "fireball":
      createFireballEffect(data.targetPosition);
      break;
    case "teleport":
      createTeleportEffect(data.playerId, data.targetPosition);
      break;
    // Handle other abilities
  }
});
```

## Authentication

Our server currently uses a simple username-based authentication. For production, you might want to implement a more secure authentication system.

```typescript
// Basic authentication when joining a room
const room = await client.joinOrCreate("lobby", {
  username: "Player1",
  token: "optional-auth-token"
});
```

## Examples

### Web Client Example

Here's a complete example of a web client connecting to our Colyseus server:

```html
&lt;!DOCTYPE html>
<html>
<head>
  <title>Colyseus Game Client</title>
  <style>
    canvas {
      width: 800px;
      height: 600px;
      border: 1px solid black;
    }
    #controls {
      margin-top: 10px;
    }
  </style>
</head>
<body>
  <h1>Colyseus Game Client</h1>
  <canvas id="gameCanvas" width="800" height="600"></canvas>
  <div id="controls">
    <button id="connectBtn">Connect to Lobby</button>
    <button id="createGameBtn" disabled>Create Battle Game</button>
    <button id="readyBtn" disabled>Ready</button>
  </div>
  <div id="gamesList"></div>
  <div id="status"></div>

  <script src="https://unpkg.com/colyseus.js@^0.14.0/dist/colyseus.js"></script>
  <script>
    // Game client implementation
    const client = new Colyseus.Client('ws://your-server-url:2567');
    let lobbyRoom = null;
    let gameRoom = null;
    
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const statusDiv = document.getElementById('status');
    const gamesListDiv = document.getElementById('gamesList');
    
    // UI elements
    const connectBtn = document.getElementById('connectBtn');
    const createGameBtn = document.getElementById('createGameBtn');
    const readyBtn = document.getElementById('readyBtn');
    
    // Connect to lobby
    connectBtn.addEventListener('click', async () => {
      try {
        statusDiv.innerText = "Connecting to lobby...";
        lobbyRoom = await client.joinOrCreate("lobby", { username: "Player_" + Math.floor(Math.random() * 1000) });
        statusDiv.innerText = "Connected to lobby!";
        createGameBtn.disabled = false;
        
        // Set up lobby listeners
        lobbyRoom.onMessage("available_games", (games) => {
          updateGamesList(games);
        });
        
        lobbyRoom.onMessage("game_created", (game) => {
          statusDiv.innerText = `Game created: ${game.gameName} (${game.gameId})`;
          joinGame(game.gameId, game.gameType);
        });
        
        // Request available games
        lobbyRoom.send("get_games");
      } catch (error) {
        statusDiv.innerText = "Error connecting to lobby: " + error.message;
      }
    });
    
    // Create a battle game
    createGameBtn.addEventListener('click', () => {
      if (lobbyRoom) {
        lobbyRoom.send("create_game", {
          gameType: "battle",
          gameName: "Battle_" + Math.floor(Math.random() * 1000),
          maxPlayers: 4
        });
      }
    });
    
    // Ready up
    readyBtn.addEventListener('click', () => {
      if (gameRoom) {
        gameRoom.send("ready", { ready: true });
        readyBtn.disabled = true;
        statusDiv.innerText = "Ready! Waiting for other players...";
      }
    });
    
    // Update games list
    function updateGamesList(games) {
      gamesListDiv.innerHTML = "<h3>Available Games:</h3>";
      if (games.length === 0) {
        gamesListDiv.innerHTML += "<p>No games available</p>";
        return;
      }
      
      const ul = document.createElement('ul');
      games.forEach(game => {
        const li = document.createElement('li');
        li.innerText = `${game.gameName} (${game.gameType}) - ${game.currentPlayers}/${game.maxPlayers} players`;
        
        const joinBtn = document.createElement('button');
        joinBtn.innerText = "Join";
        joinBtn.onclick = () => joinGame(game.gameId, game.gameType);
        li.appendChild(joinBtn);
        
        ul.appendChild(li);
      });
      gamesListDiv.appendChild(ul);
    }
    
    // Join a game
    async function joinGame(gameId, gameType) {
      try {
        statusDiv.innerText = `Joining ${gameType} game...`;
        
        // Leave lobby first
        if (lobbyRoom) {
          lobbyRoom.leave();
        }
        
        // Join the game room
        gameRoom = await client.joinById(gameId, {
          username: "Player_" + Math.floor(Math.random() * 1000),
          characterType: "warrior"
        });
        
        statusDiv.innerText = `Joined ${gameType} game!`;
        readyBtn.disabled = false;
        
        // Set up game room listeners
        setupGameRoomListeners(gameRoom, gameType);
        
        // Start game loop
        requestAnimationFrame(gameLoop);
      } catch (error) {
        statusDiv.innerText = "Error joining game: " + error.message;
      }
    }
    
    // Set up game room listeners
    function setupGameRoomListeners(room, gameType) {
      room.onStateChange((state) => {
        // State updated
      });
      
      room.state.players.onAdd((player, sessionId) => {
        console.log("Player added:", sessionId, player);
      });
      
      room.state.players.onRemove((player, sessionId) => {
        console.log("Player removed:", sessionId);
      });
      
      room.onMessage("game_started", (data) => {
        statusDiv.innerText = "Game started!";
      });
      
      room.onMessage("game_ended", (data) => {
        statusDiv.innerText = `Game ended! Winner: ${data.winnerId}`;
      });
      
      // Add more listeners based on game type
      if (gameType === "battle") {
        setupBattleRoomListeners(room);
      } else if (gameType === "race") {
        setupRaceRoomListeners(room);
      } else if (gameType === "platformer") {
        setupPlatformerRoomListeners(room);
      }
    }
    
    // Set up battle room specific listeners
    function setupBattleRoomListeners(room) {
      room.onMessage("player_died", (data) => {
        console.log("Player died:", data);
      });
      
      // Add keyboard controls for battle room
      document.addEventListener('keydown', (e) => {
        if (!room) return;
        
        switch(e.key) {
          case 'ArrowLeft':
            room.send("move", { x: -1, y: 0, speed: 200 });
            break;
          case 'ArrowRight':
            room.send("move", { x: 1, y: 0, speed: 200 });
            break;
          case 'ArrowUp':
            room.send("move", { x: 0, y: -1, speed: 200 });
            break;
          case 'ArrowDown':
            room.send("move", { x: 0, y: 1, speed: 200 });
            break;
          case ' ': // Space
            room.send("shoot", { angle: 0, type: "default" });
            break;
          case 'q':
            room.send("use_ability", { abilityId: "fireball", targetPosition: { x: 500, y: 300 } });
            break;
        }
      });
      
      document.addEventListener('keyup', (e) => {
        if (!room) return;
        
        if (['ArrowLeft', 'ArrowRight'].includes(e.key)) {
          room.send("move", { x: 0, y: 0 });
        } else if (['ArrowUp', 'ArrowDown'].includes(e.key)) {
          room.send("move", { x: 0, y: 0 });
        }
      });
    }
    
    // Set up race room specific listeners
    function setupRaceRoomListeners(room) {
      // Similar to battle room listeners
    }
    
    // Set up platformer room specific listeners
    function setupPlatformerRoomListeners(room) {
      // Similar to battle room listeners
    }
    
    // Game loop
    function gameLoop() {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw game state
      if (gameRoom && gameRoom.state) {
        // Draw players
        gameRoom.state.players.forEach((player, sessionId) => {
          ctx.fillStyle = sessionId === gameRoom.sessionId ? 'blue' : 'red';
          ctx.beginPath();
          ctx.arc(player.position.x, player.position.y, 20, 0, Math.PI * 2);
          ctx.fill();
          
          // Draw player name
          ctx.fillStyle = 'black';
          ctx.font = '12px Arial';
          ctx.fillText(player.name, player.position.x - 20, player.position.y - 25);
          
          // Draw health bar
          ctx.fillStyle = 'red';
          ctx.fillRect(player.position.x - 20, player.position.y - 20, 40, 5);
          ctx.fillStyle = 'green';
          ctx.fillRect(player.position.x - 20, player.position.y - 20, 40 * (player.health / player.maxHealth), 5);
        });
        
        // Draw projectiles if in battle room
        if (gameRoom.state.projectiles) {
          gameRoom.state.projectiles.forEach((projectile) => {
            ctx.fillStyle = 'orange';
            ctx.beginPath();
            ctx.arc(projectile.position.x, projectile.position.y, projectile.radius, 0, Math.PI * 2);
            ctx.fill();
          });
        }
      }
      
      requestAnimationFrame(gameLoop);
    }
  </script>
</body>
</html>
```

### Unity Client Example

Here's a basic example of connecting to our Colyseus server from Unity:

```csharp
using UnityEngine;
using Colyseus;
using System.Collections.Generic;

public class ColyseusClient : MonoBehaviour
{
    // Colyseus client instance
    private ColyseusClient client;
    private ColyseusRoom<dynamic> room;

    // Server URL
    [SerializeField] private string serverUrl = "ws://localhost:2567";
    [SerializeField] private string roomName = "battle";

    // Player prefab
    [SerializeField] private GameObject playerPrefab;
    
    // Dictionary to store player game objects
    private Dictionary<string, GameObject> players = new Dictionary<string, GameObject>();

    private async void Start()
    {
        // Create Colyseus client
        client = new ColyseusClient(serverUrl);
        
        try
        {
            // Join or create room
            room = await client.JoinOrCreate<dynamic>(roomName, new Dictionary<string, object>() {
                { "username", "UnityPlayer_" + Random.Range(0, 1000) },
                { "characterType", "warrior" }
            });
            
            Debug.Log("Connected to room: " + room.Id);
            
            // Set up room event handlers
            SetupRoomHandlers();
        }
        catch (System.Exception e)
        {
            Debug.LogError("Could not connect to server: " + e.Message);
        }
    }

    private void SetupRoomHandlers()
    {
        // Add event listeners
        room.OnStateChange += OnStateChangeHandler;
        room.OnMessage<object>("game_started", OnGameStarted);
        room.OnMessage<object>("game_ended", OnGameEnded);
        room.OnMessage<object>("player_died", OnPlayerDied);
        
        // Listen for player additions and removals
        room.State.players.OnAdd += OnPlayerAdd;
        room.State.players.OnRemove += OnPlayerRemove;
        
        // Listen for projectile additions and removals
        room.State.projectiles.OnAdd += OnProjectileAdd;
        room.State.projectiles.OnRemove += OnProjectileRemove;
    }

    private void OnStateChangeHandler(dynamic state, bool isFirstState)
    {
        // Handle state changes
        Debug.Log("State changed!");
    }

    private void OnPlayerAdd(string sessionId, dynamic player)
    {
        Debug.Log("Player added: " + sessionId);
        
        // Create player game object
        GameObject playerGO = Instantiate(playerPrefab, new Vector3(player.position.x, 0, player.position.y), Quaternion.identity);
        playerGO.name = "Player_" + sessionId;
        
        // Store reference to player game object
        players[sessionId] = playerGO;
        
        // Set up player component
        PlayerController controller = playerGO.GetComponent<PlayerController>();
        if (controller != null)
        {
            controller.Initialize(player, sessionId == room.SessionId);
        }
    }

    private void OnPlayerRemove(string sessionId, dynamic player)
    {
        Debug.Log("Player removed: " + sessionId);
        
        // Remove player game object
        if (players.TryGetValue(sessionId, out GameObject playerGO))
        {
            Destroy(playerGO);
            players.Remove(sessionId);
        }
    }

    private void OnProjectileAdd(string projectileId, dynamic projectile)
    {
        // Create projectile game object
        // ...
    }

    private void OnProjectileRemove(string projectileId, dynamic projectile)
    {
        // Remove projectile game object
        // ...
    }

    private void OnGameStarted(object message)
    {
        Debug.Log("Game started!");
    }

    private void OnGameEnded(object message)
    {
        Debug.Log("Game ended!");
    }

    private void OnPlayerDied(object message)
    {
        Debug.Log("Player died!");
    }

    private void Update()
    {
        // Handle player input
        if (room != null)
        {
            // Movement
            float horizontal = Input.GetAxis("Horizontal");
            float vertical = Input.GetAxis("Vertical");
            
            if (horizontal != 0 || vertical != 0)
            {
                room.Send("move", new Dictionary<string, object>() {
                    { "x", horizontal },
                    { "y", vertical },
                    { "speed", 200 }
                });
            }
            
            // Shooting
            if (Input.GetMouseButtonDown(0))
            {
                // Calculate angle from player to mouse position
                // ...
                float angle = 0; // Replace with actual calculation
                
                room.Send("shoot", new Dictionary<string, object>() {
                    { "angle", angle },
                    { "type", "default" }
                });
            }
            
            // Abilities
            if (Input.GetKeyDown(KeyCode.Q))
            {
                room.Send("use_ability", new Dictionary<string, object>() {
                    { "abilityId", "fireball" },
                    { "targetPosition", new Dictionary<string, object>() {
                        { "x", 500 },
                        { "y", 300 }
                    }}
                });
            }
            
            // Ready up
            if (Input.GetKeyDown(KeyCode.R))
            {
                room.Send("ready", new Dictionary<string, object>() {
                    { "ready", true }
                });
            }
        }
    }

    private void OnDestroy()
    {
        // Leave room when script is destroyed
        room?.Leave();
    }
}
```

## Troubleshooting

### Common Issues

#### Connection Errors

- **Error**: Failed to connect to server

- **Solution**: Check that the server is running and the URL is correct
- **Solution**: Verify that your firewall isn't blocking the connection



- **Error**: Room not found

- **Solution**: Make sure you're using the correct room name
- **Solution**: Check if the room exists on the server





#### State Synchronization Issues

- **Error**: Schema mismatch

- **Solution**: Make sure your client-side schema definitions match the server-side schemas
- **Solution**: Update your client code to match the latest server schema changes



- **Error**: Undefined properties in state

- **Solution**: Check that you're accessing properties that exist in the schema
- **Solution**: Use optional chaining (`?.`) when accessing potentially undefined properties





#### Authentication Issues

- **Error**: Unauthorized

- **Solution**: Make sure you're providing the correct authentication credentials
- **Solution**: Check if your authentication token is valid and not expired





### Debugging Tips

1. **Enable Debug Logging**:

```typescript
// JavaScript/TypeScript
Colyseus.setDevMode(true);
```


2. **Monitor Network Traffic**:

1. Use browser developer tools (Network tab) to monitor WebSocket traffic
2. Use Wireshark for more detailed network analysis



3. **Check Server Logs**:

1. Look at the server logs for error messages
2. Increase log verbosity on the server if needed





## API Reference

For a complete API reference, please refer to the official Colyseus documentation:

- [Colyseus Client API](https://docs.colyseus.io/colyseus/client/)
- [Colyseus Server API](https://docs.colyseus.io/colyseus/server/)
- [Colyseus Schema API](https://docs.colyseus.io/colyseus/state/schema/)


## Contributing

If you find any issues or have suggestions for improving this integration guide, please submit an issue or pull request to our repository.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
