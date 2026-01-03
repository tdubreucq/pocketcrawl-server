import { Injectable } from '@nestjs/common';
import {
  CharacterData,
  EnemyData,
  EnemiesData,
  ItemData,
  ItemsData,
  GameEventData,
  EventsData,
  AdventureData,
  AdventureWithPools,
} from './types/game-data.types';
import { characters } from './data/characters.data';
import { enemies } from './data/enemies.data';
import { items } from './data/items.data';
import { events } from './data/events.data';
import { adventures as adventuresData } from './data/adventures.data';

/**
 * Service pour charger et gérer les données de jeu (adventures, events, enemies, characters, items)
 * Les données sont chargées depuis les fichiers TypeScript typés dans ./data/
 */
@Injectable()
export class DataService {
  private _characters: Map<string, CharacterData> | null = null;
  private _enemies: Map<string, EnemyData> | null = null;
  private _items: Map<string, ItemData> | null = null;
  private _events: Map<string, GameEventData[]> | null = null;
  private _adventures: Map<string, AdventureWithPools> | null = null;

  /**
   * Charge tous les personnages depuis les données TypeScript
   */
  async loadCharacters(): Promise<Map<string, CharacterData>> {
    if (this._characters) return this._characters;

    this._characters = new Map();
    for (const char of characters) {
      this._characters.set(char.id, char);
    }
    
    return this._characters;
  }

  /**
   * Récupère un personnage par ID
   */
  async getCharacter(id: string): Promise<CharacterData | null> {
    const characters = await this.loadCharacters();
    return characters.get(id) || null;
  }

  /**
   * Charge tous les ennemis depuis les données TypeScript
   */
  async loadEnemies(): Promise<Map<string, EnemyData>> {
    if (this._enemies) return this._enemies;

    this._enemies = new Map();
    
    // Load standard enemies
    if (enemies.standard) {
      for (const enemy of enemies.standard) {
        this._enemies.set(enemy.id, enemy);
      }
    }
    
    // Load bosses
    if (enemies.bosses) {
      for (const enemy of enemies.bosses) {
        this._enemies.set(enemy.id, enemy);
      }
    }
    
    return this._enemies;
  }

  /**
   * Récupère un ennemi par ID
   */
  async getEnemy(id: string): Promise<EnemyData | null> {
    const enemies = await this.loadEnemies();
    return enemies.get(id) || null;
  }

  /**
   * Charge tous les items depuis les données TypeScript
   */
  async loadItems(): Promise<Map<string, ItemData>> {
    if (this._items) return this._items;

    this._items = new Map();
    if (items.items) {
      for (const item of items.items) {
        this._items.set(item.id, item);
      }
    }
    
    return this._items;
  }

  /**
   * Récupère un item par ID
   */
  async getItem(id: string): Promise<ItemData | null> {
    const items = await this.loadItems();
    return items.get(id) || null;
  }

  /**
   * Charge tous les événements depuis les données TypeScript
   */
  async loadEvents(): Promise<Map<string, GameEventData[]>> {
    if (this._events) return this._events;

    this._events = new Map();
    
    // Les events ont la structure: { "adventures": { "crypte": [...], "foret_maudite": [...] } }
    if (events.adventures) {
      for (const [key, value] of Object.entries(events.adventures)) {
        this._events.set(key, value);
      }
    }
    
    if (this._events) {
      console.log('[DataService] Loaded events:', Array.from(this._events.keys()).map(k => {
        const eventList = this._events!.get(k);
        return `${k}: ${eventList?.length || 0} events`;
      }));
    }
    
    return this._events;
  }

  /**
   * Charge toutes les aventures depuis les données TypeScript
   * Construit les eventPools et bossPools depuis les données
   */
  async loadAdventures(): Promise<Map<string, AdventureWithPools>> {
    if (this._adventures) return this._adventures;

    // Charger les events et enemies nécessaires
    const eventsMap = await this.loadEvents();
    const enemiesMap = await this.loadEnemies();
    
    this._adventures = new Map();
    for (const adventureData of adventuresData) {
      // Construire eventPool depuis eventsKey
      const eventPool: GameEventData[] = [];
      if (adventureData.eventsKey) {
        const adventureEvents = eventsMap.get(adventureData.eventsKey) || [];
        eventPool.push(...adventureEvents);
      }
      
      // Construire bossPool depuis bossIds
      const bossPool: EnemyData[] = [];
      if (adventureData.bossIds) {
        for (const bossId of adventureData.bossIds) {
          const boss = enemiesMap.get(bossId);
          if (boss) {
            bossPool.push(boss);
          }
        }
      }
      
      // Créer l'aventure complète
      const adventure: AdventureWithPools = {
        ...adventureData,
        eventPool,
        bossPool,
      };
      
      console.log(`[DataService] Loaded adventure ${adventure.id}:`, {
        eventsKey: adventureData.eventsKey,
        eventPoolSize: eventPool.length,
        bossPoolSize: bossPool.length,
        eventCount: adventureData.eventCount,
      });
      
      this._adventures.set(adventure.id, adventure);
    }
    
    return this._adventures;
  }

