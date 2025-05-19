### Colyseus Client Implementation Guide

This README provides a comprehensive guide for implementing client-side code to interact with our Colyseus v0.16 game server.

## Table of Contents

1. [Installation](#installation)
2. [Connecting to the Server](#connecting-to-the-server)
3. [Room Types](#room-types)

1. [Lobby Room](#lobby-room)
2. [Battle Room](#battle-room)
3. [Race Room](#race-room)
4. [Platformer Room](#platformer-room)



4. [Schema Synchronization](#schema-synchronization)
5. [Handling Game Events](#handling-game-events)
6. [Working with Abilities](#working-with-abilities)
7. [Client-Side Prediction](#client-side-prediction)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)


## Installation

First, install the Colyseus client library:

```shellscript
npm install colyseus.js@0.16.0
```

## Connecting to the Server

```typescript
import { Client, getStateCallbacks } from "colyseus.js";

// Create a client instance
const client = new Client("ws://your-server-address:2567");

// Connect to a room
async function connectToRoom() {
  try {
    // Join a room by name
    const room = await client.joinOrCreate("lobby", {
      username: "PlayerName",
      // Additional options can be passed here
    });
    
    console.log("Connected to room:", room.id);
    
    // Set up state callbacks (new in v0.16)
    const $ = getStateCallbacks(room);
    
    return { room, $ };
  } catch (error) {
    console.error("Failed to join room:", error);
  }
}
```

## Room Types

### Lobby Room

The Lobby Room is used for matchmaking and creating games.

```typescript
async function joinLobby() {
  const { room, $ } = await connectToRoom("lobby", { username: "Player1" });
  
  // Listen for available games
  room.onMessage("lobby_state", (message) => {
    console.log("Available games:", message.availableGames);
    console.log("Players in lobby:", message.players);
  });
  
  // Listen for new games being created
  room.onMessage("game_created", (message) => {
    console.log("New game created:", message);
  });
  
  // Create a new game
  function createGame(gameType, gameName, maxPlayers) {
    room.send("create_game", { gameType, gameName, maxPlayers });
  }
  
  // Join an existing game
  function joinGame(gameId, gameType) {
    room.send("join_game", { gameId, gameType });
  }
  
  // Leave a game
  function leaveGame(gameId) {
    room.send("leave_game", { gameId });
  }
  
  // Listen for state changes
  $(room.state).availableGames.onAdd((game, key) => {
    console.log("Game added:", key, game);
    
    // Listen for changes to this game
    $(game).listen("currentPlayers", (value) => {
      console.log(`Game ${key} now has ${value} players`);
    });
  });
  
  $(room.state).availableGames.onRemove((game, key) => {
    console.log("Game removed:", key);
  });
  
  $(room.state).players.onAdd((player, sessionId) => {
    console.log("Player joined lobby:", sessionId, player.name);
  });
  
  $(room.state).players.onRemove((player, sessionId) => {
    console.log("Player left lobby:", sessionId);
  });
  
  return { room, $, createGame, joinGame, leaveGame };
}
```

### Battle Room

The Battle Room is for real-time combat gameplay.

```typescript
async function joinBattleRoom(options = {}) {
  const { room, $ } = await connectToRoom("battle", {
    username: "Warrior1",
    characterType: "warrior", // warrior, mage, archer, rogue, healer
    ...options
  });
  
  // Listen for game state changes
  room.onMessage("game_started", (message) => {
    console.log("Battle started!", message);
  });
  
  room.onMessage("game_ended", (message) => {
    console.log("Battle ended!", message);
    console.log("Winner:", message.winnerId);
    console.log("Player stats:", message.playerStats);
  });
  
  room.onMessage("player_joined", (message) => {
    console.log("Player joined:", message);
  });
  
  room.onMessage("player_left", (message) => {
    console.log("Player left:", message.id);
  });
  
  room.onMessage("player_died", (message) => {
    console.log("Player died:", message.playerId, "killed by:", message.killerId);
  });
  
  room.onMessage("ability_used", (message) => {
    console.log("Ability used:", message);
  });
  
  room.onMessage("character_changed", (message) => {
    console.log("Character changed:", message);
  });
  
  // Player actions
  function move(x, y, speed) {
    room.send("move", { x, y, speed });
  }
  
  function shoot(angle, type = "default") {
    room.send("shoot", { angle, type });
  }
  
  function useAbility(abilityId, targetPosition = null) {
    room.send("use_ability", { abilityId, targetPosition });
  }
  
  function changeCharacter(characterType) {
    room.send("change_character", { characterType });
  }
  
  function setReady(ready = true) {
    room.send("ready", { ready });
  }
  
  // State synchronization
  $(room.state).players.onAdd((player, sessionId) => {
    console.log("Player added to state:", sessionId);
    
    // Track player position changes
    $(player).position.listen("x", (value, previousValue) => {
      console.log(`Player ${sessionId} moved X: ${previousValue} -> ${value}`);
    });
    
    $(player).position.listen("y", (value, previousValue) => {
      console.log(`Player ${sessionId} moved Y: ${previousValue} -> ${value}`);
    });
    
    // Track player health
    $(player).listen("health", (value, previousValue) => {
      console.log(`Player ${sessionId} health: ${previousValue} -> ${value}`);
    });
  });
  
  $(room.state).players.onRemove((player, sessionId) => {
    console.log("Player removed from state:", sessionId);
  });
  
  $(room.state).projectiles.onAdd((projectile, key) => {
    console.log("Projectile added:", key);
  });
  
  $(room.state).projectiles.onRemove((projectile, key) => {
    console.log("Projectile removed:", key);
  });
  
  // Listen for game state changes
  $(room.state).listen("gameStarted", (value) => {
    if (value) console.log("Game has started!");
  });
  
  $(room.state).listen("gameEnded", (value) => {
    if (value) console.log("Game has ended!");
  });
  
  return { room, $, move, shoot, useAbility, changeCharacter, setReady };
}
```

### Race Room

The Race Room is for racing gameplay.

```typescript
async function joinRaceRoom(options = {}) {
  const { room, $ } = await connectToRoom("race", {
    username: "Racer1",
    vehicleType: "default",
    ...options
  });
  
  // Listen for race events
  room.onMessage("countdown_started", (message) => {
    console.log("Race countdown started:", message.countdownTime);
  });
  
  room.onMessage("race_started", (message) => {
    console.log("Race started at:", message.startTime);
  });
  
  room.onMessage("race_ended", (message) => {
    console.log("Race ended:", message);
    console.log("Results:", message.playerResults);
  });
  
  room.onMessage("player_joined", (message) => {
    console.log("Player joined race:", message);
  });
  
  room.onMessage("player_left", (message) => {
    console.log("Player left race:", message.id);
  });
  
  room.onMessage("player_finished", (message) => {
    console.log("Player finished race:", message);
  });
  
  room.onMessage("checkpoint_reached", (message) => {
    console.log("Checkpoint reached:", message);
  });
  
  // Player actions
  function move(acceleration, steering) {
    room.send("move", { acceleration, steering });
  }
  
  function useBoost() {
    room.send("use_boost");
  }
  
  function setReady(ready = true) {
    room.send("ready", { ready });
  }
  
  // State synchronization
  $(room.state).players.onAdd((player, sessionId) => {
    console.log("Player added to race:", sessionId);
    
    // Track player position changes
    $(player).listen("position", (value, previousValue) => {
      console.log(`Player ${sessionId} position: ${previousValue} -> ${value}`);
    });
    
    // Track player speed
    $(player).listen("speed", (value, previousValue) => {
      console.log(`Player ${sessionId} speed: ${previousValue} -> ${value}`);
    });
    
    // Track boost status
    $(player).listen("boostActive", (value) => {
      console.log(`Player ${sessionId} boost active: ${value}`);
    });
    
    // Track checkpoints
    $(player).checkpoints.onAdd((checkpointId) => {
      console.log(`Player ${sessionId} reached checkpoint: ${checkpointId}`);
    });
  });
  
  $(room.state).players.onRemove((player, sessionId) => {
    console.log("Player removed from race:", sessionId);
  });
  
  // Listen for race state changes
  $(room.state).listen("countdownActive", (value) => {
    console.log("Countdown active:", value);
  });
  
  $(room.state).listen("countdownTime", (value) => {
    console.log("Countdown time:", value);
  });
  
  $(room.state).listen("raceStarted", (value) => {
    if (value) console.log("Race has started!");
  });
  
  $(room.state).listen("raceEnded", (value) => {
    if (value) console.log("Race has ended!");
  });
  
  $(room.state).listen("raceTime", (value) => {
    // Update race timer display
  });
  
  return { room, $, move, useBoost, setReady };
}
```

### Platformer Room

The Platformer Room is for 2D platformer gameplay.

```typescript
async function joinPlatformerRoom(options = {}) {
  const { room, $ } = await connectToRoom("platformer", {
    username: "Jumper1",
    characterType: "knight", // knight, mage, rogue
    ...options
  });
  
  // Listen for level data
  room.onMessage("level_data", (message) => {
    console.log("Level data received:", message);
    // Initialize level with platforms, collectibles, and enemies
  });
  
  // Listen for game events
  room.onMessage("game_started", (message) => {
    console.log("Platformer game started:", message);
  });
  
  room.onMessage("game_ended", (message) => {
    console.log("Platformer game ended:", message);
    console.log("Player results:", message.playerResults);
  });
  
  room.onMessage("player_joined", (message) => {
    console.log("Player joined platformer:", message);
  });
  
  room.onMessage("player_left", (message) => {
    console.log("Player left platformer:", message.id);
  });
  
  room.onMessage("player_attack", (message) => {
    console.log("Player attacked:", message);
  });
  
  room.onMessage("player_damaged", (message) => {
    console.log("Player damaged:", message);
  });
  
  room.onMessage("player_died", (message) => {
    console.log("Player died:", message);
  });
  
  room.onMessage("player_respawned", (message) => {
    console.log("Player respawned:", message);
  });
  
  room.onMessage("collectible_collected", (message) => {
    console.log("Collectible collected:", message);
  });
  
  room.onMessage("enemy_damaged", (message) => {
    console.log("Enemy damaged:", message);
  });
  
  room.onMessage("enemy_defeated", (message) => {
    console.log("Enemy defeated:", message);
  });
  
  room.onMessage("ability_used", (message) => {
    console.log("Ability used:", message);
  });
  
  // Player actions
  function move(direction) {
    room.send("move", { direction }); // -1 (left), 0 (none), 1 (right)
  }
  
  function jump() {
    room.send("jump");
  }
  
  function attack() {
    room.send("attack");
  }
  
  function useAbility(targetPosition = null) {
    room.send("use_ability", { targetPosition });
  }
  
  function setReady(ready = true) {
    room.send("ready", { ready });
  }
  
  // State synchronization
  $(room.state).players.onAdd((player, sessionId) => {
    console.log("Player added to platformer:", sessionId);
    
    // Track player position changes
    $(player).position.listen("x", (value, previousValue) => {
      console.log(`Player ${sessionId} moved X: ${previousValue} -> ${value}`);
    });
    
    $(player).position.listen("y", (value, previousValue) => {
      console.log(`Player ${sessionId} moved Y: ${previousValue} -> ${value}`);
    });
    
    // Track player velocity
    $(player).velocity.listen("x", (value) => {
      // Update player horizontal movement animation
    });
    
    $(player).velocity.listen("y", (value) => {
      // Update player vertical movement animation
    });
    
    // Track player state
    $(player).listen("health", (value) => {
      console.log(`Player ${sessionId} health: ${value}`);
    });
    
    $(player).listen("score", (value) => {
      console.log(`Player ${sessionId} score: ${value}`);
    });
    
    $(player).listen("attacking", (value) => {
      if (value) {
        // Play attack animation
      }
    });
    
    $(player).listen("usingAbility", (value) => {
      if (value) {
        // Play ability animation
      }
    });
    
    $(player).listen("canJump", (value) => {
      // Update jump availability UI
    });
  });
  
  $(room.state).players.onRemove((player, sessionId) => {
    console.log("Player removed from platformer:", sessionId);
  });
  
  // Track platforms, collectibles, and enemies
  $(room.state).platforms.onAdd((platform, index) => {
    console.log("Platform added:", platform);
    // Create platform in game world
  });
  
  $(room.state).collectibles.onAdd((collectible, index) => {
    console.log("Collectible added:", collectible);
    // Create collectible in game world
  });
  
  $(room.state).collectibles.onRemove((collectible, index) => {
    console.log("Collectible removed:", index);
    // Remove collectible from game world
  });
  
  $(room.state).enemies.onAdd((enemy, index) => {
    console.log("Enemy added:", enemy);
    // Create enemy in game world
    
    $(enemy).position.listen("x", (value) => {
      // Update enemy position
    });
    
    $(enemy).position.listen("y", (value) => {
      // Update enemy position
    });
    
    $(enemy).listen("health", (value) => {
      // Update enemy health display
    });
    
    $(enemy).listen("stunned", (value) => {
      if (value) {
        // Show stunned animation
      }
    });
  });
  
  $(room.state).enemies.onRemove((enemy, index) => {
    console.log("Enemy removed:", index);
    // Remove enemy from game world
  });
  
  return { room, $, move, jump, attack, useAbility, setReady };
}
```

## Schema Synchronization

Colyseus v0.16 introduces a new way to handle schema callbacks using the `$()` proxy. Here's how to work with it:

```typescript
import { getStateCallbacks } from "colyseus.js";

function setupSchemaCallbacks(room) {
  const $ = getStateCallbacks(room);
  
  // Listen for top-level state changes
  $(room.state).listen("gameStarted", (value) => {
    console.log("Game started:", value);
  });
  
  // Listen for map additions
  $(room.state).players.onAdd((player, sessionId) => {
    console.log("Player added:", sessionId);
    
    // Listen for nested property changes
    $(player).position.listen("x", (value, previousValue) => {
      console.log(`Position X changed: ${previousValue} -> ${value}`);
    });
    
    $(player).position.listen("y", (value, previousValue) => {
      console.log(`Position Y changed: ${previousValue} -> ${value}`);
    });
    
    // Listen for direct property changes
    $(player).listen("health", (value, previousValue) => {
      console.log(`Health changed: ${previousValue} -> ${value}`);
    });
  });
  
  // Listen for map removals
  $(room.state).players.onRemove((player, sessionId) => {
    console.log("Player removed:", sessionId);
  });
  
  // Listen for array additions
  $(room.state).platforms.onAdd((platform, index) => {
    console.log("Platform added at index:", index);
  });
  
  // Listen for array removals
  $(room.state).platforms.onRemove((platform, index) => {
    console.log("Platform removed at index:", index);
  });
  
  // Listen for array changes
  $(room.state).platforms.onChange((platform, index) => {
    console.log("Platform changed at index:", index);
  });
  
  return $;
}
```

## Handling Game Events

```typescript
function setupGameEventHandlers(room) {
  // Generic message handler
  room.onMessage("*", (type, message) => {
    console.log(`Received message of type: ${type}`, message);
  });
  
  // Specific message handlers
  room.onMessage("game_started", (message) => {
    // Handle game start
  });
  
  room.onMessage("game_ended", (message) => {
    // Handle game end
  });
  
  // Error handling
  room.onError((code, message) => {
    console.error(`Room error (${code}):`, message);
  });
  
  // Disconnection handling
  room.onLeave((code) => {
    console.log(`Left room with code: ${code}`);
  });
}
```

## Working with Abilities

The server includes an AbilityManager that handles different character abilities. Here's how to work with it on the client side:

```typescript
// Character ability mappings
const characterAbilities = {
  warrior: ["charge", "shockwave", "berserk"],
  mage: ["fireball", "teleport", "frostNova"],
  archer: ["multishot", "trap", "rapidFire"],
  rogue: ["stealth", "smokeBomb", "backstab"],
  healer: ["heal", "shield", "revive"]
};

// Ability cooldown tracking
class ClientAbilityManager {
  constructor(room, $) {
    this.room = room;
    this.$ = $;
    this.cooldowns = {};
    this.abilityIcons = {}; // Map ability IDs to UI elements
  }
  
  setupAbilityTracking(playerId) {
    const player = this.room.state.players.get(playerId);
    if (!player) return;
    
    // Track ability cooldowns
    $(player).abilityCooldowns.onAdd((cooldown, abilityId) => {
      this.cooldowns[abilityId] = cooldown;
      this.updateAbilityUI(abilityId, cooldown);
    });
    
    $(player).abilityCooldowns.onChange((cooldown, abilityId) => {
      this.cooldowns[abilityId] = cooldown;
      this.updateAbilityUI(abilityId, cooldown);
    });
    
    $(player).abilityCooldowns.onRemove((cooldown, abilityId) => {
      delete this.cooldowns[abilityId];
      this.updateAbilityUI(abilityId, 0);
    });
  }
  
  useAbility(abilityId, targetPosition = null) {
    // Check local cooldown first to avoid unnecessary server requests
    if (this.cooldowns[abilityId] > 0) {
      console.log(`Ability ${abilityId} is on cooldown: ${this.cooldowns[abilityId]}ms remaining`);
      return false;
    }
    
    // Send ability use request to server
    this.room.send("use_ability", { abilityId, targetPosition });
    return true;
  }
  
  updateAbilityUI(abilityId, cooldown) {
    // Update UI to show cooldown
    const icon = this.abilityIcons[abilityId];
    if (icon) {
      if (cooldown > 0) {
        // Show cooldown overlay
        icon.showCooldown(cooldown);
      } else {
        // Show ability as available
        icon.hideCooldown();
      }
    }
  }
  
  registerAbilityIcon(abilityId, iconElement) {
    this.abilityIcons[abilityId] = iconElement;
  }
}
```

## Client-Side Prediction

For smoother gameplay, implement client-side prediction:

```typescript
class ClientPrediction {
  constructor(room, $) {
    this.room = room;
    this.$ = $;
    this.localPlayer = null;
    this.serverPosition = { x: 0, y: 0 };
    this.predictedPosition = { x: 0, y: 0 };
    this.lastInput = { x: 0, y: 0, speed: 0 };
    this.lastInputTime = 0;
    this.reconciliationThreshold = 10; // pixels
  }
  
  initialize(playerId) {
    this.localPlayer = this.room.state.players.get(playerId);
    if (!this.localPlayer) return;
    
    // Track server position
    $(this.localPlayer).position.listen("x", (value) => {
      this.serverPosition.x = value;
      this.reconcile();
    });
    
    $(this.localPlayer).position.listen("y", (value) => {
      this.serverPosition.y = value;
      this.reconcile();
    });
    
    // Initialize predicted position
    this.predictedPosition.x = this.localPlayer.position.x;
    this.predictedPosition.y = this.localPlayer.position.y;
  }
  
  move(x, y, speed) {
    // Send input to server
    this.room.send("move", { x, y, speed });
    
    // Store input for prediction
    this.lastInput = { x, y, speed };
    this.lastInputTime = Date.now();
    
    // Apply prediction immediately
    this.applyPrediction();
  }
  
  applyPrediction() {
    // Simple prediction based on last input
    const now = Date.now();
    const dt = (now - this.lastInputTime) / 1000;
    
    this.predictedPosition.x += this.lastInput.x * this.lastInput.speed * dt;
    this.predictedPosition.y += this.lastInput.y * this.lastInput.speed * dt;
    
    // Update last input time
    this.lastInputTime = now;
    
    return this.predictedPosition;
  }
  
  reconcile() {
    // Check if server and predicted positions are too far apart
    const dx = this.serverPosition.x - this.predictedPosition.x;
    const dy = this.serverPosition.y - this.predictedPosition.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > this.reconciliationThreshold) {
      // Snap to server position if too far
      this.predictedPosition.x = this.serverPosition.x;
      this.predictedPosition.y = this.serverPosition.y;
    } else if (distance > 0) {
      // Lerp towards server position
      this.predictedPosition.x += dx * 0.2;
      this.predictedPosition.y += dy * 0.2;
    }
    
    return this.predictedPosition;
  }
  
  getPosition() {
    return this.predictedPosition;
  }
}
```

## Best Practices

### Optimizing Network Traffic

```typescript
// Only send movement updates when they change
let lastMovement = { x: 0, y: 0, speed: 0 };

function optimizedMove(room, x, y, speed) {
  // Only send if movement has changed
  if (
    x !== lastMovement.x ||
    y !== lastMovement.y ||
    speed !== lastMovement.speed
  ) {
    room.send("move", { x, y, speed });
    lastMovement = { x, y, speed };
  }
}
```

### Handling Reconnection

```typescript
async function handleReconnection(client, roomId, roomType, options) {
  try {
    // Try to reconnect to the same room
    const room = await client.reconnect(roomId);
    console.log("Successfully reconnected to room:", roomId);
    return room;
  } catch (error) {
    console.error("Failed to reconnect:", error);
    
    // If reconnection fails, join a new room
    try {
      const newRoom = await client.joinOrCreate(roomType, options);
      console.log("Joined new room:", newRoom.id);
      return newRoom;
    } catch (joinError) {
      console.error("Failed to join new room:", joinError);
      throw joinError;
    }
  }
}
```

### Debugging

```typescript
function enableDebugMode(room, $) {
  // Log all state changes
  $(room.state).listen("*", (prop, value) => {
    console.log(`[DEBUG] State property changed: ${prop} =`, value);
  });
  
  // Log all messages
  const originalOnMessage = room.onMessage;
  room.onMessage = function(type, callback) {
    if (type === "*") {
      originalOnMessage.call(room, "*", (messageType, message) => {
        console.log(`[DEBUG] Message received: ${messageType} =`, message);
        callback(messageType, message);
      });
    } else {
      originalOnMessage.call(room, type, (message) => {
        console.log(`[DEBUG] Message received: ${type} =`, message);
        callback(message);
      });
    }
  };
  
  return {
    disableDebug: () => {
      room.onMessage = originalOnMessage;
    }
  };
}
```

## Troubleshooting

### Common Issues and Solutions

1. **Connection Issues**


```typescript
function diagnoseConnectionIssues(client) {
  // Check if WebSocket is supported
  if (!window.WebSocket) {
    console.error("WebSocket is not supported in this browser");
    return false;
  }
  
  // Test connection
  client.pingService()
    .then(pong => {
      console.log("Server is reachable, ping:", pong.ping);
    })
    .catch(error => {
      console.error("Server is unreachable:", error);
    });
  
  return true;
}
```

2. **State Synchronization Issues**


```typescript
function validateStateSync(room) {
  // Check if state exists
  if (!room.state) {
    console.error("Room state is undefined");
    return false;
  }
  
  // Check if expected collections exist
  const expectedCollections = ["players", "projectiles"];
  for (const collection of expectedCollections) {
    if (!room.state[collection]) {
      console.error(`Expected collection '${collection}' is missing from state`);
      return false;
    }
  }
  
  return true;
}
```

3. **Message Handling Issues**


```typescript
function setupMessageLogging(room) {
  // Track sent messages
  const originalSend = room.send;
  room.send = function(type, message) {
    console.log(`[SENT] ${type}:`, message);
    return originalSend.call(room, type, message);
  };
  
  // Track received messages
  room.onMessage("*", (type, message) => {
    console.log(`[RECEIVED] ${type}:`, message);
  });
}
```

## Complete Example: Integrating with a Game Engine

Here's an example of integrating with a game engine like Phaser:

```typescript
import { Client, getStateCallbacks } from "colyseus.js";
import Phaser from "phaser";

class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: "GameScene" });
    this.client = new Client("ws://your-server-address:2567");
    this.room = null;
    this.$ = null;
    this.players = {};
    this.projectiles = {};
    this.platforms = [];
    this.collectibles = [];
    this.enemies = [];
    this.localPlayerId = null;
  }
  
  preload() {
    // Load assets
    this.load.image("player", "assets/player.png");
    this.load.image("projectile", "assets/projectile.png");
    this.load.image("platform", "assets/platform.png");
    this.load.image("collectible", "assets/collectible.png");
    this.load.image("enemy", "assets/enemy.png");
  }
  
  async create() {
    // Connect to room
    try {
      this.room = await this.client.joinOrCreate("platformer", {
        username: "Player" + Math.floor(Math.random() * 1000),
        characterType: "knight"
      });
      
      this.$ = getStateCallbacks(this.room);
      this.localPlayerId = this.room.sessionId;
      
      // Set up message handlers
      this.setupMessageHandlers();
      
      // Set up state synchronization
      this.setupStateSynchronization();
      
      // Set up input handlers
      this.setupInputHandlers();
      
      console.log("Connected to room:", this.room.id);
    } catch (error) {
      console.error("Failed to join room:", error);
    }
  }
  
  setupMessageHandlers() {
    this.room.onMessage("level_data", (message) => {
      // Create level from received data
      this.createLevel(message);
    });
    
    this.room.onMessage("game_started", () => {
      // Start game UI and animations
    });
    
    this.room.onMessage("game_ended", (message) => {
      // Show game over screen with results
    });
    
    // More message handlers...
  }
  
  setupStateSynchronization() {
    // Track players
    $(this.room.state).players.onAdd((player, sessionId) => {
      // Create player sprite
      this.players[sessionId] = this.createPlayerSprite(player, sessionId);
      
      // Listen for position changes
      $(player).position.listen("x", (value) => {
        if (this.players[sessionId]) {
          this.players[sessionId].x = value;
        }
      });
      
      $(player).position.listen("y", (value) => {
        if (this.players[sessionId]) {
          this.players[sessionId].y = value;
        }
      });
      
      // More property listeners...
    });
    
    $(this.room.state).players.onRemove((player, sessionId) => {
      // Remove player sprite
      if (this.players[sessionId]) {
        this.players[sessionId].destroy();
        delete this.players[sessionId];
      }
    });
    
    // Track platforms, collectibles, enemies...
  }
  
  createPlayerSprite(player, sessionId) {
    const sprite = this.add.sprite(player.position.x, player.position.y, "player");
    
    // Set sprite properties based on character type
    switch (player.characterType) {
      case "knight":
        sprite.setTint(0xFF0000);
        break;
      case "mage":
        sprite.setTint(0x0000FF);
        break;
      case "rogue":
        sprite.setTint(0x00FF00);
        break;
    }
    
    // Add name label
    const nameText = this.add.text(0, -40, player.name, {
      fontSize: "16px",
      fill: "#FFFFFF"
    });
    nameText.setOrigin(0.5);
    
    // Create container with sprite and text
    const container = this.add.container(player.position.x, player.position.y, [sprite, nameText]);
    
    // Highlight local player
    if (sessionId === this.localPlayerId) {
      const highlight = this.add.circle(0, 0, 30, 0xFFFF00, 0.3);
      container.add(highlight);
    }
    
    return container;
  }
  
  setupInputHandlers() {
    // Set up keyboard controls
    this.cursors = this.input.keyboard.createCursorKeys();
    
    // Jump key
    this.input.keyboard.on("keydown-SPACE", () => {
      this.room.send("jump");
    });
    
    // Attack key
    this.input.keyboard.on("keydown-Z", () => {
      this.room.send("attack");
    });
    
    // Ability key
    this.input.keyboard.on("keydown-X", () => {
      // Get mouse position for targeted abilities
      const worldPoint = this.input.activePointer.positionToCamera(this.cameras.main);
      this.room.send("use_ability", { targetPosition: { x: worldPoint.x, y: worldPoint.y } });
    });
  }
  
  update() {
    // Handle movement input
    if (this.room && this.cursors) {
      let direction = 0;
      
      if (this.cursors.left.isDown) {
        direction = -1;
      } else if (this.cursors.right.isDown) {
        direction = 1;
      }
      
      // Only send if direction changed
      if (this.lastDirection !== direction) {
        this.room.send("move", { direction });
        this.lastDirection = direction;
      }
    }
  }
  
  createLevel(levelData) {
    // Create platforms
    levelData.platforms.forEach(platformData => {
      const platform = this.add.sprite(
        platformData.x,
        platformData.y,
        "platform"
      );
      platform.displayWidth = platformData.width;
      platform.displayHeight = platformData.height;
      this.platforms.push(platform);
    });
    
    // Create collectibles
    levelData.collectibles.forEach(collectibleData => {
      const collectible = this.add.sprite(
        collectibleData.x,
        collectibleData.y,
        "collectible"
      );
      
      // Set appearance based on type
      if (collectibleData.type === "gem") {
        collectible.setTint(0x00FFFF);
      } else {
        collectible.setTint(0xFFFF00);
      }
      
      this.collectibles.push({
        sprite: collectible,
        id: collectibleData.id
      });
    });
    
    // Create enemies
    levelData.enemies.forEach(enemyData => {
      const enemy = this.add.sprite(
        enemyData.x,
        enemyData.y,
        "enemy"
      );
      
      // Set appearance based on type
      if (enemyData.type === "flying") {
        enemy.setTint(0xFF00FF);
      } else {
        enemy.setTint(0xFF0000);
      }
      
      this.enemies.push({
        sprite: enemy,
        id: enemyData.id
      });
    });
  }
}
```

## Conclusion

This guide covers the essential aspects of implementing a client for our Colyseus v0.16 game server. By following these patterns and examples, you can create robust client applications that interact seamlessly with the server.

Remember to:

1. Use the new `$()` proxy for state callbacks
2. Implement client-side prediction for smoother gameplay
3. Handle reconnection scenarios
4. Optimize network traffic by only sending necessary updates
5. Add proper error handling and debugging tools


For more information, refer to the [official Colyseus documentation](https://docs.colyseus.io/).
