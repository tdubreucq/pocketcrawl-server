// Types pour l'état de jeu côté serveur

export interface PlayerGameState {
  characterId: string;
  currentHp: number;
  maxHp: number;
  inventory: InventoryItem[];
  forcedNextRoll?: string; // StatType forcé (de potion)
  potionRerollAvailable: boolean;
}

export interface InventoryItem {
  itemId: string;
  uses?: number; // Pour les consommables (uses restantes)
  weaponEffectUsesThisCombat?: number; // Pour les effets d'arme (utilisé ce combat)
}

export interface CombatState {
  enemyId: string;
  enemyDamage: number;
  isActive: boolean;
  remainingRequirements: DiceRequirement[];
  confirmedPlayers: string[]; // Joueurs qui ont confirmé leur jet pour ce round
  currentRound: number;
  blockedTurnsRemaining: number; // Tours bloqués restants (effets d'armes)
}

export interface DiceRequirement {
  stat: string; // 'force', 'dexterite', 'intelligence'
  count: number;
}

export interface DiceRoll {
  stat: string; // StatType
  isDouble: boolean;
}

export interface DiceRollResult {
  roll: DiceRoll;
  wasSuccessful: boolean;
  successCount: number;
  damageTaken: number;
  wasBlocked: boolean;
  isVictory: boolean;
  effectMessages: string[];
}

export interface CombatModifiers {
  extraRequirements: string[]; // Stats supplémentaires (scaling multijoueur)
  initialDamage: number;
  extraDamagePerTurn: number;
  doublesDisabled: boolean;
}

