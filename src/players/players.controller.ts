import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { PlayersService } from './players.service';
import { CreatePlayerDto } from './dto/create-player.dto';
import { AuthPlayerDto } from './dto/auth-player.dto';

@Controller('players')
export class PlayersController {
  constructor(private readonly playersService: PlayersService) {}

  /**
   * Authenticates a player via Games Services (GPGS/Game Center).
   * Creates the player automatically if they don't exist.
   */
  @Post('auth')
  async authenticate(@Body() authDto: AuthPlayerDto) {
    const player = await this.playersService.authenticate(authDto);

    return {
      success: true,
      player: {
        id: (player as any)._id,
        playerId: player.playerId,
        platform: player.platform,
        displayName: player.displayName || player.playerId,
        gamesPlayed: player.gamesPlayed,
        gamesWon: player.gamesWon,
      },
    };
  }

  /**
   * Legacy: Registers a player with username/password (deprecated).
   * @deprecated Use /auth endpoint with playerId instead
   */
  @Post('register')
  async register(@Body() createPlayerDto: CreatePlayerDto) {
    const player = await this.playersService.create(createPlayerDto);
    return {
      id: (player as any)._id,
      username: player.username,
      playerId: player.playerId,
    };
  }

  /**
   * Legacy: Logs in a player with username/password (deprecated).
   * @deprecated Use /auth endpoint with playerId instead
   */
  @Post('login')
  async login(@Body() loginDto: CreatePlayerDto) {
    const player = await this.playersService.validatePassword(
      loginDto.username,
      loginDto.password,
    );

    if (!player) {
      return { success: false, message: 'Invalid credentials' };
    }

    return {
      success: true,
      player: {
        id: (player as any)._id,
        username: player.username,
        playerId: player.playerId,
        gamesPlayed: player.gamesPlayed,
        gamesWon: player.gamesWon,
      },
    };
  }

  @Get(':id')
  async getPlayer(@Param('id') id: string) {
    const player = await this.playersService.findById(id);
    if (!player) return null;

    return {
      id: (player as any)._id,
      playerId: player.playerId,
      platform: player.platform,
      displayName: player.displayName || player.playerId,
      username: player.username, // Legacy field
      gamesPlayed: player.gamesPlayed,
      gamesWon: player.gamesWon,
    };
  }
}



