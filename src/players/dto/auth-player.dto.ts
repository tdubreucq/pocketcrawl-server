import { IsString, IsEnum, IsOptional } from 'class-validator';

export enum Platform {
  ANDROID = 'android',
  IOS = 'ios',
}

export class AuthPlayerDto {
  @IsString()
  playerId: string; // Player ID from Google Play Games Services or Game Center

  @IsEnum(Platform)
  platform: 'android' | 'ios';

  @IsOptional()
  @IsString()
  displayName?: string; // Optional display name from the platform
}

