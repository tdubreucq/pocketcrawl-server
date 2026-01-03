import { Injectable } from '@nestjs/common';
import {
  PlayerGameState,
  CombatState,
  DiceRoll,
  DiceRollResult,
  DiceRequirement,
  InventoryItem,
  CombatModifiers,
} from '../types/game-state.types';

@Injectable()
export class GameLogicService {
  /**
   * Calcule le résultat d'un jet de dés en combat
   * Retourne le résultat et les nouvelles valeurs pour remainingRequirements
   */
  calculateCombatRoll(
    roll: DiceRoll,
    remainingRequirements: DiceRequirement[],
    enemyDamage: number,
    blockedTurnsRemaining: number = 0,
    modifiers?: CombatModifiers,
  ): {
    result: DiceRollResult;
    newRemainingRequirements: DiceRequirement[];
    newBlockedTurnsRemaining: number;
  } {
    const effectMessages: string[] = [];
    let wasSuccessful = false;
    let successCount = 0;
    let damageTaken = 0;
    let wasBlocked = roll.isDouble;
    let treatAsDouble = roll.isDouble;

    // Copier les requirements pour ne pas modifier l'original
    const newRemainingRequirements: DiceRequirement[] =
      remainingRequirements.map((req) => ({ ...req }));

    // Vérifier les effets d'armes (simplifié - le client devrait envoyer les effets)
    // Pour l'instant, on suppose que les effets sont déjà appliqués côté client
    // TODO: Gérer les effets d'armes côté serveur

    // Vérifier si le jet remplit un requirement
    const requirement = newRemainingRequirements.find(
      (req) => req.stat === roll.stat && req.count > 0,
    );

    if (requirement) {
      const reduction = treatAsDouble ? 2 : 1;
      const actualReduction = Math.min(reduction, requirement.count);
      requirement.count -= actualReduction;
      // S'assurer que le count ne devient pas négatif
      if (requirement.count < 0) {
        requirement.count = 0;
      }
      successCount = actualReduction;
      wasSuccessful = true;
    }

    // Vérifier la victoire
    const isVictory = newRemainingRequirements.every((req) => req.count <= 0);

    let newBlockedTurnsRemaining = blockedTurnsRemaining;

    // Calculer les dégâts (si pas de victoire et pas bloqué)
    if (!isVictory && !wasBlocked) {
      if (newBlockedTurnsRemaining > 0) {
        newBlockedTurnsRemaining--;
        wasBlocked = true;
      } else {
        damageTaken = enemyDamage;
        // Ajouter les dégâts supplémentaires des modifiers
        if (modifiers) {
          damageTaken += modifiers.extraDamagePerTurn;
        }
        // TODO: Appliquer la réduction d'armure (depuis l'inventaire)
        // Pour l'instant, on suppose que les dégâts sont déjà calculés
      }
    }

    return {
      result: {
        roll,
        wasSuccessful,
        successCount,
        damageTaken,
        wasBlocked,
        isVictory,
        effectMessages,
      },
      newRemainingRequirements,
      newBlockedTurnsRemaining,
    };
  }

  /**
   * Applique des dégâts à un joueur
   */
  applyDamage(
    playerState: PlayerGameState,
    damage: number,
    armorReduction: number = 0,
  ): number {
    let actualDamage = damage;
    if (armorReduction > 0) {
      actualDamage -= armorReduction;
      if (actualDamage < 1) actualDamage = 1;
    }

    playerState.currentHp = Math.max(0, playerState.currentHp - actualDamage);
    return actualDamage;
  }

  /**
   * Soigne un joueur
   */
  healPlayer(playerState: PlayerGameState, amount: number): number {
    const oldHp = playerState.currentHp;
    playerState.currentHp = Math.min(
      playerState.maxHp,
      playerState.currentHp + amount,
    );
    return playerState.currentHp - oldHp;
  }

