import { Injectable, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Player, PlayerDocument } from './schemas/player.schema';
import { CreatePlayerDto } from './dto/create-player.dto';
import { AuthPlayerDto } from './dto/auth-player.dto';
import * as crypto from 'crypto';

@Injectable()
export class PlayersService {
  constructor(
    @InjectModel(Player.name) private playerModel: Model<PlayerDocument>,
  ) {}

  /**
   * Authenticates a player via Games Services (GPGS/Game Center).
   * Creates the player if they don't exist (findOrCreate pattern).
   */
  async authenticate(authDto: AuthPlayerDto): Promise<Player> {
    // Try to find existing player by playerId
    let player = await this.playerModel.findOne({
      playerId: authDto.playerId,
    }).exec();

    if (player) {
      // Update display name if provided and different
      if (authDto.displayName && player.displayName !== authDto.displayName) {
        player.displayName = authDto.displayName;
        await player.save();
      }
      return player;
    }

    // Player doesn't exist, create a new one
    player = new this.playerModel({
      playerId: authDto.playerId,
      platform: authDto.platform,
      displayName: authDto.displayName,
      gamesPlayed: 0,
      gamesWon: 0,
      stats: {},
    });

    return player.save();
  }

  /**
   * Legacy: Creates a player with username/password (deprecated).
   * @deprecated Use authenticate() with playerId instead
   */
  async create(createPlayerDto: CreatePlayerDto): Promise<Player> {
    const existing = await this.playerModel.findOne({
      username: createPlayerDto.username,
    });

    if (existing) {
      throw new ConflictException('Username already exists');
    }

    const passwordHash = this.hashPassword(createPlayerDto.password);
    const player = new this.playerModel({
      username: createPlayerDto.username,
      passwordHash,
      // Generate a temporary playerId for legacy players
      playerId: `legacy_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      platform: 'android', // Default for legacy
    });

    return player.save();
  }

  /**
   * Legacy: Finds a player by username (deprecated).
   * @deprecated Use findByPlayerId() instead
   */
  async findByUsername(username: string): Promise<Player | null> {
    return this.playerModel.findOne({ username }).exec();
  }

  /**
   * Finds a player by their Games Services playerId.
   */
  async findByPlayerId(playerId: string): Promise<Player | null> {
    return this.playerModel.findOne({ playerId }).exec();
  }

  async findById(id: string): Promise<Player | null> {
    return this.playerModel.findById(id).exec();
  }

  /**
   * Legacy: Validates password for username/password authentication (deprecated).
   * @deprecated Use authenticate() with playerId instead
   */
  async validatePassword(username: string, password: string): Promise<Player | null> {
    const player = await this.findByUsername(username);
    if (!player) return null;

    const hash = this.hashPassword(password);
    if (hash !== player.passwordHash) return null;

    return player;
  }

  async updateStats(playerId: string, won: boolean): Promise<void> {
    await this.playerModel.findByIdAndUpdate(playerId, {
      $inc: {
        gamesPlayed: 1,
        gamesWon: won ? 1 : 0,
      },
    });
  }

  /**
   * Legacy: Hashes password for username/password authentication (deprecated).
   * @deprecated
   */
  private hashPassword(password: string): string {
    return crypto.createHash('sha256').update(password).digest('hex');
  }
}



