import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PlayerDocument = Player & Document;

@Schema({ timestamps: true })
export class Player {
  // Legacy: username/password (deprecated, kept for migration)
  @Prop({ unique: true, sparse: true })
  username?: string;

  @Prop()
  passwordHash?: string;

  // New: Games Services authentication
  @Prop({ required: true, unique: true, index: true })
  playerId: string; // Player ID from Google Play Games Services or Game Center

  @Prop({ required: true, enum: ['android', 'ios'] })
  platform: 'android' | 'ios';

  @Prop()
  displayName?: string; // Optional display name from the platform

  @Prop({ default: 0 })
  gamesPlayed: number;

  @Prop({ default: 0 })
  gamesWon: number;

  @Prop({ type: Object, default: {} })
  stats: Record<string, any>;
}

export const PlayerSchema = SchemaFactory.createForClass(Player);



