import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { SessionsService } from '../sessions/sessions.service';
import { GameLogicService } from './services/game-logic.service';
import { DataService } from '../data/data.service';

interface PlayerConnection {
  playerId: string;
  sessionCode: string;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connections = new Map<string, PlayerConnection>();

  constructor(
    private readonly sessionsService: SessionsService,
    private readonly gameLogicService: GameLogicService,
    private readonly dataService: DataService,
  ) {}

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    const connection = this.connections.get(client.id);
    if (connection) {
      client.to(connection.sessionCode).emit('playerDisconnected', {
        playerId: connection.playerId,
      });
      this.connections.delete(client.id);
    }
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionCode: string; playerId: string; displayName?: string },
  ) {
    const session = await this.sessionsService.findByCode(data.sessionCode);
    if (!session) {
      client.emit('error', { message: 'Session not found' });
      return;
    }

    client.join(data.sessionCode);
    this.connections.set(client.id, {
      playerId: data.playerId,
      sessionCode: data.sessionCode,
    });

    // Notify others
    client.to(data.sessionCode).emit('playerJoined', {
      playerId: data.playerId,
      displayName: data.displayName,
    });

    // Send current state to the joining player
    client.emit('sessionState', {
      playerIds: session.playerIds,
      status: session.status,
      gameState: session.gameState,
    });
  }

  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionCode: string; playerId: string },
  ) {
    client.leave(data.sessionCode);
    client.to(data.sessionCode).emit('playerLeft', {
      playerId: data.playerId,
    });
    this.connections.delete(client.id);
  }

  @SubscribeMessage('selectCharacter')
  async handleSelectCharacter(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      sessionCode: string;
      sessionId: string;
      playerId: string;
      characterId: string;
      maxHp: number; // HP max du personnage
    },
  ) {
    // Initialiser ou mettre à jour l'état du joueur
    const session = await this.sessionsService.findById(data.sessionId);
    if (session) {
      const playerStates = session.gameState.playerStates || {};
      
      // Initialiser l'état du joueur s'il n'existe pas encore
      if (!playerStates[data.playerId]) {
        playerStates[data.playerId] = this.gameLogicService.initializePlayerState(
          data.characterId,
          data.maxHp,
        );
      } else {
        // Mettre à jour seulement le characterId et maxHp si nécessaire
        playerStates[data.playerId].characterId = data.characterId;
        playerStates[data.playerId].maxHp = data.maxHp;
        if (playerStates[data.playerId].currentHp === 0) {
          playerStates[data.playerId].currentHp = data.maxHp;
        }
      }

      await this.sessionsService.updateGameState(data.sessionId, {
        playerStates: playerStates,
      });
    }

    // Broadcast character selection to all players
    this.server.to(data.sessionCode).emit('characterSelected', {
      playerId: data.playerId,
      characterId: data.characterId,
    });
  }

  @SubscribeMessage('startGame')
  async handleStartGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string; sessionCode: string },
  ) {
    const session = await this.sessionsService.startGame(data.sessionId);
    if (!session) {
      client.emit('error', { message: 'Session not found' });
      return;
    }
    
    // Générer une seed unique pour cette session si elle n'existe pas déjà
    let adventureSeed = session.gameState?.adventureSeed;
    if (!adventureSeed) {
      // Utiliser le timestamp + sessionId pour créer une seed unique mais déterministe
      adventureSeed = Math.abs(
        ((session as any)._id.toString() + Date.now().toString()).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
      );
    }
    
    // Charger l'aventure et la randomiser côté serveur
    const adventure = await this.dataService.getAdventure(session.adventureId);
    if (!adventure) {
      client.emit('error', { message: 'Adventure not found' });
      return;
    }
    
    console.log('[GameGateway] Adventure loaded:', {
      id: adventure.id,
      eventPoolSize: adventure.eventPool?.length || 0,
      bossPoolSize: adventure.bossPool?.length || 0,
    });
    
    const randomized = this.dataService.randomizeAdventure(adventure, adventureSeed);
    
    console.log('[GameGateway] Randomized adventure:', {
      eventIdsCount: randomized.eventIds.length,
      eventIds: randomized.eventIds,
      bossId: randomized.bossId,
    });
    
    // Générer un item de départ pour chaque joueur
    const startingItem = await this.dataService.getRandomItem();
    
    // Ajouter l'item de départ à chaque joueur
    const playerStates = session.gameState?.playerStates || {};
    for (const playerId of Object.keys(playerStates)) {
      const playerState = playerStates[playerId];
      if (startingItem && playerState) {
        // Initialiser l'inventaire si nécessaire
        if (!playerState.inventory) {
          playerState.inventory = [];
        }
        // Ajouter l'item de départ
        this.gameLogicService.addItemToInventory(playerState, startingItem.id, 2);
      }
    }
    
    // Sauvegarder l'état mis à jour avec la seed, les events randomisés et l'item de départ
    await this.sessionsService.updateGameState((session as any)._id.toString(), {
      adventureSeed: adventureSeed,
      randomizedAdventure: {
        eventIds: randomized.eventIds,
        bossId: randomized.bossId,
      },
      currentEventIndex: 0,
      playerStates: playerStates,
    });
    
    // Envoyer l'état de jeu démarré avec les données randomisées
    this.server.to(data.sessionCode).emit('gameStarted', {
      gameState: {
        ...session.gameState,
        adventureSeed: adventureSeed,
        randomizedAdventure: {
          eventIds: randomized.eventIds,
          bossId: randomized.bossId,
        },
        currentEventIndex: 0,
      },
      adventureSeed: adventureSeed,
      currentEventIndex: 0,
      adventureId: session.adventureId,
      randomizedEventIds: randomized.eventIds,
      bossId: randomized.bossId,
      startingItemId: startingItem?.id,
    });
  }

  @SubscribeMessage('rollDice')
  async handleRollDice(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      sessionCode: string;
      sessionId: string;
      playerId: string;
      roll: { stat: string; isDouble: boolean };
    },
  ) {
    // Calculer le résultat du jet côté serveur si en combat
    const session = await this.sessionsService.findById(data.sessionId);
    if (session?.gameState?.combatState?.isActive) {
      const combatState = session.gameState.combatState;
      const playerState = session.gameState.playerStates?.[data.playerId];

      if (!playerState) {
        client.emit('error', { message: 'Player state not found' });
        return;
      }

      // Calculer le résultat préliminaire du jet (sans modifier l'état du combat)
      // Les requirements ne seront mis à jour que lors de la confirmation
      const rollCalculation = this.gameLogicService.calculateCombatRoll(
        data.roll,
        combatState.remainingRequirements || [],
        combatState.enemyDamage || 0,
        combatState.blockedTurnsRemaining || 0,
      );

      // Ne PAS sauvegarder l'état ici - on le fera seulement lors de confirmRoll
      // Cela évite de modifier les requirements avant que le joueur confirme son jet
      
      // Diffuser le résultat préliminaire du jet à tous les joueurs
      // Le rollResult contient le résultat calculé, mais l'état du combat n'est pas encore modifié
      this.server.to(data.sessionCode).emit('diceRolled', {
        playerId: data.playerId,
        roll: data.roll,
        rollResult: rollCalculation.result, // Résultat calculé côté serveur (préliminaire)
      });
    } else {
      // Pas en combat, juste diffuser le jet
      this.server.to(data.sessionCode).emit('diceRolled', {
        playerId: data.playerId,
        roll: data.roll,
      });
    }
  }

  @SubscribeMessage('confirmRoll')
  async handleConfirmRoll(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      sessionCode: string;
      sessionId: string;
      playerId: string;
      roll: { stat: string; isDouble: boolean }; // Le jet brut confirmé
    },
  ) {
    console.log('[GameGateway] confirmRoll received:', JSON.stringify(data));
    
    // Recalculer et appliquer le résultat côté serveur
    const session = await this.sessionsService.findById(data.sessionId);
    console.log('[GameGateway] Session found:', !!session);
    console.log('[GameGateway] Combat active:', session?.gameState?.combatState?.isActive);
    if (session && session.gameState?.combatState?.isActive) {
      const combatState = session.gameState.combatState;
      const playerState = session.gameState.playerStates?.[data.playerId];

      if (!playerState) {
        client.emit('error', { message: 'Player state not found' });
        return;
      }

      // S'assurer que remainingRequirements existe et est un tableau
      const remainingRequirements = combatState.remainingRequirements || [];
      if (!Array.isArray(remainingRequirements)) {
        console.error('[GameGateway] remainingRequirements is not an array:', remainingRequirements);
        client.emit('error', { message: 'Invalid combat state' });
        return;
      }

      console.log('[GameGateway] confirmRoll - remainingRequirements:', JSON.stringify(remainingRequirements));
      console.log('[GameGateway] confirmRoll - roll:', JSON.stringify(data.roll));
      console.log('[GameGateway] confirmRoll - combatState.remainingRequirements from DB:', JSON.stringify(combatState.remainingRequirements));

      // Recalculer le résultat du jet (source de vérité côté serveur)
      const rollCalculation = this.gameLogicService.calculateCombatRoll(
        data.roll,
        remainingRequirements,
        combatState.enemyDamage || 0,
        combatState.blockedTurnsRemaining || 0,
      );
      
      console.log('[GameGateway] confirmRoll - calculation result:', JSON.stringify({
        wasSuccessful: rollCalculation.result.wasSuccessful,
        successCount: rollCalculation.result.successCount,
        newRemainingRequirements: rollCalculation.newRemainingRequirements,
      }));

      // Appliquer les dégâts au joueur
      if (rollCalculation.result.damageTaken > 0) {
        // TODO: Calculer la réduction d'armure depuis l'inventaire
        const armorReduction = 0; // À implémenter
        this.gameLogicService.applyDamage(
          playerState,
          rollCalculation.result.damageTaken,
          armorReduction,
        );

        // Diffuser la mise à jour des HP
        this.server.to(data.sessionCode).emit('playerHpUpdated', {
          playerId: data.playerId,
          hp: playerState.currentHp,
        });

        // Si le joueur est mort (HP <= 0), terminer la partie
        if (playerState.currentHp <= 0) {
          console.log('[GameGateway] Player died, ending game');
          await this.sessionsService.endGame(data.sessionId, false);
          this.server.to(data.sessionCode).emit('gameEnded', {
            victory: false,
            reason: 'playerDeath',
            deadPlayerId: data.playerId,
          });
        }
      }

      // Mettre à jour l'état du combat
      const updatedCombatState = {
        ...combatState,
        remainingRequirements: rollCalculation.newRemainingRequirements,
        blockedTurnsRemaining: rollCalculation.newBlockedTurnsRemaining,
        currentRound: (combatState.currentRound || 1) + 1,
      };

      // Ajouter ce joueur à la liste des confirmés
      const confirmedPlayers = updatedCombatState.confirmedPlayers || [];
      if (!confirmedPlayers.includes(data.playerId)) {
        confirmedPlayers.push(data.playerId);
      }

      // Vérifier si tous les joueurs ont confirmé
      const allPlayersConfirmed = session.playerIds.every((pid) =>
        confirmedPlayers.includes(pid),
      );

      // Sauvegarder l'état mis à jour
      await this.sessionsService.updateGameState(data.sessionId, {
        playerStates: {
          ...session.gameState.playerStates,
          [data.playerId]: playerState,
        },
        combatState: {
          ...updatedCombatState,
          confirmedPlayers: confirmedPlayers,
        },
      });

      // Diffuser le résultat confirmé avec l'état de combat mis à jour
      // S'assurer que les requirements sont correctement formatés (sérialisation JSON)
      const formattedRequirements = rollCalculation.newRemainingRequirements.map((req) => ({
        stat: req.stat,
        count: req.count,
      }));
      
      this.server.to(data.sessionCode).emit('rollConfirmed', {
        playerId: data.playerId,
        rollResult: rollCalculation.result,
        combatState: {
          remainingRequirements: formattedRequirements,
          isVictory: rollCalculation.result.isVictory,
        },
      });
      
      console.log('[GameGateway] rollConfirmed emitted with requirements:', JSON.stringify(formattedRequirements));

      // Si tous les joueurs ont confirmé et que le combat continue, envoyer allRollsReady
      if (allPlayersConfirmed && !rollCalculation.result.isVictory) {
        // Réinitialiser la liste des confirmations pour le prochain round
        await this.sessionsService.updateGameState(data.sessionId, {
          combatState: {
            ...updatedCombatState,
            confirmedPlayers: [],
          },
        });

        this.server.to(data.sessionCode).emit('allRollsReady', {});
      } else if (rollCalculation.result.isVictory) {
        // Le combat est terminé, désactiver l'état de combat
        await this.sessionsService.updateGameState(data.sessionId, {
          combatState: {
            ...updatedCombatState,
            isActive: false,
          },
        });
      }
    } else {
      // Si pas de combat actif, diffuser normalement (ne devrait pas arriver normalement)
      this.server.to(data.sessionCode).emit('rollConfirmed', {
        playerId: data.playerId,
        rollResult: null,
      });
    }
  }

  @SubscribeMessage('updateGameState')
  async handleUpdateGameState(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      sessionCode: string;
      sessionId: string;
      gameState: any;
    },
  ) {
    await this.sessionsService.updateGameState(data.sessionId, data.gameState);
    this.server.to(data.sessionCode).emit('gameStateUpdated', {
      gameState: data.gameState,
    });
  }

  @SubscribeMessage('voteEventOpener')
  handleVoteEventOpener(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      sessionCode: string;
      voterId: string;
      votedForId: string;
    },
  ) {
    // Diffuser le vote à tous les joueurs
    this.server.to(data.sessionCode).emit('eventOpenerVoted', {
      voterId: data.voterId,
      votedForId: data.votedForId,
    });
  }

  @SubscribeMessage('selectEventOpener')
  handleSelectEventOpener(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      sessionCode: string;
      playerId: string;
    },
  ) {
    // Diffuser qui a été choisi pour ouvrir l'event
    this.server.to(data.sessionCode).emit('eventOpenerSelected', {
      playerId: data.playerId,
    });
  }

  @SubscribeMessage('combatStarted')
  async handleCombatStarted(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      sessionCode: string;
      sessionId: string;
      enemyId: string;
      enemyDamage: number;
      playerCount: number;
      baseRequirements?: Array<{ stat: string; count: number }>; // Requirements de base de l'ennemi
    },
  ) {
    // Générer les jets aléatoires côté serveur pour synchronisation
    // 1 jet aléatoire par joueur (Force, Dex ou Int)
    const stats = ['force', 'dexterite', 'intelligence'];
    const randomRequirements: string[] = [];
    
    // Utiliser une seed basée sur la session et l'ennemi pour garantir la même randomisation
    const seed = (data.sessionId + data.enemyId).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const random = this.seededRandom(seed);
    
    for (let i = 0; i < data.playerCount; i++) {
      const randomStat = stats[Math.floor(random() * stats.length)];
      randomRequirements.push(randomStat);
    }
    
    // Calculer les requirements complets (base + scaled)
    const remainingRequirements: Array<{ stat: string; count: number }> = [];
    
    // Ajouter les requirements de base
    if (data.baseRequirements) {
      for (const req of data.baseRequirements) {
        remainingRequirements.push({ stat: req.stat, count: req.count });
      }
    }
    
    // Ajouter les requirements aléatoires (1 par joueur)
    for (const randomStat of randomRequirements) {
      const existingReq = remainingRequirements.find((r) => r.stat === randomStat);
      if (existingReq) {
        existingReq.count += 1;
      } else {
        remainingRequirements.push({ stat: randomStat, count: 1 });
      }
    }
    
    // Sauvegarder dans le gameState avec les requirements complets
    const session = await this.sessionsService.findById(data.sessionId);
    if (session) {
      const combatState = this.gameLogicService.createCombatState(
        data.enemyId,
        data.enemyDamage,
        remainingRequirements,
        randomRequirements,
      );
      
      await this.sessionsService.updateGameState(data.sessionId, {
        combatState: combatState,
        scaledRandomRequirements: randomRequirements,
      });
    }
    
    // Diffuser le combat avec les requirements complets et les jets aléatoires
    // Utiliser emit() au lieu de to().emit() pour diffuser à TOUS les joueurs, y compris l'émetteur
    this.server.to(data.sessionCode).emit('combatStarted', {
      enemyId: data.enemyId,
      enemyDamage: data.enemyDamage,
      scaledRandomRequirements: randomRequirements,
      remainingRequirements: remainingRequirements, // Requirements complets depuis le serveur
    });
  }

  // Fonction pour générer un nombre aléatoire avec seed
  private seededRandom(seed: number): () => number {
    let value = seed;
    return () => {
      value = (value * 9301 + 49297) % 233280;
      return value / 233280;
    };
  }

  @SubscribeMessage('adventureSync')
  handleAdventureSync(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      sessionCode: string;
      adventure: any;
    },
  ) {
    // Diffuser l'aventure randomisée à tous les joueurs
    this.server.to(data.sessionCode).emit('adventureSynced', {
      adventure: data.adventure,
    });
  }

  @SubscribeMessage('nextTurn')
  handleNextTurn(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      sessionCode: string;
      nextPlayerId: string;
    },
  ) {
    this.server.to(data.sessionCode).emit('turnChanged', {
      currentPlayerId: data.nextPlayerId,
    });
  }

  @SubscribeMessage('eventChoice')
  async handleEventChoice(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      sessionCode: string;
      sessionId: string;
      playerId: string;
      choiceId: string;
      statCheckResult?: boolean;
      damage?: number; // Dégâts causés par l'événement (positif = dégâts, négatif = soin)
    },
  ) {
    const session = await this.sessionsService.findById(data.sessionId);
    if (!session || !session.gameState?.playerStates) {
      client.emit('error', { message: 'Session not found' });
      return;
    }

    // Si des dégâts doivent être appliqués, les appliquer côté serveur
    if (data.damage !== undefined && data.damage !== 0) {
      const playerState = session.gameState.playerStates[data.playerId];
      if (!playerState) {
        client.emit('error', { message: 'Player state not found' });
        return;
      }

      // Appliquer les dégâts (positif = dégâts, négatif = soin)
      if (data.damage > 0) {
        // TODO: Calculer la réduction d'armure depuis l'inventaire
        const armorReduction = 0; // À implémenter
        this.gameLogicService.applyDamage(
          playerState,
          data.damage,
          armorReduction,
        );
      } else {
        // Soin
        this.gameLogicService.healPlayer(playerState, -data.damage);
      }

      // Sauvegarder l'état mis à jour
      await this.sessionsService.updateGameState(data.sessionId, {
        playerStates: {
          ...session.gameState.playerStates,
          [data.playerId]: playerState,
        },
      });

      // Diffuser la mise à jour des HP
      this.server.to(data.sessionCode).emit('playerHpUpdated', {
        playerId: data.playerId,
        hp: playerState.currentHp,
      });

      // Si le joueur est mort, terminer la partie
      if (playerState.currentHp <= 0) {
        console.log('[GameGateway] Player died from event damage, ending game');
        await this.sessionsService.endGame(data.sessionId, false);
        this.server.to(data.sessionCode).emit('gameEnded', {
          victory: false,
          reason: 'playerDeath',
          deadPlayerId: data.playerId,
        });
      }
    }

    // Diffuser le choix à tous les clients
    // Chaque client appliquera l'outcome correspondant à ce choix
    this.server.to(data.sessionCode).emit('eventChoiceMade', {
      choiceId: data.choiceId,
      statCheckResult: data.statCheckResult,
    });
  }

  @SubscribeMessage('playerHpUpdate')
  handlePlayerHpUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      sessionCode: string;
      playerId: string;
      hp: number;
    },
  ) {
    // NOTE: Cette méthode est maintenant obsolète car les HP sont gérés côté serveur
    // Gardée pour compatibilité mais devrait être supprimée à terme
    // Diffuser la mise à jour des HP à tous les clients
    this.server.to(data.sessionCode).emit('playerHpUpdated', {
      playerId: data.playerId,
      hp: data.hp,
    });
  }

  @SubscribeMessage('useItem')
  async handleUseItem(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      sessionCode: string;
      sessionId: string;
      playerId: string;
      itemId: string;
      itemData: {
        healing?: number;
        forcedStat?: string;
        allowsReroll?: boolean;
      };
    },
  ) {
    const session = await this.sessionsService.findById(data.sessionId);
    if (!session) {
      client.emit('error', { message: 'Session not found' });
      return;
    }

    const playerState = session.gameState.playerStates?.[data.playerId];
    if (!playerState) {
      client.emit('error', { message: 'Player state not found' });
      return;
    }

    // Trouver l'item dans l'inventaire
    const item = playerState.inventory.find(
      (invItem) => invItem.itemId === data.itemId,
    );
    if (!item) {
      client.emit('error', { message: 'Item not found in inventory' });
      return;
    }

    console.log('[GameGateway] useItem - itemData:', JSON.stringify(data.itemData));
    console.log('[GameGateway] useItem - player HP before:', playerState.currentHp);

    // Utiliser l'item
    const result = this.gameLogicService.useConsumableItem(
      playerState,
      item,
      data.itemData,
    );

    console.log('[GameGateway] useItem - result:', JSON.stringify(result));
    console.log('[GameGateway] useItem - player HP after:', playerState.currentHp);

    if (!result.success) {
      client.emit('error', { message: 'Cannot use item' });
      return;
    }

    // Si l'item a été consommé (uses === 0), le retirer de l'inventaire
    if (item.uses !== undefined && item.uses <= 0) {
      this.gameLogicService.removeItemFromInventory(playerState, data.itemId);
    }

    // Sauvegarder l'état mis à jour
    await this.sessionsService.updateGameState(data.sessionId, {
      playerStates: {
        ...session.gameState.playerStates,
        [data.playerId]: playerState,
      },
    });

    // Diffuser les résultats
    // TOUJOURS émettre playerHpUpdated si itemData.healing était fourni et > 0
    if (data.itemData.healing !== undefined && data.itemData.healing > 0) {
      console.log('[GameGateway] Emitting playerHpUpdated (healing was requested):', playerState.currentHp, 'result.healing:', result.healing);
      this.server.to(data.sessionCode).emit('playerHpUpdated', {
        playerId: data.playerId,
        hp: playerState.currentHp,
      });
    } else if (result.healing !== undefined && result.healing > 0) {
      // Si result.healing est défini (c'est-à-dire que le healing a été appliqué), émettre aussi
      console.log('[GameGateway] Emitting playerHpUpdated (healing was applied):', playerState.currentHp, 'result.healing:', result.healing);
      this.server.to(data.sessionCode).emit('playerHpUpdated', {
        playerId: data.playerId,
        hp: playerState.currentHp,
      });
    }

    this.server.to(data.sessionCode).emit('itemUsed', {
      playerId: data.playerId,
      itemId: data.itemId,
      result: result,
    });

    this.server.to(data.sessionCode).emit('playerInventoryUpdated', {
      playerId: data.playerId,
      inventory: playerState.inventory,
    });
  }

  @SubscribeMessage('addItem')
  async handleAddItem(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      sessionCode: string;
      sessionId: string;
      playerId: string;
      itemId: string;
      maxInventorySize?: number;
    },
  ) {
    const session = await this.sessionsService.findById(data.sessionId);
    if (!session) {
      client.emit('error', { message: 'Session not found' });
      return;
    }

    const playerState = session.gameState.playerStates?.[data.playerId];
    if (!playerState) {
      client.emit('error', { message: 'Player state not found' });
      return;
    }

    // Ajouter l'item
    const result = this.gameLogicService.addItemToInventory(
      playerState,
      data.itemId,
      data.maxInventorySize || 2,
    );

    if (!result.success) {
      client.emit('itemAddFailed', {
        reason: result.inventoryFull ? 'inventory_full' : 'unknown',
      });
      return;
    }

    // Sauvegarder l'état mis à jour
    await this.sessionsService.updateGameState(data.sessionId, {
      playerStates: {
        ...session.gameState.playerStates,
        [data.playerId]: playerState,
      },
    });

    // Diffuser la mise à jour de l'inventaire
    this.server.to(data.sessionCode).emit('playerInventoryUpdated', {
      playerId: data.playerId,
      inventory: playerState.inventory,
    });
  }

  @SubscribeMessage('nextEvent')
  async handleNextEvent(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      sessionCode: string;
      sessionId: string;
    },
  ) {
    // Mettre à jour l'index d'événement sur le serveur
    const session = await this.sessionsService.findById(data.sessionId);
    if (!session) {
      client.emit('error', { message: 'Session not found' });
      return;
    }

    const currentIndex = session.gameState?.currentEventIndex ?? 0;
    await this.sessionsService.updateGameState(data.sessionId, {
      currentEventIndex: currentIndex + 1,
    });

    // Diffuser le nouvel index à tous les joueurs
    this.server.to(data.sessionCode).emit('eventChanged', {
      currentEventIndex: currentIndex + 1,
    });
  }

  @SubscribeMessage('gameOver')
  async handleGameOver(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      sessionCode: string;
      sessionId: string;
      victory: boolean;
    },
  ) {
    await this.sessionsService.endGame(data.sessionId, data.victory);
    this.server.to(data.sessionCode).emit('gameEnded', {
      victory: data.victory,
    });
  }

  @SubscribeMessage('chat')
  handleChat(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      sessionCode: string;
      playerId: string;
      message: string;
    },
  ) {
    this.server.to(data.sessionCode).emit('chatMessage', {
      playerId: data.playerId,
      message: data.message,
      timestamp: Date.now(),
    });
  }
}

