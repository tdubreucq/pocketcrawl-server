import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  GameSession,
  GameSessionDocument,
  SessionStatus,
} from './schemas/game-session.schema';

@Injectable()
export class SessionsService {
  constructor(
    @InjectModel(GameSession.name)
    private sessionModel: Model<GameSessionDocument>,
  ) {}

  async create(hostId: string, adventureId: string): Promise<GameSession> {
    const code = this.generateCode();
    const session = new this.sessionModel({
      code,
      hostId,
      adventureId,
      playerIds: [hostId],
      status: SessionStatus.WAITING,
    });
    return session.save();
  }

  async findByCode(code: string): Promise<GameSession | null> {
    return this.sessionModel.findOne({ code }).exec();
  }

  async findById(id: string): Promise<GameSession | null> {
    return this.sessionModel.findById(id).exec();
  }

  async joinSession(code: string, playerId: string): Promise<GameSession | null> {
    const session = await this.findByCode(code);
    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (session.status !== SessionStatus.WAITING) {
      throw new Error('Session is not accepting players');
    }

    if (session.playerIds.length >= session.maxPlayers) {
      throw new Error('Session is full');
    }

    if (session.playerIds.includes(playerId)) {
      return session;
    }

    return this.sessionModel
      .findByIdAndUpdate(
        (session as any)._id,
        { $push: { playerIds: playerId } },
        { new: true },
      )
      .exec();
  }

  async leaveSession(sessionId: string, playerId: string): Promise<void> {
    await this.sessionModel
      .findByIdAndUpdate(sessionId, { $pull: { playerIds: playerId } })
      .exec();
  }

  async startGame(sessionId: string): Promise<GameSession | null> {
    return this.sessionModel
      .findByIdAndUpdate(
        sessionId,
        {
          status: SessionStatus.IN_PROGRESS,
          'gameState.currentEventIndex': 0,
        },
        { new: true },
      )
      .exec();
  }

  async updateGameState(
    sessionId: string,
    gameState: Partial<GameSession['gameState']>,
  ): Promise<GameSession | null> {
    const session = await this.findById(sessionId);
    if (!session) {
      throw new NotFoundException('Session not found');
    }

    const updatedState = { ...session.gameState, ...gameState };

    return this.sessionModel
      .findByIdAndUpdate(sessionId, { gameState: updatedState }, { new: true })
      .exec();
  }

  async endGame(
    sessionId: string,
    completed: boolean,
  ): Promise<GameSession | null> {
    return this.sessionModel
      .findByIdAndUpdate(
        sessionId,
        {
          status: completed
            ? SessionStatus.COMPLETED
            : SessionStatus.ABANDONED,
        },
        { new: true },
      )
      .exec();
  }

  private generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }
}

