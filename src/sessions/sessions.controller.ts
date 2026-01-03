import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Delete,
  NotFoundException,
} from '@nestjs/common';
import { SessionsService } from './sessions.service';

@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post('create')
  async create(@Body() body: { hostId: string; adventureId: string }) {
    const session = await this.sessionsService.create(
      body.hostId,
      body.adventureId,
    );
    return {
      id: (session as any)._id,
      code: session.code,
      hostId: session.hostId,
      playerIds: session.playerIds,
      status: session.status,
    };
  }

  @Post('join')
  async join(@Body() body: { code: string; playerId: string }) {
    const session = await this.sessionsService.joinSession(
      body.code,
      body.playerId,
    );

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    return {
      id: (session as any)._id,
      code: session.code,
      hostId: session.hostId,
      playerIds: session.playerIds,
      adventureId: session.adventureId,
      status: session.status,
    };
  }

  @Get(':code')
  async getByCode(@Param('code') code: string) {
    const session = await this.sessionsService.findByCode(code);
    if (!session) return null;

    return {
      id: (session as any)._id,
      code: session.code,
      hostId: session.hostId,
      playerIds: session.playerIds,
      adventureId: session.adventureId,
      status: session.status,
      gameState: session.gameState,
    };
  }

  @Post(':id/start')
  async start(@Param('id') id: string) {
    const session = await this.sessionsService.startGame(id);

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    return {
      id: (session as any)._id,
      status: session.status,
      gameState: session.gameState,
    };
  }

  @Delete(':id/leave')
  async leave(@Param('id') id: string, @Body() body: { playerId: string }) {
    await this.sessionsService.leaveSession(id, body.playerId);
    return { success: true };
  }
}
