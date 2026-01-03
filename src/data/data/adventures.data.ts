import { AdventureData } from '../types/game-data.types';

export const adventures: AdventureData[] = [
  {
    id: 'crypte',
    name: 'La Crypte Maudite',
    description: 'Une ancienne crypte où les morts ne reposent pas en paix. Affrontez squelettes, spectres et pièges mortels. Un puissant adversaire vous attend au fond...',
    imageAsset: 'crypt',
    eventsKey: 'crypte',
    eventCount: 8,
    bossIds: ['boss_necromancer', 'boss_lich'],
  },
  {
    id: 'foret_maudite',
    name: 'La Forêt des Ombres',
    description: 'Une forêt dense où la lumière peine à percer. Gobelins, loups et orcs rôdent dans l\'obscurité. Un danger mortel sommeille en son cœur...',
    imageAsset: 'forest',
    eventsKey: 'foret_maudite',
    eventCount: 8,
    bossIds: ['boss_dragon'],
  },
];

