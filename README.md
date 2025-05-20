## Connecting to the Server

Create a client connection manager:

```typescript
// client/src/services/ColyseusClient.ts
import { Client, Room } from "colyseus.js";

export class ColyseusClient {
  private static instance: ColyseusClient;
  private client: Client;
  
  private constructor(endpoint: string) {
    this.client = new Client(endpoint);
  }
  
  public static getInstance(endpoint: string = "ws://localhost:2567"): ColyseusClient {
    if (!ColyseusClient.instance) {
      ColyseusClient.instance = new ColyseusClient(endpoint);
    }
    return ColyseusClient.instance;
  }
  
  public getClient(): Client {
    return this.client;
  }
  
  public async joinOrCreate<T>(roomName: string, options: any = {}): Promise<Room<T>> {
    try {
      return await this.client.joinOrCreate<T>(roomName, options);
    } catch (error) {
      console.error(`Error joining/creating room ${roomName}:`, error);
      throw error;
    }
  }
  
  public async join<T>(roomId: string, options: any = {}): Promise<Room<T>> {
    try {
      return await this.client.join<T>(roomId, options);
    } catch (error) {
      console.error(`Error joining room ${roomId}:`, error);
      throw error;
    }
  }
}

// Usage
const colyseusClient = ColyseusClient.getInstance();
```

## Lobby System Implementation

### Joining the Lobby

```typescript
// client/src/services/LobbyService.ts
import { Room } from "colyseus.js";
import { ColyseusClient } from "./ColyseusClient";

export interface LobbyState {
  players: Map<string, Player>;
  availableGames: Map<string, GameListing>;
}

export interface Player {
  id: string;
  name: string;
}

export interface GameListing {
  id: string;
  type: string;
  name: string;
  maxPlayers: number;
  currentPlayers: number;
  creatorId: string;
  createdAt: number;
  locked: boolean;
  playerIds: Map<string, string>;
}

export class LobbyService {
  private room: Room<LobbyState> | null = null;
  private username: string = "";
  
  constructor(private colyseusClient: ColyseusClient) {}
  
  public async joinLobby(username: string): Promise<Room<LobbyState>> {
    this.username = username;
    
    try {
      this.room = await this.colyseusClient.joinOrCreate<LobbyState>("lobby", { username });
      this.setupLobbyListeners();
      return this.room;
    } catch (error) {
      console.error("Error joining lobby:", error);
      throw error;
    }
  }
  
  private setupLobbyListeners() {
    if (!this.room) return;
    
    // Listen for state changes
    this.room.onStateChange((state) => {
      console.log("Lobby state updated:", state);
    });
    
    // Listen for specific messages
    this.room.onMessage("lobby_state", (message) => {
      console.log("Received initial lobby state:", message);
    });
    
    this.room.onMessage("game_created", (message) => {
      console.log("New game created:", message);
    });
    
    this.room.onMessage("player_left_game", (message) => {
      console.log("Player left game:", message);
    });
    
    this.room.onMessage("active_lobbies", (message) => {
      console.log("Received active lobbies:", message);
    });
    
    // Handle errors and disconnections
    this.room.onError((code, message) => {
      console.error(`Lobby room error (${code}):`, message);
    });
    
    this.room.onLeave((code) => {
      console.log(`Left lobby room (code: ${code})`);
      this.room = null;
    });
  }
  
  public getLobbyRoom(): Room<LobbyState> | null {
    return this.room;
  }
}
```

### Creating Games

```typescript
// client/src/services/LobbyService.ts (continued)
export class LobbyService {
  // ... previous code
  
  public createGame(gameType: string, gameName: string, maxPlayers: number): void {
    if (!this.room) {
      throw new Error("Not connected to lobby");
    }
    
    this.room.send("create_game", {
      gameType,
      gameName,
      maxPlayers
    });
  }
}

// Usage example
const colyseusClient = ColyseusClient.getInstance();
const lobbyService = new LobbyService(colyseusClient);

// Join the lobby
await lobbyService.joinLobby("PlayerName");

// Create a new battle game
lobbyService.createGame("battle", "My Battle Game", 8);
```

### Listing Active Lobbies

```typescript
// client/src/services/LobbyService.ts (continued)
export class LobbyService {
  // ... previous code
  
  private activeLobbies: GameListing[] = [];
  private onActiveLobbiesUpdate: ((lobbies: GameListing[]) => void) | null = null;
  
  public requestActiveLobbies(gameType?: string): void {
    if (!this.room) {
      throw new Error("Not connected to lobby");
    }
    
    this.room.send("get_active_lobbies", { gameType });
  }
  
  public setActiveLobbiesListener(callback: (lobbies: GameListing[]) => void): void {
    this.onActiveLobbiesUpdate = callback;
    
    if (this.room) {
      this.room.onMessage("active_lobbies", (message) => {
        this.activeLobbies = message.lobbies;
        if (this.onActiveLobbiesUpdate) {
          this.onActiveLobbiesUpdate(this.activeLobbies);
        }
      });
    }
  }
  
  public getActiveLobbies(): GameListing[] {
    return this.activeLobbies;
  }
}

// Usage example
lobbyService.setActiveLobbiesListener((lobbies) => {
  console.log("Updated active lobbies:", lobbies);
  // Update UI with the list of lobbies
});

// Request all active lobbies
lobbyService.requestActiveLobbies();

// Request only battle game lobbies
lobbyService.requestActiveLobbies("battle");
```

### Joining Games

```typescript
// client/src/services/LobbyService.ts (continued)
export class LobbyService {
  // ... previous code
  
  public joinGame(gameId: string, gameType: string): void {
    if (!this.room) {
      throw new Error("Not connected to lobby");
    }
    
    this.room.send("join_game", { gameId, gameType });
  }
  
  public leaveGame(gameId: string): void {
    if (!this.room) {
      throw new Error("Not connected to lobby");
    }
    
    this.room.send("leave_game", { gameId });
  }
}
```

## Battle Game Implementation

### Three.js Integration

First, set up a basic Three.js scene:

```typescript
// client/src/game/BattleScene.ts
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

export class BattleScene {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private clock: THREE.Clock;
  
  private players: Map<string, THREE.Object3D> = new Map();
  private projectiles: Map<string, THREE.Object3D> = new Map();
  private mapObjects: Map<string, THREE.Object3D> = new Map();
  
  constructor(private container: HTMLElement) {
    // Initialize Three.js scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb); // Sky blue
    
    // Setup camera
    this.camera = new THREE.PerspectiveCamera(
      75, 
      container.clientWidth / container.clientHeight, 
      0.1, 
      1000
    );
    this.camera.position.set(0, 10, 20);
    
    // Setup renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    container.appendChild(this.renderer.domElement);
    
    // Setup controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    
    // Setup lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 50, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    this.scene.add(directionalLight);
    
    // Setup clock for animations
    this.clock = new THREE.Clock();
    
    // Handle window resize
    window.addEventListener('resize', this.onWindowResize.bind(this));
    
    // Start animation loop
    this.animate();
  }
  
  private onWindowResize(): void {
    this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
  }
  
  private animate(): void {
    requestAnimationFrame(this.animate.bind(this));
    
    const delta = this.clock.getDelta();
    
    // Update controls
    this.controls.update();
    
    // Render scene
    this.renderer.render(this.scene, this.camera);
  }
  
  // Methods to add/update/remove game objects will be added here
}
```

### Connecting to the Battle Room

