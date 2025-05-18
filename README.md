# Colyseus Multiplayer Game Server


A robust multiplayer game server built with Colyseus, designed for deployment on Vercel. This server supports multiple game types, player movement, projectiles, and characters with different abilities.


![Colyseus Logo](https://docs.colyseus.io/colyseus-logo-light.svg)


## Table of Contents


- [Overview](#overview)
- [Features](#features)
- [Project Structure](#project-structure)
- [Setup and Installation](#setup-and-installation)
- [Deploying to Vercel](#deploying-to-vercel)
- [Environment Variables](#environment-variables)
- [Client Integration](#client-integration)
 - [JavaScript/TypeScript](#javascripttypescript)
 - [React/Next.js](#reactnextjs)
 - [Unity](#unity)
 - [Other Platforms](#other-platforms)
- [Game Rooms](#game-rooms)
- [Custom Game Logic](#custom-game-logic)
- [WebSocket Considerations](#websocket-considerations)
- [Troubleshooting](#troubleshooting)


## Overview


This Colyseus server provides a foundation for multiplayer game development with support for various game types. It handles real-time communication, state synchronization, and game logic for different genres of games.


## Features


- **Lobby System**: Matchmaking and game creation
- **Multiple Game Types**:
 - Battle Room: Combat with projectiles and abilities
 - Race Room: Racing with checkpoints and boosts
 - Platformer Room: Platformer with collectibles and enemies
- **Character System**: Different character types with unique abilities
- **Projectile System**: Various projectile types with physics and collision
- **State Synchronization**: Efficient state updates using Colyseus schema
- **Vercel Deployment**: Configured for serverless deployment


## Project Structure


\`\`\`
colyseus-server/
├── src/
│   ├── index.ts                 # Server entry point
│   ├── rooms/                   # Game room implementations
│   │   ├── LobbyRoom.ts         # Lobby and matchmaking
│   │   ├── BattleRoom.ts        # Battle game mode
│   │   ├── RaceRoom.ts          # Racing game mode
│   │   └── PlatformerRoom.ts    # Platformer game mode
│   ├── schemas/                 # State schemas for synchronization
│   │   ├── Player.ts            # Player state
│   │   ├── Projectile.ts        # Projectile state
│   │   └── ...                  # Other game state schemas
│   └── managers/                # Game logic managers
│       ├── AbilityManager.ts    # Character abilities
│       └── CollisionManager.ts  # Collision detection
├── vercel.json                  # Vercel deployment configuration
├── package.json                 # Dependencies and scripts
├── tsconfig.json                # TypeScript configuration
└── Dockerfile                   # Docker configuration (optional)
\`\`\`


## Setup and Installation


### Prerequisites


- Node.js 14+ and npm
- Git
- Vercel CLI (optional, for local development with Vercel)


### Local Development


1. Clone the repository:
  \`\`\`bash
  git clone https://github.com/yourusername/colyseus-server.git
  cd colyseus-server
  \`\`\`


2. Install dependencies:
  \`\`\`bash
  npm install
  \`\`\`


3. Start the development server:
  \`\`\`bash
  npm start
  \`\`\`


4. The server will be running at `http://localhost:2567`


## Deploying to Vercel


### Method 1: Using the Vercel Dashboard


1. Push your code to a Git repository (GitHub, GitLab, or Bitbucket)


2. Log in to your Vercel account and click "New Project"


3. Import your repository and configure the project:
  - Build Command: `npm run vercel-build`
  - Output Directory: `lib`
  - Install Command: `npm install`


4. Add the required environment variables (see [Environment Variables](#environment-variables))


5. Click "Deploy"


### Method 2: Using the Vercel CLI


1. Install the Vercel CLI:
  \`\`\`bash
  npm install -g vercel
  \`\`\`


2. Log in to your Vercel account:
  \`\`\`bash
  vercel login
  \`\`\`


3. Deploy the project:
  \`\`\`bash
  vercel
  \`\`\`


4. Follow the prompts to configure your project


### Vercel Configuration


The `vercel.json` file in this project configures Vercel to properly handle the Colyseus server:


\`\`\`json
{
 "version": 2,
 "builds": [
   {
     "src": "src/index.ts",
     "use": "@vercel/node"
   }
 ],
 "routes": [
   {
     "src": "/(.*)",
     "dest": "src/index.ts"
   }
 ]
}
\`\`\`


## Environment Variables


Set the following environment variables in your Vercel project:


| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| PORT | The port the server will listen on | Yes | 2567 |
| NODE_ENV | Environment (development/production) | No | development |


To add environment variables in Vercel:
1. Go to your project in the Vercel dashboard
2. Navigate to Settings > Environment Variables
3. Add each variable and its value
4. Redeploy your project for the changes to take effect


## Client Integration


### JavaScript/TypeScript


#### Installation


Install the Colyseus client library:


\`\`\`bash
npm install colyseus.js
\`\`\`


#### Basic Connection


\`\`\`javascript
import { Client } from "colyseus.js";


// Create a client instance
const client = new Client("wss://your-colyseus-server.vercel.app");


async function connectToLobby() {
 try {
   // Connect to the lobby room
   const room = await client.joinOrCreate("lobby", {
     username: "Player1"
   });
  
   console.log("Connected to lobby!", room.sessionId);
  
   // Listen for messages from the server
   room.onMessage("lobby_state", (message) => {
     console.log("Received lobby state:", message);
   });
  
   room.onMessage("available_games", (games) => {
     console.log("Available games:", games);
   });
  
   // Create a new game
   room.send("create_game", {
     gameType: "battle",
     gameName: "My Battle Room",
     maxPlayers: 4
   });
  
   // Handle room state changes
   room.onStateChange((state) => {
     console.log("Lobby state updated:", state);
   });
  
 } catch (error) {
   console.error("Could not connect to lobby:", error);
 }
}


// Connect to the lobby
connectToLobby();
\`\`\`


#### Joining a Game Room


\`\`\`javascript
async function joinBattleRoom() {
 try {
   // Connect to a battle room
   const room = await client.joinOrCreate("battle", {
     username: "Player1",
     characterType: "mage"
   });
  
   console.log("Joined battle room!", room.sessionId);
  
   // Set up event listeners
   room.onMessage("game_started", (message) => {
     console.log("Game started:", message);
   });
  
   room.onMessage("player_joined", (message) => {
     console.log("Player joined:", message);
   });
  
   // Handle player movement
   window.addEventListener("keydown", (e) => {
     const moveDirection = { x: 0, y: 0 };
    
     if (e.key === "ArrowUp") moveDirection.y = -1;
     if (e.key === "ArrowDown") moveDirection.y = 1;
     if (e.key === "ArrowLeft") moveDirection.x = -1;
     if (e.key === "ArrowRight") moveDirection.x = 1;
    
     if (moveDirection.x !== 0 || moveDirection.y !== 0) {
       room.send("move", {
         x: moveDirection.x,
         y: moveDirection.y,
         speed: 200
       });
     }
   });
  
   // Handle shooting
   window.addEventListener("click", (e) => {
     const angle = Math.atan2(
       e.clientY - window.innerHeight / 2,
       e.clientX - window.innerWidth / 2
     );
    
     room.send("shoot", {
       angle: angle,
       type: "fireball"
     });
   });
  
   // Handle state changes
   room.onStateChange((state) => {
     // Update game state in your rendering engine
     updateGameState(state);
   });
  
 } catch (error) {
   console.error("Could not join battle room:", error);
 }
}


function updateGameState(state) {
 // Clear previous state
 clearGameObjects();
  // Update players
 state.players.forEach((player, key) => {
   renderPlayer(player);
 });
  // Update projectiles
 state.projectiles.forEach((projectile, key) => {
   renderProjectile(projectile);
 });
}
\`\`\`


#### Handling Room Events


\`\`\`javascript
// Listen for specific events
room.onMessage("player_died", (message) => {
 console.log(`Player ${message.playerId} was killed by ${message.killerId}`);
 playDeathAnimation(message.playerId);
});


room.onMessage("game_ended", (message) => {
 console.log("Game ended:", message);
 showGameOverScreen(message.winnerId, message.playerStats);
});


// Listen for errors
room.onError((code, message) => {
 console.error(`Error ${code}: ${message}`);
 showErrorMessage(`Connection error: ${message}`);
});


// Handle disconnection
room.onLeave((code) => {
 console.log(`Left room with code ${code}`);
  if (code === 1000) {
   // Normal closure
   showMessage("Disconnected from server");
 } else {
   // Abnormal closure
   showErrorMessage("Connection lost. Trying to reconnect...");
   reconnect();
 }
});
\`\`\`


#### Client-Side Prediction and Reconciliation


For smooth gameplay, implement client-side prediction and server reconciliation:


\`\`\`javascript
// Client-side prediction
let lastProcessedInput = 0;
const inputs = [];
const playerPosition = { x: 0, y: 0 };
const playerVelocity = { x: 0, y: 0 };


function processInput() {
 // Get input from player
 const input = getPlayerInput();
  // Store input with sequence number
 input.seq = lastProcessedInput++;
 inputs.push(input);
  // Send input to server
 room.send("move", input);
  // Apply input locally (prediction)
 applyInput(playerPosition, input);
  // Render game state
 render();
}


// Server reconciliation
room.onMessage("state_update", (serverState) => {
 // Server returns the last processed input sequence number
 const serverPos = serverState.position;
 const lastProcessedSeq = serverState.lastProcessedInput;
  // Rewind and replay
 if (lastProcessedSeq !== undefined) {
   // Remove all inputs that have been processed by the server
   inputs = inputs.filter(input => input.seq > lastProcessedSeq);
  
   // Reset position to server position
   playerPosition.x = serverPos.x;
   playerPosition.y = serverPos.y;
  
   // Replay all inputs not yet processed by the server
   inputs.forEach(input => {
     applyInput(playerPosition, input);
   });
 }
});


function applyInput(position, input) {
 position.x += input.x * input.speed * (1/60); // Assuming 60 FPS
 position.y += input.y * input.speed * (1/60);
}


// Run the game loop
setInterval(processInput, 1000 / 60); // 60 FPS
\`\`\`


### React/Next.js


#### Setting Up a Colyseus Client in React


\`\`\`jsx
// hooks/useColyseus.js
import { useState, useEffect, useCallback } from 'react';
import { Client } from 'colyseus.js';


export function useColyseus(serverUrl) {
 const [client, setClient] = useState(null);
 const [room, setRoom] = useState(null);
 const [error, setError] = useState(null);
 const [gameState, setGameState] = useState({});
 const [connected, setConnected] = useState(false);


 // Initialize client
 useEffect(() => {
   const colyseusClient = new Client(serverUrl);
   setClient(colyseusClient);
  
   return () => {
     if (room) {
       room.leave();
     }
   };
 }, [serverUrl]);


 // Join a room
 const joinRoom = useCallback(async (roomName, options = {}) => {
   if (!client) return;
  
   try {
     const newRoom = await client.joinOrCreate(roomName, options);
     setRoom(newRoom);
     setConnected(true);
    
     // Set up state change listener
     newRoom.onStateChange((state) => {
       setGameState(state);
     });
    
     // Set up error handler
     newRoom.onError((code, message) => {
       setError(`Error ${code}: ${message}`);
     });
    
     // Set up leave handler
     newRoom.onLeave((code) => {
       setConnected(false);
       if (code !== 1000) {
         setError(`Disconnected with code ${code}`);
       }
     });
    
     return newRoom;
   } catch (err) {
     setError(err.message);
     return null;
   }
 }, [client]);


 // Send a message to the room
 const sendMessage = useCallback((type, message) => {
   if (room && connected) {
     room.send(type, message);
   }
 }, [room, connected]);


 return {
   client,
   room,
   gameState,
   connected,
   error,
   joinRoom,
   sendMessage
 };
}
\`\`\`


#### Using the Hook in a Component


\`\`\`jsx
// components/GameComponent.jsx
import React, { useEffect, useState } from 'react';
import { useColyseus } from '../hooks/useColyseus';


export default function GameComponent() {
 const serverUrl = process.env.NEXT_PUBLIC_COLYSEUS_SERVER_URL || 'wss://your-colyseus-server.vercel.app';
 const { joinRoom, room, gameState, connected, error, sendMessage } = useColyseus(serverUrl);
 const [playerName, setPlayerName] = useState('Player1');
  useEffect(() => {
   // Join the lobby when component mounts
   joinRoom('lobby', { username: playerName });
 }, [joinRoom, playerName]);
  const handleCreateGame = () => {
   if (connected) {
     sendMessage('create_game', {
       gameType: 'battle',
       gameName: 'My Game',
       maxPlayers: 4
     });
   }
 };
  const handleJoinGame = (gameId) => {
   if (connected) {
     sendMessage('join_game', { gameId });
   }
 };
  if (error) {
   return <div className="error">Error: {error}</div>;
 }
  if (!connected) {
   return <div>Connecting to server...</div>;
 }
  return (
   <div className="game-container">
     <h2>Game Lobby</h2>
    
     <div className="player-list">
       <h3>Players Online: {gameState.players ? gameState.players.size : 0}</h3>
       <ul>
         {gameState.players && Array.from(gameState.players.entries()).map(([key, player]) => (
           <li key={key}>{player.name}</li>
         ))}
       </ul>
     </div>
    
     <div className="game-list">
       <h3>Available Games</h3>
       <button onClick={handleCreateGame}>Create New Game</button>
      
       <ul>
         {gameState.availableGames && Array.from(gameState.availableGames.entries()).map(([key, game]) => (
           <li key={key}>
             {game.name} ({game.type}) - {game.currentPlayers}/{game.maxPlayers}
             <button onClick={() => handleJoinGame(game.id)}>Join</button>
           </li>
         ))}
       </ul>
     </div>
   </div>
 );
}
\`\`\`


#### Next.js Integration


For Next.js projects, create a game client component:


\`\`\`jsx
// components/GameClient.jsx
'use client';


import { useEffect, useState } from 'react';
import { Client } from 'colyseus.js';


export default function GameClient() {
 const [client, setClient] = useState(null);
 const [room, setRoom] = useState(null);
 const [error, setError] = useState(null);
 const [gameState, setGameState] = useState({
   players: [],
   gameStarted: false
 });


 useEffect(() => {
   // Initialize Colyseus client
   const colyseusClient = new Client(process.env.NEXT_PUBLIC_COLYSEUS_SERVER_URL);
   setClient(colyseusClient);


   // Connect to the lobby
   async function connectToLobby() {
     try {
       const lobbyRoom = await colyseusClient.joinOrCreate("lobby", {
         username: "Player_" + Math.floor(Math.random() * 1000)
       });
      
       setRoom(lobbyRoom);
      
       // Set up event listeners
       lobbyRoom.onStateChange((state) => {
         setGameState({
           players: Array.from(state.players.values()),
           availableGames: Array.from(state.availableGames.values())
         });
       });
      
       lobbyRoom.onError((err) => {
         setError(`Room error: ${err}`);
       });
      
       lobbyRoom.onLeave((code) => {
         setRoom(null);
         setError(`Left lobby, code: ${code}`);
       });
      
     } catch (err) {
       setError(`Connection error: ${err.message}`);
     }
   }


   connectToLobby();


   // Cleanup on unmount
   return () => {
     if (room) {
       room.leave();
     }
   };
 }, []);


 const createGame = () => {
   if (!room) return;
  
   room.send("create_game", {
     gameType: "battle",
     gameName: "My Battle Game",
     maxPlayers: 4
   });
 };


 return (
   <div className="game-client">
     <h2>Game Lobby</h2>
    
     {error && (
       <div className="error-message">
         Error: {error}
       </div>
     )}
    
     <div className="player-list">
       <h3>Players Online: {gameState.players.length}</h3>
       <ul>
         {gameState.players.map(player => (
           <li key={player.id}>{player.name}</li>
         ))}
       </ul>
     </div>
    
     {gameState.availableGames && (
       <div className="games-list">
         <h3>Available Games: {gameState.availableGames.length}</h3>
         <ul>
           {gameState.availableGames.map(game => (
             <li key={game.id}>
               {game.name} ({game.type}) - {game.currentPlayers}/{game.maxPlayers} players
             </li>
           ))}
         </ul>
       </div>
     )}
    
     <button onClick={createGame}>Create New Game</button>
   </div>
 );
}
\`\`\`


### Unity


#### Installation


1. Download the Colyseus Unity SDK:
  - From [GitHub](https://github.com/colyseus/colyseus-unity3d)
  - Or use the Unity Package Manager with the git URL


2. Import the package into your Unity project


#### Basic Connection


```csharp
using UnityEngine;
using Colyseus;
using System.Collections.Generic;


public class GameNetworkManager : MonoBehaviour
{
   // Server connection settings
   [SerializeField] private string serverAddress = "wss://your-colyseus-server.vercel.app";
   [SerializeField] private string roomName = "lobby";
  
   private ColyseusClient client;
   private ColyseusRoom<RoomState> room;
  
   // Start is called before the first frame update
   async void Start()
   {
       client = new ColyseusClient(serverAddress);
      
       try {
           // Connect to the room
           Dictionary<string, object> options = new Dictionary<string, object>() {
               { "username", "Player_" + Random.Range(1000, 9999) }
           };
          
           Debug.Log("Connecting to Colyseus server...");
           room = await client.JoinOrCreate<RoomState>(roomName, options);
           Debug.Log("Connected to room: " + room.Id);
          
           // Add event listeners
           room.OnStateChange += OnStateChange;
           room.OnMessage<object>("game_created", OnGameCreated);
           room.OnMessage<object>("player_joined", OnPlayerJoined);
          
           // Handle errors and disconnection
           room.OnError += (code, message) => Debug.LogError($"Room error: {code} - {message}");
           room.OnLeave += (code) => Debug.Log($"Left room: {code}");
          
       } catch (System.Exception ex) {
           Debug.LogError("Failed to connect: " + ex.Message);
       }
   }
  
   private void OnStateChange(RoomState state, bool isFirstState)
   {
       Debug.Log("Room state updated!");
      
       // Process the state update
       if (isFirstState) {
           Debug.Log("Initial state received");
       }
      
       // Update game objects based on state
       UpdatePlayers(state.players);
   }
  
   private void UpdatePlayers(MapSchema<Player> players)
   {
       foreach (var kvp in players)
       {
           string playerId = kvp.Key;
           Player player = kvp.Value;
          
           // Find or create player game object
           GameObject playerObject = GetOrCreatePlayerObject(playerId);
          
           // Update player position and properties
           playerObject.transform.position = new Vector3(player.position.x, 0, player.position.y);
          
           // Update other player properties
           var playerComponent = playerObject.GetComponent<PlayerController>();
           if (playerComponent != null)
           {
               playerComponent.UpdateFromState(player);
           }
       }
   }
  
   private GameObject GetOrCreatePlayerObject(string playerId)
   {
       // Implementation to find or create player game objects
       // ...
      
       return null; // Replace with actual implementation
   }
  
   private void OnGameCreated(object message)
   {
       Debug.Log("Game created: " + message.ToString());
   }
  
   private void OnPlayerJoined(object message)
   {
       Debug.Log("Player joined: " + message.ToString());
   }
  
   // Send player movement to the server
   public void SendMovement(float x, float y, float speed)
   {
       if (room != null && room.Connection.IsOpen)
       {
           Dictionary<string, object> movement = new Dictionary<string, object>() {
               { "x", x },
               { "y", y },
               { "speed", speed }
           };
          
           room.Send("move", movement);
       }
   }
  
   // Send player action to the server
   public void SendAction(string actionType, Dictionary<string, object> data)
   {
       if (room != null && room.Connection.IsOpen)
       {
           room.Send(actionType, data);
       }
   }
  
   private void OnDestroy()
   {
       // Clean up when the game object is destroyed
       if (room != null && room.Connection.IsOpen)
       {
           room.Leave();
       }
   }
}


Since this will be used to train new Vercel chats on how to work with the Colyseus server when building games, I should make the instructions very clear and include practical examples.

`<CodeProject id="colyseus-server">````typescriptreact file="README.md"
...
```

#### Schema Generation

To work with the server's state schema in Unity:

1. Generate C# classes from your TypeScript schemas using the Colyseus Schema Codegen tool:


```bash
npx schema-codegen src/schemas/ --output unity-client/Assets/Scripts/Schema --csharp

```plaintext

2. Import the generated classes into your Unity project

#### Player Controller Example

```csharp
using UnityEngine;
using System.Collections.Generic;

public class PlayerController : MonoBehaviour
{
    [SerializeField] private GameNetworkManager networkManager;
    [SerializeField] private float moveSpeed = 5f;
    
    private float horizontalInput;
    private float verticalInput;
    
    void Update()
    {
        // Get input
        horizontalInput = Input.GetAxis("Horizontal");
        verticalInput = Input.GetAxis("Vertical");
        
        // Move locally for responsiveness
        transform.Translate(new Vector3(horizontalInput, 0, verticalInput) * moveSpeed * Time.deltaTime);
        
        // Send movement to server
        if (horizontalInput != 0 || verticalInput != 0)
        {
            networkManager.SendMovement(horizontalInput, verticalInput, moveSpeed);
        }
        
        // Handle shooting
        if (Input.GetMouseButtonDown(0))
        {
            // Calculate angle from player to mouse position
            Vector3 mousePos = Input.mousePosition;
            mousePos.z = Camera.main.transform.position.y - transform.position.y;
            Vector3 worldPos = Camera.main.ScreenToWorldPoint(mousePos);
            
            float angle = Mathf.Atan2(worldPos.z - transform.position.z, worldPos.x - transform.position.x);
            
            Dictionary<string, object> shootData = new Dictionary<string, object>() {
                { "angle", angle },
                { "type", "fireball" }
            };
            
            networkManager.SendAction("shoot", shootData);
        }
    }
    
    public void UpdateFromState(Player playerState)
    {
        // Update player properties from server state
        // This is used for reconciliation
        
        // Example: update health, character type, etc.
        // healthBar.SetHealth(playerState.health);
    }
}
```

### Other Platforms

Colyseus provides clients for various platforms:

- **Defold**: [colyseus-defold](https://github.com/colyseus/colyseus-defold)
- **Haxe**: [colyseus-hx](https://github.com/colyseus/colyseus-hx)
- **Cocos2d-x**: [colyseus-cocos2d-x](https://github.com/colyseus/colyseus-cocos2d-x)


Follow the platform-specific documentation for integration details.

## Game Rooms

This server includes several room types for different game genres:

### Lobby Room

The `LobbyRoom` handles matchmaking and game creation:

- Players can create games of different types
- Players can join existing games
- Provides a list of available games


### Battle Room

The `BattleRoom` implements a combat-focused game:

- Player movement and collision
- Projectile physics and damage
- Character abilities and cooldowns
- Health and kill tracking


### Race Room

The `RaceRoom` implements a racing game:

- Track with checkpoints
- Vehicle physics
- Boost mechanics
- Race timing and positioning


### Platformer Room

The `PlatformerRoom` implements a platformer game:

- Platform physics
- Collectibles
- Enemies with AI
- Character abilities


## Custom Game Logic

To customize the game logic for your specific needs:

1. Modify the room implementations in the `src/rooms/` directory
2. Update the state schemas in the `src/schemas/` directory
3. Add or modify managers in the `src/managers/` directory


Example: Adding a new ability to the `AbilityManager`:

```typescript
// In src/managers/AbilityManager.ts

// Add to getAbilitiesForCharacter method
case "ninja":
return ["shadowStep", "throwingStars", "smokeScreen"];

// Add implementation methods
private useShadowStepAbility(room: Room, player: Player, targetPosition: any) {
// Implementation for shadow step ability
console.log(`Player ${player.id} used shadow step ability`);

if (targetPosition) {
player.position.x = targetPosition.x;
player.position.y = targetPosition.y;

```plaintext
// Add a brief invulnerability period
player.invulnerable = true;
room.clock.setTimeout(() => {
  player.invulnerable = false;
}, 500);
```

}
}

```plaintext

## WebSocket Considerations

### Vercel and WebSockets

Vercel has some limitations with WebSockets in serverless functions:

1. **Connection Limits**: Serverless functions have connection limits and timeouts
2. **Cold Starts**: Functions may experience cold starts, affecting real-time performance
3. **Connection Duration**: Long-lived connections may be terminated

### Alternative Deployment Options

For production games with high player counts or requiring persistent connections:

1. **Hybrid Approach**:
   - Use Vercel for your game's frontend and API
   - Deploy the Colyseus server to a platform with better WebSocket support

2. **Recommended Platforms for Colyseus**:
   - [Render](https://render.com/)
   - [DigitalOcean](https://www.digitalocean.com/)
   - [Heroku](https://www.heroku.com/)
   - [AWS EC2](https://aws.amazon.com/ec2/)
   - [Google Cloud Run](https://cloud.google.com/run)

3. **Docker Deployment**:
   This project includes a Dockerfile for containerized deployment:
   \`\`\`bash
   docker build -t colyseus-server .
   docker run -p 2567:2567 colyseus-server
   \`\`\`

## Troubleshooting

### Common Issues and Solutions

#### Connection Issues

**Problem**: Cannot connect to the Colyseus server

**Solutions**:
- Ensure the server is running and accessible
- Check that you're using the correct WebSocket URL (wss:// for HTTPS sites)
- Verify CORS settings on the server
- Check for network/firewall issues

**Debugging**:
\`\`\`javascript
// Enable debug logging
import { Client } from "colyseus.js";
Client.debugMode = true;

// Test connection with a simple WebSocket
const ws = new WebSocket("wss://your-server.vercel.app");
ws.onopen = () => console.log("Connected!");
ws.onerror = (err) => console.error("Error:", err);
```

#### State Synchronization Issues

**Problem**: Game state not updating correctly

**Solutions**:

- Ensure schema definitions match between server and client
- Check for serialization errors with complex data types
- Verify that state changes are being applied correctly


**Debugging**:
```javascript
// Log state changes
room.onStateChange((state) => {
console.log("State updated:", JSON.stringify(state));
});

```plaintext

#### Performance Issues

**Problem**: Lag or stuttering gameplay

**Solutions**:
- Implement client-side prediction and reconciliation
- Optimize state synchronization (filter data sent to clients)
- Reduce update frequency for non-critical elements
- Use delta compression for state updates

**Example**:
\`\`\`javascript
// Only send updates for entities that changed
room.onMessage("entity_updates", (updates) => {
  updates.forEach(update => {
    const entity = entities.get(update.id);
    if (entity) {
      Object.assign(entity, update);
    }
  });
});
```

#### Reconnection Handling

**Problem**: Disconnections causing poor user experience

**Solution**: Implement reconnection logic

```javascript
let room = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;

async function connectToRoom() {
try {
room = await client.joinOrCreate("battle", options);
reconnectAttempts = 0;

```plaintext
// Set up normal room handlers
setupRoomHandlers();
```

} catch (error) {
handleConnectionError(error);
}
}

function setupRoomHandlers() {
room.onLeave((code) => {
if (code !== 1000) {
// Abnormal closure, try to reconnect
attemptReconnect();
}
});
}

async function attemptReconnect() {
if (reconnectAttempts >= maxReconnectAttempts) {
console.error("Max reconnection attempts reached");
showErrorMessage("Could not reconnect to server");
return;
}

reconnectAttempts++;
console.log(`Reconnection attempt ${reconnectAttempts}/${maxReconnectAttempts}`);

// Exponential backoff
const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000);

setTimeout(async () => {
try {
await connectToRoom();
} catch (error) {
console.error("Reconnection failed:", error);
}
}, delay);
}

```plaintext

#### Server-Side Issues

If you're experiencing issues on the server side:

1. Check server logs for errors
2. Verify that room handlers are correctly implemented
3. Ensure that state schemas are properly defined
4. Monitor server resources (CPU, memory, network)

For more detailed troubleshooting, refer to the [Colyseus documentation](https://docs.colyseus.io/).
```

`</CodeProject>`I've updated the README.md file with comprehensive instructions on how to integrate with the Colyseus server from the client side. The updated README now includes:

## Key Client Integration Sections:

1. **JavaScript/TypeScript Integration**

1. Basic connection setup
2. Joining game rooms
3. Handling room events
4. Client-side prediction and reconciliation
5. Code examples for common operations



2. **React/Next.js Integration**

1. Custom hook for Colyseus integration
2. Component examples for lobby and game rooms
3. State management with React
4. Next.js specific implementation



3. **Unity Integration**

1. Installation instructions
2. Connection setup
3. Schema generation
4. Player controller example
5. State synchronization



4. **Troubleshooting Guide**

1. Common connection issues
2. State synchronization problems
3. Performance optimization
4. Reconnection handling
5. Server-side debugging tips


This comprehensive guide will help new Vercel chats understand how to work with the Colyseus server when building multiplayer games, providing practical examples and best practices for client-side integration across different platforms

