# Players Module - Games Services Authentication

## Endpoints

### POST `/players/auth` (Nouveau - Recommandé)

Authentifie un joueur via Google Play Games Services (Android) ou Game Center (iOS).

**Request:**
```json
{
  "playerId": "g1234567890",
  "platform": "android",
  "displayName": "Player Name"
}
```

**Response:**
```json
{
  "success": true,
  "player": {
    "id": "507f1f77bcf86cd799439011",
    "playerId": "g1234567890",
    "platform": "android",
    "displayName": "Player Name",
    "gamesPlayed": 0,
    "gamesWon": 0
  }
}
```

**Comportement:**
- Si le joueur existe (via playerId), retourne ses données
- Si le joueur n'existe pas, le crée automatiquement (findOrCreate pattern)
- Met à jour le displayName si fourni et différent

### POST `/players/register` (Legacy - Deprecated)

Crée un nouveau joueur avec username/password. Les joueurs créés via cette méthode reçoivent un playerId généré automatiquement.

### POST `/players/login` (Legacy - Deprecated)

Connecte un joueur avec username/password.

### GET `/players/:id`

Récupère les informations d'un joueur par son ID MongoDB.

## Schéma Player

```typescript
{
  playerId: string;           // Requis, unique (GPGS/Game Center ID)
  platform: 'android' | 'ios'; // Requis
  displayName?: string;        // Optionnel (nom d'affichage)
  username?: string;           // Legacy (optionnel)
  passwordHash?: string;       // Legacy (optionnel)
  gamesPlayed: number;
  gamesWon: number;
  stats: Record<string, any>;
}
```

## Index MongoDB

Un index unique est créé automatiquement sur `playerId` via le décorateur `@Prop({ unique: true })`.

Pour créer manuellement l'index :
```javascript
db.players.createIndex({ playerId: 1 }, { unique: true })
```