```typescript
// client/src/services/BattleService.ts
import { Room } from "colyseus.js";
import { ColyseusClient } from "./ColyseusClient";
import { BattleScene } from "../game/BattleScene";

export interface BattleState {
  players: Map<string, Player>;
  projectiles: Map<string, Projectile>;
  mapObjects: any[];
  mapWidth: number;
  mapLength: number;
  mapHeight: number;
  gravity: number;
  gameStarted: boolean;
  gameEnded: boolean;
  gameTime: number;
  gameMode: string;
  timeOfDay: string;
  weather: string;
}

export interface Player {
  id: string;
  name: string;
  characterType: string;
  modelType: string;
  position: { x: number, y: number, z: number };
  rotation: { x: number, y: number, z: number, w: number };
  velocity: { x: number, y: number, z: number };
  moveDirection: { x: number, y: number, z: number };
  health: number;
  maxHealth: number;
  isGrounded: boolean;
  animationState: string;
  abilities: string[];
}

export interface Projectile {
  id: string;
  ownerId: string;
  type: string;
  position: { x: number, y: number, z: number };
  velocity: { x: number, y: number, z: number };
  rotation: { x: number, y: number, z: number, w: number };
  damage: number;
  radius: number;
  lifetime: number;
  effectType: string;
}

export class BattleService {
  private room: Room<BattleState> | null = null;
  private playerId: string = "";
  private battleScene: BattleScene | null = null;
  
  constructor(private colyseusClient: ColyseusClient) {}
  
  public async joinBattleRoom(
    gameId: string, 
    options: { 
      username: string, 
      characterType: string,
      modelType?: string
    }
  ): Promise<Room<BattleState>> {
    try {
      this.room = await this.colyseusClient.join<BattleState>("battle", {
        ...options,
        gameId
      });
      
      this.playerId = this.room.sessionId;
      this.setupBattleRoomListeners();
      return this.room;
    } catch (error) {
      console.error("Error joining battle room:", error);
      throw error;
    }
  }
  
  public setBattleScene(scene: BattleScene): void {
    this.battleScene = scene;
  }
  
  private setupBattleRoomListeners(): void {
    if (!this.room) return;
    
    // Listen for state changes
    this.room.onStateChange((state) => {
      this.updateGameState(state);
    });
    
    // Listen for specific messages
    this.room.onMessage("player_joined", (message) => {
      console.log("Player joined:", message);
      // Add new player to the scene
    });
    
    this.room.onMessage("player_left", (message) => {
      console.log("Player left:", message);
      // Remove player from the scene
    });
    
    this.room.onMessage("game_started", (message) => {
      console.log("Game started:", message);
      // Initialize game with received settings
    });
    
    this.room.onMessage("projectile_hit", (message) => {
      console.log("Projectile hit:", message);
      // Show hit effect
    });
    
    this.room.onMessage("player_died", (message) => {
      console.log("Player died:", message);
      // Show death animation
    });
    
    this.room.onMessage("player_respawned", (message) => {
      console.log("Player respawned:", message);
      // Show respawn effect
    });
    
    this.room.onMessage("ability_used", (message) => {
      console.log("Ability used:", message);
      // Show ability effect
    });
    
    // Handle errors and disconnections
    this.room.onError((code, message) => {
      console.error(`Battle room error (${code}):`, message);
    });
    
    this.room.onLeave((code) => {
      console.log(`Left battle room (code: ${code})`);
      this.room = null;
    });
  }
  
  private updateGameState(state: BattleState): void {
    // Update game state in the Three.js scene
    if (!this.battleScene) return;
    
    // Update will be implemented in the BattleScene class
  }
  
  public getBattleRoom(): Room<BattleState> | null {
    return this.room;
  }
  
  public getPlayerId(): string {
    return this.playerId;
  }
}
```

### Player Movement

Extend the BattleScene class to handle player movement:

```typescript
// client/src/game/BattleScene.ts (continued)
import { BattleService, BattleState, Player, Projectile } from "../services/BattleService";

export class BattleScene {
  // ... previous code
  
  private battleService: BattleService | null = null;
  private localPlayerId: string = "";
  private playerModels: Map<string, THREE.Group> = new Map();
  private inputDirection = { x: 0, y: 0, z: 0 };
  private keysPressed: { [key: string]: boolean } = {};
  
  public setBattleService(service: BattleService): void {
    this.battleService = service;
    this.localPlayerId = service.getPlayerId();
    
    // Setup input handlers
    document.addEventListener('keydown', this.onKeyDown.bind(this));
    document.addEventListener('keyup', this.onKeyUp.bind(this));
    
    // Setup mouse controls for camera and aiming
    this.container.addEventListener('mousedown', this.onMouseDown.bind(this));
    this.container.addEventListener('mouseup', this.onMouseUp.bind(this));
    this.container.addEventListener('mousemove', this.onMouseMove.bind(this));
  }
  
  private onKeyDown(event: KeyboardEvent): void {
    this.keysPressed[event.code] = true;
    
    // Handle jump
    if (event.code === 'Space' && this.battleService) {
      const room = this.battleService.getBattleRoom();
      if (room) {
        room.send("jump");
      }
    }
    
    this.updateMovementDirection();
  }
  
  private onKeyUp(event: KeyboardEvent): void {
    this.keysPressed[event.code] = false;
    this.updateMovementDirection();
  }
  
  private updateMovementDirection(): void {
    // Reset direction
    this.inputDirection.x = 0;
    this.inputDirection.z = 0;
    
    // Update based on keys pressed
    if (this.keysPressed['KeyW']) this.inputDirection.z = -1;
    if (this.keysPressed['KeyS']) this.inputDirection.z = 1;
    if (this.keysPressed['KeyA']) this.inputDirection.x = -1;
    if (this.keysPressed['KeyD']) this.inputDirection.x = 1;
    
    // Normalize if moving diagonally
    if (this.inputDirection.x !== 0 && this.inputDirection.z !== 0) {
      const length = Math.sqrt(this.inputDirection.x * this.inputDirection.x + this.inputDirection.z * this.inputDirection.z);
      this.inputDirection.x /= length;
      this.inputDirection.z /= length;
    }
    
    // Send movement to server
    if (this.battleService) {
      const room = this.battleService.getBattleRoom();
      if (room) {
        room.send("move", {
          x: this.inputDirection.x,
          y: this.inputDirection.y,
          z: this.inputDirection.z,
          rotation: this.getPlayerRotation()
        });
      }
    }
  }
  
  private getPlayerRotation(): { x: number, y: number, z: number, w: number } {
    // Get rotation from camera or player model
    // This is a simplified example
    const rotation = { x: 0, y: 0, z: 0, w: 1 };
    
    // In a real implementation, you would convert the camera or model's quaternion
    if (this.playerModels.has(this.localPlayerId)) {
      const playerModel = this.playerModels.get(this.localPlayerId);
      if (playerModel) {
        rotation.x = playerModel.quaternion.x;
        rotation.y = playerModel.quaternion.y;
        rotation.z = playerModel.quaternion.z;
        rotation.w = playerModel.quaternion.w;
      }
    }
    
    return rotation;
  }
  
  private onMouseDown(event: MouseEvent): void {
    // Handle shooting
    if (event.button === 0 && this.battleService) { // Left mouse button
      const room = this.battleService.getBattleRoom();
      if (room) {
        const direction = this.getAimDirection();
        room.send("shoot", {
          direction,
          type: "default" // or "fireball", "arrow", etc.
        });
      }
    }
  }
  
  private onMouseUp(event: MouseEvent): void {
    // Handle releasing mouse button if needed
  }
  
  private onMouseMove(event: MouseEvent): void {
    // Update aim direction if needed
  }
  
  private getAimDirection(): { x: number, y: number, z: number } {
    // Calculate aim direction based on camera
    // This is a simplified example
    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyQuaternion(this.camera.quaternion);
    
    return {
      x: direction.x,
      y: direction.y,
      z: direction.z
    };
  }
  
  // Update game state from server
  public updateFromState(state: BattleState): void {
    // Update players
    state.players.forEach((player, id) => {
      this.updateOrCreatePlayer(id, player);
    });
    
    // Remove players that are no longer in the state
    this.playerModels.forEach((model, id) => {
      if (!state.players.has(id)) {
        this.removePlayer(id);
      }
    });
    
    // Update projectiles
    state.projectiles.forEach((projectile, id) => {
      this.updateOrCreateProjectile(id, projectile);
    });
    
    // Remove projectiles that are no longer in the state
    this.projectiles.forEach((projectile, id) => {
      if (!state.projectiles.has(id)) {
        this.removeProjectile(id);
      }
    });
    
    // Update camera to follow local player
    this.updateCameraPosition();
  }
  
  private updateOrCreatePlayer(id: string, player: Player): void {
    if (this.playerModels.has(id)) {
      // Update existing player
      const model = this.playerModels.get(id)!;
      model.position.set(player.position.x, player.position.y, player.position.z);
      model.quaternion.set(player.rotation.x, player.rotation.y, player.rotation.z, player.rotation.w);
      
      // Update animation state if needed
      this.updatePlayerAnimation(model, player.animationState);
    } else {
      // Create new player model
      this.createPlayerModel(id, player);
    }
  }
  
  private createPlayerModel(id: string, player: Player): void {
    // Create a simple player model (in a real game, you'd load a 3D model)
    const group = new THREE.Group();
    
    // Body
    const geometry = new THREE.BoxGeometry(1, 2, 1);
    const material = new THREE.MeshLambertMaterial({ 
      color: id === this.localPlayerId ? 0x00ff00 : 0xff0000 
    });
    const body = new THREE.Mesh(geometry, material);
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);
    
    // Head
    const headGeometry = new THREE.SphereGeometry(0.5, 16, 16);
    const headMaterial = new THREE.MeshLambertMaterial({ color: 0xffa500 });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 1.25;
    head.castShadow = true;
    group.add(head);
    
    // Position the model
    group.position.set(player.position.x, player.position.y, player.position.z);
    group.quaternion.set(player.rotation.x, player.rotation.y, player.rotation.z, player.rotation.w);
    
    // Add to scene and store reference
    this.scene.add(group);
    this.playerModels.set(id, group);
    
    // Add player name label
    this.addPlayerNameLabel(id, player.name, group);
    
    // Add health bar
    this.addHealthBar(id, player.health / player.maxHealth, group);
  }
  
  private addPlayerNameLabel(id: string, name: string, group: THREE.Group): void {
    // Create a canvas for the name label
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return;
    
    canvas.width = 256;
    canvas.height = 64;
    
    context.fillStyle = 'rgba(0, 0, 0, 0.5)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    context.font = '24px Arial';
    context.fillStyle = 'white';
    context.textAlign = 'center';
    context.fillText(name, canvas.width / 2, canvas.height / 2 + 8);
    
    // Create a sprite with the canvas texture
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(material);
    sprite.position.y = 2.5;
    sprite.scale.set(2, 0.5, 1);
    
    group.add(sprite);
  }
  
  private addHealthBar(id: string, healthPercent: number, group: THREE.Group): void {
    // Create a canvas for the health bar
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return;
    
    canvas.width = 100;
    canvas.height = 10;
    
    // Background
    context.fillStyle = 'rgba(0, 0, 0, 0.5)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Health fill
    context.fillStyle = healthPercent > 0.5 ? 'green' : healthPercent > 0.25 ? 'yellow' : 'red';
    context.fillRect(0, 0, canvas.width * healthPercent, canvas.height);
    
    // Create a sprite with the canvas texture
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(material);
    sprite.position.y = 2.2;
    sprite.scale.set(1, 0.1, 1);
    
    group.add(sprite);
  }
  
  private updatePlayerAnimation(model: THREE.Group, animationState: string): void {
    // In a real game, you would update the animation based on the state
    // This is a simplified example
    console.log(`Player animation state: ${animationState}`);
  }
  
  private removePlayer(id: string): void {
    if (this.playerModels.has(id)) {
      const model = this.playerModels.get(id)!;
      this.scene.remove(model);
      this.playerModels.delete(id);
    }
  }
  
  private updateOrCreateProjectile(id: string, projectile: Projectile): void {
    if (this.projectiles.has(id)) {
      // Update existing projectile
      const model = this.projectiles.get(id)!;
      model.position.set(projectile.position.x, projectile.position.y, projectile.position.z);
      model.quaternion.set(projectile.rotation.x, projectile.rotation.y, projectile.rotation.z, projectile.rotation.w);
    } else {
      // Create new projectile
      this.createProjectileModel(id, projectile);
    }
  }
  
  private createProjectileModel(id: string, projectile: Projectile): void {
    // Create a projectile model based on type
    let geometry, material;
    
    switch (projectile.type) {
      case "fireball":
        geometry = new THREE.SphereGeometry(projectile.radius, 16, 16);
        material = new THREE.MeshBasicMaterial({ color: 0xff4500 });
        break;
      case "arrow":
        geometry = new THREE.CylinderGeometry(0.05, 0.05, 1, 8);
        material = new THREE.MeshBasicMaterial({ color: 0x8b4513 });
        break;
      case "laser":
        geometry = new THREE.CylinderGeometry(0.05, 0.05, 1, 8);
        material = new THREE.MeshBasicMaterial({ color: 0x00ffff });
        break;
      default:
        geometry = new THREE.SphereGeometry(projectile.radius, 8, 8);
        material = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    }
    
    const mesh = new THREE.Mesh(geometry, material);
    
    // Add light for some projectiles
    if (projectile.type === "fireball" || projectile.type === "laser") {
      const light = new THREE.PointLight(
        projectile.type === "fireball" ? 0xff4500 : 0x00ffff,
        1,
        10
      );
      mesh.add(light);
    }
    
    // Position and rotate
    mesh.position.set(projectile.position.x, projectile.position.y, projectile.position.z);
    mesh.quaternion.set(projectile.rotation.x, projectile.rotation.y, projectile.rotation.z, projectile.rotation.w);
    
    // Add to scene and store reference
    this.scene.add(mesh);
    this.projectiles.set(id, mesh);
  }
  
  private removeProjectile(id: string): void {
    if (this.projectiles.has(id)) {
      const model = this.projectiles.get(id)!;
      this.scene.remove(model);
      this.projectiles.delete(id);
    }
  }
  
  private updateCameraPosition(): void {
    // Follow the local player with the camera
    if (this.playerModels.has(this.localPlayerId)) {
      const playerModel = this.playerModels.get(this.localPlayerId)!;
      
      // Third-person camera
      const idealOffset = new THREE.Vector3(0, 5, 10);
      idealOffset.applyQuaternion(playerModel.quaternion);
      idealOffset.add(playerModel.position);
      
      const idealLookAt = new THREE.Vector3(0, 0, -1);
      idealLookAt.applyQuaternion(playerModel.quaternion);
      idealLookAt.add(playerModel.position);
      
      // Smoothly move camera to ideal position
      this.camera.position.lerp(idealOffset, 0.1);
      this.controls.target.lerp(playerModel.position, 0.1);
    }
  }
  
  // Update method to be called in animation loop
  public update(delta: number): void {
    // Update any animations or effects
  }
}
```

### Abilities System

```typescript
// client/src/services/BattleService.ts (continued)
export class BattleService {
  // ... previous code
  
  public useAbility(abilityId: string, targetPosition?: { x: number, y: number, z: number }): void {
    if (!this.room) {
      throw new Error("Not connected to battle room");
    }
    
    this.room.send("use_ability", {
      abilityId,
      targetPosition
    });
  }
  
  public setReady(ready: boolean): void {
    if (!this.room) {
      throw new Error("Not connected to battle room");
    }
    
    this.room.send("ready", { ready });
  }
  
  public changeCharacter(characterType: string, modelType?: string): void {
    if (!this.room) {
      throw new Error("Not connected to battle room");
    }
    
    this.room.send("change_character", {
      characterType,
      modelType: modelType || characterType
    });
  }
}

// Usage example
const battleService = new BattleService(colyseusClient);
await battleService.joinBattleRoom("game_id_123", {
  username: "Player1",
  characterType: "warrior"
});

// Use an ability
battleService.useAbility("charge", { x: 10, y: 0, z: 20 });

// Set ready state
battleService.setReady(true);
```

Add UI controls for abilities:

```typescript
// client/src/game/BattleUI.ts
export class BattleUI {
  private abilityButtons: Map<string, HTMLButtonElement> = new Map();
  private healthBar: HTMLElement;
  private gameStatusElement: HTMLElement;
  
  constructor(
    private container: HTMLElement,
    private battleService: BattleService
  ) {
    // Create UI container
    const uiContainer = document.createElement('div');
    uiContainer.className = 'battle-ui';
    uiContainer.style.position = 'absolute';
    uiContainer.style.bottom = '20px';
    uiContainer.style.left = '50%';
    uiContainer.style.transform = 'translateX(-50%)';
    uiContainer.style.display = 'flex';
    uiContainer.style.gap = '10px';
    
    // Create health bar
    this.healthBar = document.createElement('div');
    this.healthBar.className = 'health-bar';
    this.healthBar.style.position = 'absolute';
    this.healthBar.style.top = '20px';
    this.healthBar.style.left = '20px';
    this.healthBar.style.width = '200px';
    this.healthBar.style.height = '20px';
    this.healthBar.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    
    const healthFill = document.createElement('div');
    healthFill.className = 'health-fill';
    healthFill.style.width = '100%';
    healthFill.style.height = '100%';
    healthFill.style.backgroundColor = 'green';
    
    this.healthBar.appendChild(healthFill);
    
    // Create game status element
    this.gameStatusElement = document.createElement('div');
    this.gameStatusElement.className = 'game-status';
    this.gameStatusElement.style.position = 'absolute';
    this.gameStatusElement.style.top = '20px';
    this.gameStatusElement.style.left = '50%';
    this.gameStatusElement.style.transform = 'translateX(-50%)';
    this.gameStatusElement.style.color = 'white';
    this.gameStatusElement.style.fontSize = '24px';
    this.gameStatusElement.style.textShadow = '2px 2px 4px rgba(0, 0, 0, 0.5)';
    
    // Add elements to container
    container.appendChild(uiContainer);
    container.appendChild(this.healthBar);
    container.appendChild(this.gameStatusElement);
    
    // Setup ability buttons
    this.setupAbilityButtons(uiContainer);
    
    // Listen for state changes
    const room = battleService.getBattleRoom();
    if (room) {
      room.onStateChange((state) => {
        this.updateUI(state);
      });
    }
  }
  
  private setupAbilityButtons(container: HTMLElement): void {
    const room = this.battleService.getBattleRoom();
    if (!room || !room.state.players) return;
    
    const player = room.state.players.get(this.battleService.getPlayerId());
    if (!player) return;
    
    // Create buttons for each ability
    player.abilities.forEach((abilityId) => {
      const button = document.createElement('button');
      button.className = 'ability-button';
      button.textContent = this.getAbilityName(abilityId);
      button.style.padding = '10px';
      button.style.backgroundColor = '#4CAF50';
      button.style.border = 'none';
      button.style.borderRadius = '5px';
      button.style.color = 'white';
      button.style.fontSize = '16px';
      button.style.cursor = 'pointer';
      
      button.addEventListener('click', () => {
        this.useAbility(abilityId);
      });
      
      container.appendChild(button);
      this.abilityButtons.set(abilityId, button);
    });
  }
  
  private getAbilityName(abilityId: string): string {
    // Convert ability ID to a readable name
    return abilityId
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  
  private useAbility(abilityId: string): void {
    // Get target position if needed
    let targetPosition;
    
    // For abilities that need a target position, get it from the camera
    if (['fireball', 'teleport', 'multishot'].includes(abilityId)) {
      // This is a simplified example
      // In a real game, you might use raycasting to get a target position
      const direction = new THREE.Vector3(0, 0, -1);
      direction.applyQuaternion(this.battleService.getCamera().quaternion);
      direction.multiplyScalar(20); // 20 units in front of the camera
      
      targetPosition = {
        x: this.battleService.getCamera().position.x + direction.x,
        y: this.battleService.getCamera().position.y + direction.y,
        z: this.battleService.getCamera().position.z + direction.z
      };
    }
    
    // Use the ability
    this.battleService.useAbility(abilityId, targetPosition);
  }
  
  private updateUI(state: BattleState): void {
    const player = state.players.get(this.battleService.getPlayerId());
    if (!player) return;
    
    // Update health bar
    const healthFill = this.healthBar.querySelector('.health-fill') as HTMLElement;
    if (healthFill) {
      const healthPercent = player.health / player.maxHealth;
      healthFill.style.width = `${healthPercent * 100}%`;
      healthFill.style.backgroundColor = healthPercent > 0.5 ? 'green' : healthPercent > 0.25 ? 'yellow' : 'red';
    }
    
    // Update ability cooldowns
    player.abilityCooldowns.forEach((cooldown, abilityId) => {
      const button = this.abilityButtons.get(abilityId);
      if (button) {
        if (cooldown > 0) {
          button.disabled = true;
          button.textContent = `${this.getAbilityName(abilityId)} (${Math.ceil(cooldown / 1000)}s)`;
        } else {
          button.disabled = false;
          button.textContent = this.getAbilityName(abilityId);
        }
      }
    });
    
    // Update game status
    if (state.gameStarted && !state.gameEnded) {
      const minutes = Math.floor(state.gameTime / 60);
      const seconds = Math.floor(state.gameTime % 60);
      this.gameStatusElement.textContent = `Game Time: ${minutes}:${seconds.toString().padStart(2, '0')}`;
    } else if (!state.gameStarted) {
      this.gameStatusElement.textContent = 'Waiting for players...';
    } else if (state.gameEnded) {
      this.gameStatusElement.textContent = 'Game Over';
    }
  }
}
```

## State Synchronization

For efficient state synchronization, implement a state manager:

```typescript
// client/src/game/StateManager.ts
import { Room } from "colyseus.js";
import { BattleState } from "../services/BattleService";
import { BattleScene } from "./BattleScene";

export class StateManager {
  private previousState: BattleState | null = null;
  
  constructor(
    private room: Room<BattleState>,
    private battleScene: BattleScene
  ) {
    // Set up state change listener
    room.onStateChange((state) => {
      this.handleStateChange(state);
    });
  }
  
  private handleStateChange(state: BattleState): void {
    // Update the scene with the new state
    this.battleScene.updateFromState(state);
    
    // Store the state for interpolation
    this.previousState = state;
  }
  
  // Interpolation for smoother movement between updates
  public interpolate(alpha: number): void {
    if (!this.previousState || !this.room.state) return;
    
    // Interpolate player positions
    this.room.state.players.forEach((player, id) => {
      if (this.previousState.players.has(id)) {
        const prevPlayer = this.previousState.players.get(id)!;
        
        // Skip local player to avoid overriding input
        if (id === this.room.sessionId) return;
        
        // Interpolate position
        const interpolatedPosition = {
          x: prevPlayer.position.x + (player.position.x - prevPlayer.position.x) * alpha,
          y: prevPlayer.position.y + (player.position.y - prevPlayer.position.y) * alpha,
          z: prevPlayer.position.z + (player.position.z - prevPlayer.position.z) * alpha
        };
        
        // Update player model position
        this.battleScene.updatePlayerPosition(id, interpolatedPosition);
      }
    });
    
    // Interpolate projectile positions
    this.room.state.projectiles.forEach((projectile, id) => {
      if (this.previousState.projectiles.has(id)) {
        const prevProjectile = this.previousState.projectiles.get(id)!;
        
        // Interpolate position
        const interpolatedPosition = {
          x: prevProjectile.position.x + (projectile.position.x - prevProjectile.position.x) * alpha,
          y: prevProjectile.position.y + (projectile.position.y - prevProjectile.position.y) * alpha,
          z: prevProjectile.position.z + (projectile.position.z - prevProjectile.position.z) * alpha
        };
        
        // Update projectile model position
        this.battleScene.updateProjectilePosition(id, interpolatedPosition);
      }
    });
  }
}
```

Add the necessary methods to BattleScene:

```typescript
// client/src/game/BattleScene.ts (continued)
export class BattleScene {
  // ... previous code
  
  public updatePlayerPosition(id: string, position: { x: number, y: number, z: number }): void {
    if (this.playerModels.has(id)) {
      const model = this.playerModels.get(id)!;
      model.position.set(position.x, position.y, position.z);
    }
  }
  
  public updateProjectilePosition(id: string, position: { x: number, y: number, z: number }): void {
    if (this.projectiles.has(id)) {
      const model = this.projectiles.get(id)!;
      model.position.set(position.x, position.y, position.z);
    }
  }
}
```

## Event Handling

Create an event system for game events:

```typescript
// client/src/game/EventManager.ts
import { Room } from "colyseus.js";
import { BattleState } from "../services/BattleService";
import { BattleScene } from "./BattleScene";

export class EventManager {
  constructor(
    private room: Room<BattleState>,
    private battleScene: BattleScene
  ) {
    this.setupEventListeners();
  }
  
  private setupEventListeners(): void {
    // Player events
    this.room.onMessage("player_joined", (message) => {
      console.log("Player joined:", message);
      // Play join sound or show effect
      this.playSound("join");
    });
    
    this.room.onMessage("player_left", (message) => {
      console.log("Player left:", message);
      // Play leave sound or show effect
      this.playSound("leave");
    });
    
    this.room.onMessage("player_died", (message) => {
      console.log("Player died:", message);
      // Show death effect
      this.battleScene.showDeathEffect(message.position);
      this.playSound("death");
    });
    
    this.room.onMessage("player_respawned", (message) => {
      console.log("Player respawned:", message);
      // Show respawn effect
      this.battleScene.showRespawnEffect(message.position);
      this.playSound("respawn");
    });
    
    // Combat events
    this.room.onMessage("projectile_hit", (message) => {
      console.log("Projectile hit:", message);
      // Show hit effect
      this.battleScene.showHitEffect(message.position);
      this.playSound("hit");
    });
    
    this.room.onMessage("projectile_impact", (message) => {
      console.log("Projectile impact:", message);
      // Show impact effect
      this.battleScene.showImpactEffect(message.position, message.normal);
      this.playSound("impact");
    });
    
    this.room.onMessage("ability_used", (message) => {
      console.log("Ability used:", message);
      // Show ability effect
      this.battleScene.showAbilityEffect(message.playerId, message.abilityId, message.targetPosition);
      this.playSound(message.abilityId);
    });
    
    // Game state events
    this.room.onMessage("game_started", (message) => {
      console.log("Game started:", message);
      // Show game start UI
      this.battleScene.showGameStartUI();
      this.playSound("gameStart");
    });
    
    this.room.onMessage("game_ended", (message) => {
      console.log("Game ended:", message);
      // Show game end UI with results
      this.battleScene.showGameEndUI(message);
      this.playSound("gameEnd");
    });
  }
  
  private playSound(soundId: string): void {
    // Play sound effect
    // This is a simplified example
    console.log(`Playing sound: ${soundId}`);
    
    // In a real implementation, you would use the Web Audio API or a library like Howler.js
    // Example:
    // const sound = new Audio(`/sounds/${soundId}.mp3`);
    // sound.play();
  }
}
```

Add the necessary methods to BattleScene:

```typescript
// client/src/game/BattleScene.ts (continued)
export class BattleScene {
  // ... previous code
  
  public showDeathEffect(position: { x: number, y: number, z: number }): void {
    // Create a particle effect for player death
    const particles = new THREE.Points(
      new THREE.BufferGeometry(),
      new THREE.PointsMaterial({
        color: 0xff0000,
        size: 0.5,
        blending: THREE.AdditiveBlending,
        transparent: true
      })
    );
    
    // Create particles
    const particleCount = 50;
    const positions = new Float32Array(particleCount * 3);
    
    for (let i = 0; i &lt; particleCount; i++) {
      const i3 = i * 3;
      positions[i3] = position.x;
      positions[i3 + 1] = position.y;
      positions[i3 + 2] = position.z;
    }
    
    particles.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    // Add to scene
    this.scene.add(particles);
    
    // Animate particles
    const velocities = [];
    for (let i = 0; i &lt; particleCount; i++) {
      velocities.push({
        x: (Math.random() - 0.5) * 2,
        y: Math.random() * 2,
        z: (Math.random() - 0.5) * 2
      });
    }
    
    // Animation loop
    const animate = () => {
      const positions = particles.geometry.attributes.position.array as Float32Array;
      
      for (let i = 0; i &lt; particleCount; i++) {
        const i3 = i * 3;
        positions[i3] += velocities[i].x * 0.1;
        positions[i3 + 1] += velocities[i].y * 0.1;
        positions[i3 + 2] += velocities[i].z * 0.1;
      }
      
      particles.geometry.attributes.position.needsUpdate = true;
    };
    
    // Add to animation loop
    const animationId = this.addToAnimationLoop(animate);
    
    // Remove after 2 seconds
    setTimeout(() => {
      this.removeFromAnimationLoop(animationId);
      this.scene.remove(particles);
    }, 2000);
  }
  
  public showRespawnEffect(position: { x: number, y: number, z: number }): void {
    // Create a light effect for respawn
    const light = new THREE.PointLight(0x00ffff, 5, 10);
    light.position.set(position.x, position.y, position.z);
    this.scene.add(light);
    
    // Animate light
    let intensity = 5;
    const animate = () => {
      intensity -= 0.1;
      light.intensity = Math.max(0, intensity);
    };
    
    // Add to animation loop
    const animationId = this.addToAnimationLoop(animate);
    
    // Remove after 2 seconds
    setTimeout(() => {
      this.removeFromAnimationLoop(animationId);
      this.scene.remove(light);
    }, 2000);
  }
  
  public showHitEffect(position: { x: number, y: number, z: number }): void {
    // Create a hit effect
    const geometry = new THREE.SphereGeometry(0.5, 16, 16);
    const material = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.8
    });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.set(position.x, position.y, position.z);
    this.scene.add(sphere);
    
    // Animate sphere
    let scale = 1;
    const animate = () => {
      scale += 0.1;
      sphere.scale.set(scale, scale, scale);
      sphere.material.opacity -= 0.05;
    };
    
    // Add to animation loop
    const animationId = this.addToAnimationLoop(animate);
    
    // Remove after 1 second
    setTimeout(() => {
      this.removeFromAnimationLoop(animationId);
      this.scene.remove(sphere);
    }, 1000);
  }
  
  public showImpactEffect(
    position: { x: number, y: number, z: number },
    normal: { x: number, y: number, z: number }
  ): void {
    // Create an impact effect
    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide
    });
    const plane = new THREE.Mesh(geometry, material);
    
    // Position and orient the plane
    plane.position.set(position.x, position.y, position.z);
    
    // Orient plane to face normal direction
    const normalVector = new THREE.Vector3(normal.x, normal.y, normal.z);
    plane.lookAt(
      plane.position.x + normalVector.x,
      plane.position.y + normalVector.y,
      plane.position.z + normalVector.z
    );
    
    // Move slightly away from the surface
    plane.position.x += normalVector.x * 0.01;
    plane.position.y += normalVector.y * 0.01;
    plane.position.z += normalVector.z * 0.01;
    
    this.scene.add(plane);
    
    // Animate plane
    let scale = 1;
    const animate = () => {
      scale += 0.1;
      plane.scale.set(scale, scale, 1);
      plane.material.opacity -= 0.05;
    };
    
    // Add to animation loop
    const animationId = this.addToAnimationLoop(animate);
    
    // Remove after 1 second
    setTimeout(() => {
      this.removeFromAnimationLoop(animationId);
      this.scene.remove(plane);
    }, 1000);
  }
  
  public showAbilityEffect(
    playerId: string,
    abilityId: string,
    targetPosition: { x: number, y: number, z: number } | null
  ): void {
    // Get player position
    if (!this.playerModels.has(playerId)) return;
    const playerModel = this.playerModels.get(playerId)!;
    
    // Create ability effect based on ability type
    switch (abilityId) {
      case "charge":
        this.showChargeEffect(playerModel);
        break;
      case "shockwave":
        this.showShockwaveEffect(playerModel.position);
        break;
      case "fireball":
        if (targetPosition) {
          this.showFireballEffect(playerModel.position, targetPosition);
        }
        break;
      // Add more ability effects as needed
    }
  }
  
  private showChargeEffect(playerModel: THREE.Group): void {
    // Create a trail effect behind the player
    const geometry = new THREE.BufferGeometry();
    const material = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.5
    });
    
    // Create line points
    const points = [];
    for (let i = 0; i &lt; 10; i++) {
      points.push(
        playerModel.position.x - i * 0.2,
        playerModel.position.y,
        playerModel.position.z
      );
    }
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    const line = new THREE.Line(geometry, material);
    this.scene.add(line);
    
    // Animate line
    let opacity = 0.5;
    const animate = () => {
      opacity -= 0.02;
      line.material.opacity = Math.max(0, opacity);
    };
    
    // Add to animation loop
    const animationId = this.addToAnimationLoop(animate);
    
    // Remove after 1 second
    setTimeout(() => {
      this.removeFromAnimationLoop(animationId);
      this.scene.remove(line);
    }, 1000);
  }
  
  private showShockwaveEffect(position: THREE.Vector3): void {
    // Create a ring effect
    const geometry = new THREE.RingGeometry(1, 1.5, 32);
    const material = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(geometry, material);
    
    // Position the ring
    ring.position.set(position.x, position.y + 0.1, position.z);
    ring.rotation.x = Math.PI / 2; // Lay flat
    
    this.scene.add(ring);
    
    // Animate ring
    let radius = 1;
    const animate = () => {
      radius += 0.2;
      ring.geometry.dispose();
      ring.geometry = new THREE.RingGeometry(radius, radius + 0.5, 32);
      ring.material.opacity -= 0.02;
    };
    
    // Add to animation loop
    const animationId = this.addToAnimationLoop(animate);
    
    // Remove after 2 seconds
    setTimeout(() => {
      this.removeFromAnimationLoop(animationId);
      this.scene.remove(ring);
    }, 2000);
  }
  
  private showFireballEffect(
    startPosition: THREE.Vector3,
    targetPosition: { x: number, y: number, z: number }
  ): void {
    // Create a fireball effect
    const geometry = new THREE.SphereGeometry(0.5, 16, 16);
    const material = new THREE.MeshBasicMaterial({
      color: 0xff4500,
      transparent: true,
      opacity: 0.8
    });
    const fireball = new THREE.Mesh(geometry, material);
    
    // Position the fireball
    fireball.position.copy(startPosition);
    
    // Add a light
    const light = new THREE.PointLight(0xff4500, 2, 10);
    fireball.add(light);
    
    this.scene.add(fireball);
    
    // Calculate direction
    const direction = new THREE.Vector3(
      targetPosition.x - startPosition.x,
      targetPosition.y - startPosition.y,
      targetPosition.z - startPosition.z
    ).normalize();
    
    // Animate fireball
    const speed = 0.5;
    const animate = () => {
      fireball.position.x += direction.x * speed;
      fireball.position.y += direction.y * speed;
      fireball.position.z += direction.z * speed;
      
      // Check if reached target
      const distance = new THREE.Vector3(
        targetPosition.x - fireball.position.x,
        targetPosition.y - fireball.position.y,
        targetPosition.z - fireball.position.z
      ).length();
      
      if (distance &lt; 1) {
        // Show explosion effect
        this.showExplosionEffect({
          x: fireball.position.x,
          y: fireball.position.y,
          z: fireball.position.z
        });
        
        // Remove fireball
        this.scene.remove(fireball);
        this.removeFromAnimationLoop(animationId);
      }
    };
    
    // Add to animation loop
    const animationId = this.addToAnimationLoop(animate);
    
    // Remove after 5 seconds (failsafe)
    setTimeout(() => {
      if (this.scene.getObjectById(fireball.id)) {
        this.removeFromAnimationLoop(animationId);
        this.scene.remove(fireball);
      }
    }, 5000);
  }
  
  private showExplosionEffect(position: { x: number, y: number, z: number }): void {
    // Create explosion particles
    const particleCount = 100;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    
    for (let i = 0; i &lt; particleCount; i++) {
      const i3 = i * 3;
      positions[i3] = position.x;
      positions[i3 + 1] = position.y;
      positions[i3 + 2] = position.z;
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const material = new THREE.PointsMaterial({
      color: 0xff4500,
      size: 0.2,
      blending: THREE.AdditiveBlending,
      transparent: true
    });
    
    const particles = new THREE.Points(geometry, material);
    this.scene.add(particles);
    
    // Create velocities for particles
    const velocities = [];
    for (let i = 0; i &lt; particleCount; i++) {
      velocities.push({
        x: (Math.random() - 0.5) * 2,
        y: (Math.random() - 0.5) * 2,
        z: (Math.random() - 0.5) * 2
      });
    }
    
    // Animate particles
    let opacity = 1;
    const animate = () => {
      const positions = particles.geometry.attributes.position.array as Float32Array;
      
      for (let i = 0; i &lt; particleCount; i++) {
        const i3 = i * 3;
        positions[i3] += velocities[i].x * 0.1;
        positions[i3 + 1] += velocities[i].y * 0.1;
        positions[i3 + 2] += velocities[i].z * 0.1;
      }
      
      particles.geometry.attributes.position.needsUpdate = true;
      
      opacity -= 0.02;
      particles.material.opacity = Math.max(0, opacity);
    };
    
    // Add to animation loop
    const animationId = this.addToAnimationLoop(animate);
    
    // Remove after 2 seconds
    setTimeout(() => {
      this.removeFromAnimationLoop(animationId);
      this.scene.remove(particles);
    }, 2000);
  }
  
  public showGameStartUI(): void {
    // Create a game start overlay
    const overlay = document.createElement('div');
    overlay.className = 'game-start-overlay';
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.color = 'white';
    overlay.style.fontSize = '48px';
    overlay.style.fontWeight = 'bold';
    
    // Add countdown
    overlay.textContent = 'Game Starting in 3';
    this.container.appendChild(overlay);
    
    // Countdown animation
    setTimeout(() => {
      overlay.textContent = 'Game Starting in 2';
      setTimeout(() => {
        overlay.textContent = 'Game Starting in 1';
        setTimeout(() => {
          overlay.textContent = 'GO!';
          setTimeout(() => {
            this.container.removeChild(overlay);
          }, 1000);
        }, 1000);
      }, 1000);
    }, 1000);
  }
  
  public showGameEndUI(results: any): void {
    // Create a game end overlay
    const overlay = document.createElement('div');
    overlay.className = 'game-end-overlay';
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.color = 'white';
    
    // Add game over text
    const gameOverText = document.createElement('h1');
    gameOverText.textContent = 'Game Over';
    gameOverText.style.fontSize = '48px';
    gameOverText.style.marginBottom = '20px';
    overlay.appendChild(gameOverText);
    
    // Add winner text if available
    if (results.winnerId) {
      const winnerText = document.createElement('h2');
      const winnerName = results.playerStats.find((p: any) => p.id === results.winnerId)?.name || 'Unknown';
      winnerText.textContent = `Winner: ${winnerName}`;
      winnerText.style.fontSize = '36px';
      winnerText.style.marginBottom = '20px';
      overlay.appendChild(winnerText);
    }
    
    // Add player stats
    const statsContainer = document.createElement('div');
    statsContainer.style.width = '80%';
    statsContainer.style.maxWidth = '600px';
    statsContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    statsContainer.style.padding = '20px';
    statsContainer.style.borderRadius = '10px';
    
    // Add table header
    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.color = 'white';
    
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    
    const headers = ['Player', 'Character', 'Kills'];
    headers.forEach(headerText => {
      const th = document.createElement('th');
      th.textContent = headerText;
      th.style.padding = '10px';
      th.style.textAlign = 'left';
      th.style.borderBottom = '1px solid white';
      headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Add player rows
    const tbody = document.createElement('tbody');
    results.playerStats.forEach((player: any) => {
      const row = document.createElement('tr');
      
      const nameCell = document.createElement('td');
      nameCell.textContent = player.name;
      nameCell.style.padding = '10px';
      
      const characterCell = document.createElement('td');
      characterCell.textContent = player.characterType;
      characterCell.style.padding = '10px';
      
      const killsCell = document.createElement('td');
      killsCell.textContent = player.kills.toString();
      killsCell.style.padding = '10px';
      
      row.appendChild(nameCell);
      row.appendChild(characterCell);
      row.appendChild(killsCell);
      
      tbody.appendChild(row);
    });
    
    table.appendChild(tbody);
    statsContainer.appendChild(table);
    overlay.appendChild(statsContainer);
    
    // Add return to lobby button
    const returnButton = document.createElement('button');
    returnButton.textContent = 'Return to Lobby';
    returnButton.style.marginTop = '20px';
    returnButton.style.padding = '10px 20px';
    returnButton.style.fontSize = '18px';
    returnButton.style.backgroundColor = '#4CAF50';
    returnButton.style.border = 'none';
    returnButton.style.borderRadius = '5px';
    returnButton.style.color = 'white';
    returnButton.style.cursor = 'pointer';
    
    returnButton.addEventListener('click', () => {
      // Handle return to lobby
      window.location.reload(); // Simple reload for this example
    });
    
    overlay.appendChild(returnButton);
    this.container.appendChild(overlay);
  }
  
  // Animation loop management
  private animations: Map<number, () => void> = new Map();
  private nextAnimationId = 0;
  
  private addToAnimationLoop(animationFn: () => void): number {
    const id = this.nextAnimationId++;
    this.animations.set(id, animationFn);
    return id;
  }
  
  private removeFromAnimationLoop(id: number): void {
    this.animations.delete(id);
  }
  
  // Update method to run all animations
  public update(delta: number): void {
    this.animations.forEach(animationFn => animationFn());
  }
}
```

## Performance Optimization