  /**
   * Récupère une aventure par ID
   */
  async getAdventure(id: string): Promise<AdventureWithPools | null> {
    const adventures = await this.loadAdventures();
    return adventures.get(id) || null;
  }

  /**
   * Randomise une aventure avec une seed donnée
   * Retourne un objet avec les eventIds sélectionnés (dans l'ordre) et le bossId
   */
  randomizeAdventure(adventure: AdventureWithPools, seed: number): {
    eventIds: string[];
    bossId: string;
  } {
    // Simple seeded random (même algorithme que côté client Dart)
    const rng = this.seededRandom(seed);
    
    // Vérifier que l'aventure a bien un eventPool
    if (!adventure.eventPool || adventure.eventPool.length === 0) {
      console.error('[DataService] Adventure eventPool is empty!', adventure.id);
      return {
        eventIds: [],
        bossId: adventure.bossPool?.[0]?.id || '',
      };
    }
    
    // Trier les events par ID pour garantir le même ordre initial
    const sortedPool = [...adventure.eventPool].sort((a, b) => 
      a.id.localeCompare(b.id)
    );
    
    console.log(`[DataService] Randomizing adventure ${adventure.id} with ${sortedPool.length} events, seed: ${seed}`);
    
    // Shuffle avec la seed
    const shuffled = this.shuffleArray([...sortedPool], rng);
    
    // Prendre tous les events (comme côté client)
    const eventIds = shuffled.map((e) => e.id);
    
    console.log(`[DataService] Randomized ${eventIds.length} events:`, eventIds);
    
    // Sélectionner un boss aléatoire
    const sortedBossPool = [...adventure.bossPool].sort((a, b) => 
      a.id.localeCompare(b.id)
    );
    if (sortedBossPool.length === 0) {
      console.error('[DataService] Adventure bossPool is empty!', adventure.id);
      return {
        eventIds,
        bossId: '',
      };
    }
    const bossIndex = Math.floor(rng() * sortedBossPool.length);
    const bossId = sortedBossPool[bossIndex].id;
    
    console.log(`[DataService] Selected boss: ${bossId}`);
    
    return {
      eventIds,
      bossId,
    };
  }

  /**
   * Récupère un event par ID depuis une clé d'aventure
   */
  async getEventById(eventsKey: string, eventId: string): Promise<GameEventData | null> {
    const eventsMap = await this.loadEvents();
    const events = eventsMap.get(eventsKey) || [];
    return events.find((e) => e.id === eventId) || null;
  }

  /**
   * Récupère tous les events d'une aventure (par eventsKey)
   */
  async getAdventureEvents(eventsKey: string): Promise<GameEventData[]> {
    const eventsMap = await this.loadEvents();
    return eventsMap.get(eventsKey) || [];
  }

  /**
   * Génère un item aléatoire (pour l'item de départ)
   */
  async getRandomItem(): Promise<ItemData | null> {
    const items = await this.loadItems();
    const itemList = Array.from(items.values());
    
    if (itemList.length === 0) return null;
    
    // Simple random (peut être amélioré avec un système de poids)
    const randomIndex = Math.floor(Math.random() * itemList.length);
    return itemList[randomIndex];
  }

  /**
   * Crée un générateur de nombres aléatoires avec seed (compatible avec Dart Random)
   */
  private seededRandom(seed: number): () => number {
    let value = seed;
    return () => {
      value = (value * 9301 + 49297) % 233280;
      return value / 233280;
    };
  }

  /**
   * Shuffle un array avec un générateur de nombres aléatoires
   */
  private shuffleArray<T>(array: T[], rng: () => number): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}

