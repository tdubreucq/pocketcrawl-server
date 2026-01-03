import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type GameSessionDocument = GameSession & Document;

export enum SessionStatus {
  WAITING = 'waiting',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  ABANDONED = 'abandoned',
}

@Schema({ timestamps: true })
export class GameSession {
  @Prop({ required: true })
  code: string;

  @Prop({ required: true })
  hostId: string;

  @Prop({ type: [String], default: [] })
  playerIds: string[];

  @Prop({ required: true })
  adventureId: string;

  @Prop({ default: 4 })
  maxPlayers: number;

  @Prop({ enum: SessionStatus, default: SessionStatus.WAITING })
  status: SessionStatus;

  @Prop({ type: Object, default: {} })
  gameState: {
    currentEventIndex?: number;
    playerStates?: Record<
      string,
      {
        characterId: string;
        currentHp: number;
        maxHp: number;
        inventory: Array<{
          itemId: string;
          uses?: number;
          weaponEffectUsesThisCombat?: number;
        }>;
        forcedNextRoll?: string;
        potionRerollAvailable: boolean;
      }
    >;
    combatState?: {
      enemyId: string;
      enemyDamage: number;
      isActive: boolean;
      remainingRequirements?: Array<{ stat: string; count: number }>;
      confirmedPlayers?: string[]; // Liste des joueurs qui ont confirmé leur jet pour ce round
      currentRound?: number;
      blockedTurnsRemaining?: number;
    };
    turnOrder?: string[];
    currentTurnIndex?: number;
    // Aventure randomisée sérialisée (pour synchronisation)
    randomizedAdventure?: {
      eventIds: string[];
      bossId: string;
    };
    adventureSeed?: number;
    // Jets aléatoires générés pour le scaling multijoueur
    scaledRandomRequirements?: string[]; // Array de stat names (force, dexterite, intelligence)
  };
}

export const GameSessionSchema = SchemaFactory.createForClass(GameSession);