```typescript
// client/src/game/Optimizations.ts
import * as THREE from 'three';

export class Optimizations {
  // Level of detail management
  public static setupLOD(scene: THREE.Scene): void {
    // Set up frustum culling
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.frustumCulled = true;
      }
    });
  }
  
  // Object pooling for projectiles
  public static createProjectilePool(
    scene: THREE.Scene,
    count: number,
    types: string[]
  ): Map<string, THREE.Object3D[]> {
    const pools: Map<string, THREE.Object3D[]> = new Map();
    
    types.forEach(type => {
      const pool: THREE.Object3D[] = [];
      
      for (let i = 0; i &lt; count; i++) {
        let mesh;
        
        switch (type) {
          case "fireball":
            mesh = new THREE.Mesh(
              new THREE.SphereGeometry(0.5, 8, 8),
              new THREE.MeshBasicMaterial({ color: 0xff4500 })
            );
            break;
          case "arrow":
            mesh = new THREE.Mesh(
              new THREE.CylinderGeometry(0.05, 0.05, 1, 8),
              new THREE.MeshBasicMaterial({ color: 0x8b4513 })
            );
            break;
          default:
            mesh = new THREE.Mesh(
              new THREE.SphereGeometry(0.3, 8, 8),
              new THREE.MeshBasicMaterial({ color: 0xffff00 })
            );
        }
        
        mesh.visible = false;
        scene.add(mesh);
        pool.push(mesh);
      }
      
      pools.set(type, pool);
    });
    
    return pools;
  }
  
  // Get object from pool
  public static getFromPool(
    pools: Map<string, THREE.Object3D[]>,
    type: string
  ): THREE.Object3D | null {
    if (!pools.has(type)) return null;
    
    const pool = pools.get(type)!;
    for (const object of pool) {
      if (!object.visible) {
        object.visible = true;
        return object;
      }
    }
    
    return null; // Pool exhausted
  }
  
  // Return object to pool
  public static returnToPool(object: THREE.Object3D): void {
    object.visible = false;
  }
  
  // Optimize textures
  public static optimizeTextures(scene: THREE.Scene): void {
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        const material = object.material as THREE.MeshBasicMaterial;
        
        if (material.map) {
          material.map.minFilter = THREE.LinearFilter;
          material.map.generateMipmaps = false;
        }
      }
    });
  }
  
  // Batch similar objects
  public static batchObjects(
    scene: THREE.Scene,
    objects: THREE.Object3D[],
    geometry: THREE.BufferGeometry,
    material: THREE.Material
  ): THREE.InstancedMesh {
    const instancedMesh = new THREE.InstancedMesh(
      geometry,
      material,
      objects.length
    );
    
    const matrix = new THREE.Matrix4();
    
    objects.forEach((object, i) => {
      matrix.setPosition(object.position);
      instancedMesh.setMatrixAt(i, matrix);
      scene.remove(object);
    });
    
    scene.add(instancedMesh);
    return instancedMesh;
  }
}
```

## Troubleshooting

```typescript
// client/src/utils/Debugging.ts
import { Room } from "colyseus.js";

export class Debugging {
  private static instance: Debugging;
  private enabled: boolean = false;
  private logElement: HTMLElement | null = null;
  
  private constructor() {
    // Create debug UI if enabled
    if (this.enabled) {
      this.createDebugUI();
    }
  }
  
  public static getInstance(): Debugging {
    if (!Debugging.instance) {
      Debugging.instance = new Debugging();
    }
    return Debugging.instance;
  }
  
  public enableDebugging(enabled: boolean): void {
    this.enabled = enabled;
    
    if (enabled && !this.logElement) {
      this.createDebugUI();
    } else if (!enabled && this.logElement) {
      this.removeDebugUI();
    }
  }
  
  private createDebugUI(): void {
    this.logElement = document.createElement('div');
    this.logElement.className = 'debug-log';
    this.logElement.style.position = 'absolute';
    this.logElement.style.top = '10px';
    this.logElement.style.right = '10px';
    this.logElement.style.width = '300px';
    this.logElement.style.height = '200px';
    this.logElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    this.logElement.style.color = 'white';
    this.logElement.style.padding = '10px';
    this.logElement.style.overflow = 'auto';
    this.logElement.style.fontFamily = 'monospace';
    this.logElement.style.fontSize = '12px';
    this.logElement.style.zIndex = '1000';
    
    document.body.appendChild(this.logElement);
  }
  
  private removeDebugUI(): void {
    if (this.logElement && this.logElement.parentNode) {
      this.logElement.parentNode.removeChild(this.logElement);
      this.logElement = null;
    }
  }
  
  public log(message: string): void {
    console.log(message);
    
    if (this.enabled && this.logElement) {
      const logEntry = document.createElement('div');
      logEntry.textContent = `[${new Date().toISOString()}] ${message}`;
      this.logElement.appendChild(logEntry);
      this.logElement.scrollTop = this.logElement.scrollHeight;
      
      // Limit log entries
      while (this.logElement.childNodes.length > 50) {
        this.logElement.removeChild(this.logElement.firstChild!);
      }
    }
  }
  
  public monitorRoom(room: Room): void {
    if (!this.enabled) return;
    
    room.onStateChange((state) => {
      this.log(`State updated: ${Object.keys(state).length} keys`);
    });
    
    room.onMessage("*", (type, message) => {
      this.log(`Message: ${type} - ${JSON.stringify(message).substring(0, 100)}...`);
    });
    
    room.onError((code, message) => {
      this.log(`ERROR (${code}): ${message}`);
    });
  }
  
  public showNetworkStats(room: Room): void {
    if (!this.enabled || !this.logElement) return;
    
    // Create network stats element
    const statsElement = document.createElement('div');
    statsElement.className = 'network-stats';
    statsElement.style.position = 'absolute';
    statsElement.style.top = '220px';
    statsElement.style.right = '10px';
    statsElement.style.width = '300px';
    statsElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    statsElement.style.color = 'white';
    statsElement.style.padding = '10px';
    statsElement.style.fontFamily = 'monospace';
    statsElement.style.fontSize = '12px';
    statsElement.style.zIndex = '1000';
    
    document.body.appendChild(statsElement);
    
    // Update stats periodically
    setInterval(() => {
      if (!room.connection.isOpen) {
        statsElement.innerHTML = 'Connection closed';
        return;
      }
      
      const latency = room.connection.pingService.average;
      const state = room.state ? Object.keys(room.state).length : 0;
      
      statsElement.innerHTML = `
        <div>Latency: ${latency.toFixed(2)}ms</div>
        <div>State size: ${state} keys</div>
        <div>Room ID: ${room.id}</div>
        <div>Session ID: ${room.sessionId}</div>
      `;
    }, 1000);
  }
}
```

## Putting It All Together

Here's how to integrate all the components:

