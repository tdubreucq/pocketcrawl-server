/**
 * Types pour les données de jeu chargées depuis les fichiers JSON
 */

export interface CharacterData {
  id: string;
  name: string;
  description: string;
  portraitAsset: string;
  force: number;
  dexterite: number;
  intelligence: number;
  chance: number;
  charisme: number;
  maxHp: number;
}

export interface EnemyData {
  id: string;
  name: string;
  description: string;
  imageAsset: string;
  damage: number;
  requirements: Array<{
    stat: string;
    count: number;
  }>;
  isBoss?: boolean;
}

export interface EnemiesData {
  standard: EnemyData[];
  bosses: EnemyData[];
}

export interface WeaponEffect {
  trigger: string;
  triggerStat?: string;
  action: string;
  usesPerCombat?: number;
  value?: number;
  description: string;
}

export interface ConsumableEffect {
  healing?: number;
  forcedStat?: string;
  allowsReroll?: boolean;
}

export interface ItemData {
  id: string;
  name: string;
  description: string;
  type: string;
  rarity: string;
  weaponEffect?: WeaponEffect;
  consumableEffect?: ConsumableEffect;
}

export interface ItemsData {
  items: ItemData[];
}

export interface EventChoice {
  id: string;
  text: string;
  outcome: EventOutcome;
}

export interface EventOutcome {
  damage?: number;
  enemyId?: string;
  message?: string;
  statCheck?: string;
  checkThreshold?: number;
  successOutcome?: EventOutcome;
  failureOutcome?: EventOutcome;
}

export interface PreCombatCheck {
  type: string;
  statRequired: string;
  threshold: number;
  penaltyOnFail: string;
  penaltyValue: number;
  description: string;
  successMessage: string;
  failureMessage: string;
}

export interface ClassBasedCondition {
  characterClassId: string;
  condition: string;
  description: string;
  extraRequirements?: number;
  damageModifier?: number;
  doublesDisabled?: boolean;
}

export interface GameEventData {
  id: string;
  title: string;
  description: string;
  imageAsset: string;
  type: string;
  enemyId?: string;
  choices?: EventChoice[];
  preCombatCheck?: PreCombatCheck;
  classConditions?: ClassBasedCondition[];
}

export interface EventsData {
  adventures: {
    [key: string]: GameEventData[];
  };
}

export interface AdventureData {
  id: string;
  name: string;
  description: string;
  imageAsset: string;
  eventsKey: string;
  eventCount: number;
  bossIds: string[];
}

export interface AdventureWithPools extends AdventureData {
  eventPool: GameEventData[];
  bossPool: EnemyData[];
}