  /**
   * Utilise un item consommable
   */
  useConsumableItem(
    playerState: PlayerGameState,
    item: InventoryItem,
    itemData: {
      healing?: number;
      forcedStat?: string;
      allowsReroll?: boolean;
    },
  ): {
    success: boolean;
    consumesTurn: boolean;
    healing?: number;
    forcedStat?: string;
    allowsReroll?: boolean;
  } {
    // Vérifier si l'item a des uses restantes
    if (item.uses !== undefined && item.uses <= 0) {
      return { success: false, consumesTurn: false };
    }

    // Réduire les uses si applicable
    if (item.uses !== undefined) {
      item.uses--;
    }

    const result: {
      success: boolean;
      consumesTurn: boolean;
      healing?: number;
      forcedStat?: string;
      allowsReroll?: boolean;
    } = {
      success: true,
      consumesTurn: false,
    };

    // Appliquer les effets
    // Toujours définir healing dans le résultat si itemData.healing est fourni
    if (itemData.healing !== undefined && itemData.healing > 0) {
      const healingAmount = this.healPlayer(playerState, itemData.healing);
      result.healing = healingAmount; // Toujours définir healing, même si 0 (joueur déjà à max HP)
    } else if (itemData.healing !== undefined) {
      // Si healing est défini mais <= 0, le définir à 0 quand même
      result.healing = 0;
    }

    if (itemData.forcedStat) {
      playerState.forcedNextRoll = itemData.forcedStat;
      result.forcedStat = itemData.forcedStat;
      result.consumesTurn = true;
    }

    if (itemData.allowsReroll) {
      playerState.potionRerollAvailable = true;
      result.allowsReroll = true;
    }

    return result;
  }

  /**
   * Ajoute un item à l'inventaire d'un joueur
   */
  addItemToInventory(
    playerState: PlayerGameState,
    itemId: string,
    maxInventorySize: number = 2,
  ): { success: boolean; inventoryFull: boolean; discardedItemId?: string } {
    if (playerState.inventory.length >= maxInventorySize) {
      return { success: false, inventoryFull: true };
    }

    const newItem: InventoryItem = {
      itemId,
      uses: undefined, // Sera défini selon le type d'item
    };

    playerState.inventory.push(newItem);
    return { success: true, inventoryFull: false };
  }

  /**
   * Retire un item de l'inventaire
   */
  removeItemFromInventory(
    playerState: PlayerGameState,
    itemId: string,
  ): boolean {
    const index = playerState.inventory.findIndex(
      (item) => item.itemId === itemId,
    );
    if (index === -1) return false;

    playerState.inventory.splice(index, 1);
    return true;
  }

  /**
   * Crée un nouvel état de combat
   */
  createCombatState(
    enemyId: string,
    enemyDamage: number,
    baseRequirements: DiceRequirement[],
    scaledRequirements: string[] = [],
  ): CombatState {
    const remainingRequirements: DiceRequirement[] = baseRequirements.map(
      (req) => ({ ...req }),
    );

    // Ajouter les requirements scaled
    for (const stat of scaledRequirements) {
      const existingReq = remainingRequirements.find((r) => r.stat === stat);
      if (existingReq) {
        existingReq.count += 1;
      } else {
        remainingRequirements.push({ stat, count: 1 });
      }
    }

    return {
      enemyId,
      enemyDamage,
      isActive: true,
      remainingRequirements,
      confirmedPlayers: [],
      currentRound: 1,
      blockedTurnsRemaining: 0,
    };
  }

  /**
   * Initialise l'état d'un joueur au début du jeu
   */
  initializePlayerState(
    characterId: string,
    maxHp: number,
    startingInventory: InventoryItem[] = [],
  ): PlayerGameState {
    return {
      characterId,
      currentHp: maxHp,
      maxHp,
      inventory: [...startingInventory],
      potionRerollAvailable: false,
    };
  }
}