```typescript
// client/src/index.ts
import { ColyseusClient } from "./services/ColyseusClient";
import { LobbyService } from "./services/LobbyService";
import { BattleService } from "./services/BattleService";
import { BattleScene } from "./game/BattleScene";
import { BattleUI } from "./game/BattleUI";
import { StateManager } from "./game/StateManager";
import { EventManager } from "./game/EventManager";
import { Debugging } from "./utils/Debugging";

// Enable debugging in development
const debugging = Debugging.getInstance();
debugging.enableDebugging(process.env.NODE_ENV === 'development');

// Initialize Colyseus client
const endpoint = process.env.COLYSEUS_ENDPOINT || "ws://localhost:2567";
const colyseusClient = ColyseusClient.getInstance(endpoint);

// Initialize services
const lobbyService = new LobbyService(colyseusClient);
const battleService = new BattleService(colyseusClient);

// DOM elements
const lobbyContainer = document.getElementById('lobby-container') as HTMLElement;
const gameContainer = document.getElementById('game-container') as HTMLElement;

// Show lobby UI
function showLobbyUI() {
  lobbyContainer.style.display = 'block';
  gameContainer.style.display = 'none';
  
  // Clear previous content
  lobbyContainer.innerHTML = '';
  
  // Create login form if not connected
  if (!lobbyService.getLobbyRoom()) {
    createLoginForm();
  } else {
    createLobbyInterface();
  }
}

// Create login form
function createLoginForm() {
  const form = document.createElement('form');
  form.className = 'login-form';
  
  const heading = document.createElement('h2');
  heading.textContent = 'Join Lobby';
  
  const usernameInput = document.createElement('input');
  usernameInput.type = 'text';
  usernameInput.placeholder = 'Username';
  usernameInput.required = true;
  
  const submitButton = document.createElement('button');
  submitButton.type = 'submit';
  submitButton.textContent = 'Join';
  
  form.appendChild(heading);
  form.appendChild(usernameInput);
  form.appendChild(submitButton);
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = usernameInput.value.trim();
    
    if (username) {
      try {
        await lobbyService.joinLobby(username);
        createLobbyInterface();
      } catch (error) {
        console.error("Error joining lobby:", error);
        alert(`Failed to join lobby: ${error}`);
      }
    }
  });
  
  lobbyContainer.appendChild(form);
}

// Create lobby interface
function createLobbyInterface() {
  const container = document.createElement('div');
  container.className = 'lobby-interface';
  
  // Create game list section
  const gameListSection = document.createElement('div');
  gameListSection.className = 'game-list-section';
  
  const gameListHeading = document.createElement('h2');
  gameListHeading.textContent = 'Available Games';
  
  const gameTypeFilter = document.createElement('select');
  gameTypeFilter.innerHTML = `
    <option value="">All Games</option>
    <option value="battle">Battle</option>
    <option value="race">Race</option>
    <option value="platformer">Platformer</option>
  `;
  
  const refreshButton = document.createElement('button');
  refreshButton.textContent = 'Refresh';
  refreshButton.addEventListener('click', () => {
    const gameType = gameTypeFilter.value;
    lobbyService.requestActiveLobbies(gameType || undefined);
  });
  
  const gameList = document.createElement('div');
  gameList.className = 'game-list';
  
  gameListSection.appendChild(gameListHeading);
  gameListSection.appendChild(gameTypeFilter);
  gameListSection.appendChild(refreshButton);
  gameListSection.appendChild(gameList);
  
  // Create game creation section
  const createGameSection = document.createElement('div');
  createGameSection.className = 'create-game-section';
  
  const createGameHeading = document.createElement('h2');
  createGameHeading.textContent = 'Create New Game';
  
  const createGameForm = document.createElement('form');
  createGameForm.innerHTML = `
    <div>
      <label for="gameType">Game Type:</label>
      <select id="gameType" required>
        <option value="battle">Battle</option>
        <option value="race">Race</option>
        <option value="platformer">Platformer</option>
      </select>
    </div>
    <div>
      <label for="gameName">Game Name:</label>
      <input type="text" id="gameName" required>
    </div>
    <div>
      <label for="maxPlayers">Max Players:</label>
      <input type="number" id="maxPlayers" min="2" max="16" value="8" required>
    </div>
    <button type="submit">Create Game</button>
  `;
  
  createGameForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const gameType = (document.getElementById('gameType') as HTMLSelectElement).value;
    const gameName = (document.getElementById('gameName') as HTMLInputElement).value;
    const maxPlayers = parseInt((document.getElementById('maxPlayers') as HTMLInputElement).value);
    
    lobbyService.createGame(gameType, gameName, maxPlayers);
  });
  
  createGameSection.appendChild(createGameHeading);
  createGameSection.appendChild(createGameForm);
  
  // Add sections to container
  container.appendChild(gameListSection);
  container.appendChild(createGameSection);
  
  // Clear and add to lobby container
  lobbyContainer.innerHTML = '';
  lobbyContainer.appendChild(container);
  
  // Set up lobby listeners
  lobbyService.setActiveLobbiesListener((lobbies) => {
    updateGameList(gameList, lobbies);
  });
  
  // Initial request for lobbies
  lobbyService.requestActiveLobbies();
}

// Update game list
function updateGameList(gameListElement: HTMLElement, lobbies: any[]) {
  gameListElement.innerHTML = '';
  
  if (lobbies.length === 0) {
    const noGamesMessage = document.createElement('div');
    noGamesMessage.className = 'no-games-message';
    noGamesMessage.textContent = 'No active games found. Create one!';
    gameListElement.appendChild(noGamesMessage);
    return;
  }
  
  lobbies.forEach(game => {
    const gameItem = document.createElement('div');
    gameItem.className = 'game-item';
    
    gameItem.innerHTML = `
      <div class="game-info">
        <h3>${game.name}</h3>
        <p>Type: ${game.type}</p>
        <p>Players: ${game.currentPlayers}/${game.maxPlayers}</p>
      </div>
      <button class="join-button">Join</button>
    `;
    
    const joinButton = gameItem.querySelector('.join-button') as HTMLButtonElement;
    joinButton.addEventListener('click', async () => {
      try {
        // Join the battle room
        await battleService.joinBattleRoom(game.id, {
          username: lobbyService.getLobbyRoom()?.sessionId || 'Player',
          characterType: 'warrior'
        });
        
        // Show game UI
        showGameUI();
      } catch (error) {
        console.error("Error joining game:", error);
        alert(`Failed to join game: ${error}`);
      }
    });
    
    gameListElement.appendChild(gameItem);
  });
}

// Show game UI
async function showGameUI() {
  lobbyContainer.style.display = 'none';
  gameContainer.style.display = 'block';
  
  // Clear previous content
  gameContainer.innerHTML = '';
  
  // Create character selection UI
  const characterSelectionUI = document.createElement('div');
  characterSelectionUI.className = 'character-selection';
  characterSelectionUI.innerHTML = `
    <h2>Select Your Character</h2>
    <div class="character-options">
      <div class="character-option" data-type="warrior">
        <img src="/assets/warrior.png" alt="Warrior">
        <h3>Warrior</h3>
        <p>Strong melee fighter with high health</p>
      </div>
      <div class="character-option" data-type="mage">
        <img src="/assets/mage.png" alt="Mage">
        <h3>Mage</h3>
        <p>Powerful spellcaster with ranged attacks</p>
      </div>
      <div class="character-option" data-type="archer">
        <img src="/assets/archer.png" alt="Archer">
        <h3>Archer</h3>
        <p>Fast ranged attacker with high mobility</p>
      </div>
    </div>
    <button id="ready-button" disabled>Ready</button>
  `;
  
  gameContainer.appendChild(characterSelectionUI);
  
  // Handle character selection
  let selectedCharacter = '';
  const characterOptions = characterSelectionUI.querySelectorAll('.character-option');
  const readyButton = document.getElementById('ready-button') as HTMLButtonElement;
  
  characterOptions.forEach(option => {
    option.addEventListener('click', () => {
      // Remove selected class from all options
      characterOptions.forEach(opt => opt.classList.remove('selected'));
      
      // Add selected class to clicked option
      option.classList.add('selected');
      
      // Get character type
      selectedCharacter = option.getAttribute('data-type') || '';
      
      // Enable ready button
      readyButton.disabled = false;
      
      // Change character in the game
      battleService.changeCharacter(selectedCharacter);
    });
  });
  
  // Handle ready button
  readyButton.addEventListener('click', () => {
    // Set player as ready
    battleService.setReady(true);
    
    // Hide character selection
    characterSelectionUI.style.display = 'none';
    
    // Initialize game scene
    initializeGameScene();
  });
}

// Initialize game scene
function initializeGameScene() {
  // Create battle scene
  const battleScene = new BattleScene(gameContainer);
  
  // Connect battle scene with service
  battleService.setBattleScene(battleScene);
  
  // Create battle UI
  const battleUI = new BattleUI(gameContainer, battleService);
  
  // Create state manager
  const stateManager = new StateManager(
    battleService.getBattleRoom()!,
    battleScene
  );
  
  // Create event manager
  const eventManager = new EventManager(
    battleService.getBattleRoom()!,
    battleScene
  );
  
  // Enable debugging if in development
  if (process.env.NODE_ENV === 'development') {
    debugging.monitorRoom(battleService.getBattleRoom()!);
    debugging.showNetworkStats(battleService.getBattleRoom()!);
  }
}

// Start the application
showLobbyUI();
```

## Conclusion

This guide provides a comprehensive implementation of both the lobby system and Three.js-based battle game using Colyseus v16. The client-side code is designed to work with the server-side implementation described in the repository.

Key features implemented:

- Lobby system for creating and joining games
- Three.js integration for 3D rendering
- Player movement and shooting mechanics
- Abilities system with visual effects
- State synchronization with interpolation
- Event handling for game events
- Performance optimizations
- Debugging tools


For the best experience, ensure your server is properly configured with the Colyseus v16 implementation as described in the server code.

## Additional Resources

- [Colyseus Documentation](https://docs.colyseus.io/)
- [Three.js Documentation](https://threejs.org/docs/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
