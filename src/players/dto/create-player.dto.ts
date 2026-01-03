import { IsString, MinLength, MaxLength } from 'class-validator';

export class CreatePlayerDto {
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  username: string;

  @IsString()
  @MinLength(6)
  password: string;
}



