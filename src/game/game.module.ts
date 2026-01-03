import { Module } from '@nestjs/common';
import { GameGateway } from './game.gateway';
import { SessionsModule } from '../sessions/sessions.module';
import { DataModule } from '../data/data.module';
import { GameLogicService } from './services/game-logic.service';

@Module({
  imports: [SessionsModule, DataModule],
  providers: [GameGateway, GameLogicService],
})
export class GameModule {}



