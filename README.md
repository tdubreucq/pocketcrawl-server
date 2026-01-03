# Pocketcrawl Server

Backend server for the Pocketcrawl multiplayer dungeon crawler game.

## Tech Stack

- **NestJS** - Backend framework
- **MongoDB** - Database (via Mongoose)
- **Socket.io** - Real-time multiplayer communication

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and set your MongoDB connection string:

```bash
cp .env.example .env
```

For local development, you can use a local MongoDB or get a free MongoDB Atlas cluster at:
https://www.mongodb.com/cloud/atlas

### 3. Run the server

```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

## API Endpoints

### Players

- `POST /players/register` - Register a new player
- `POST /players/login` - Login
- `GET /players/:id` - Get player info

### Sessions

- `POST /sessions/create` - Create a game session
- `POST /sessions/join` - Join a session by code
- `GET /sessions/:code` - Get session info
- `POST /sessions/:id/start` - Start the game
- `DELETE /sessions/:id/leave` - Leave a session

## WebSocket Events

### Client → Server

- `joinRoom` - Join a game room
- `leaveRoom` - Leave a game room
- `selectCharacter` - Select a character
- `startGame` - Start the game (host only)
- `rollDice` - Roll dice
- `confirmRoll` - Confirm dice roll
- `updateGameState` - Update game state
- `nextTurn` - Advance to next player's turn
- `gameOver` - End the game
- `chat` - Send chat message

### Server → Client

- `playerJoined` - A player joined
- `playerLeft` - A player left
- `playerDisconnected` - A player disconnected
- `characterSelected` - Character was selected
- `gameStarted` - Game has started
- `diceRolled` - Dice was rolled
- `rollConfirmed` - Roll was confirmed
- `gameStateUpdated` - Game state changed
- `turnChanged` - Turn changed
- `gameEnded` - Game ended
- `chatMessage` - Chat message received
- `sessionState` - Current session state
- `error` - Error occurred

## Project Structure

```
src/
├── main.ts              # Entry point
├── app.module.ts        # Root module
├── players/             # Player management
│   ├── dto/
│   ├── schemas/
│   ├── players.controller.ts
│   ├── players.service.ts
│   └── players.module.ts
├── sessions/            # Game sessions
│   ├── schemas/
│   ├── sessions.controller.ts
│   ├── sessions.service.ts
│   └── sessions.module.ts
└── game/                # Real-time game logic
    ├── game.gateway.ts  # WebSocket gateway
    └── game.module.ts
```
