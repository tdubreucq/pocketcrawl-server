import { Controller, Get, Param } from '@nestjs/common';
import { DataService } from './data.service';

@Controller('data')
export class DataController {
  constructor(private readonly dataService: DataService) {}

  @Get('characters')
  async getCharacters() {
    const characters = await this.dataService.loadCharacters();
    return Array.from(characters.values());
  }

  @Get('characters/:id')
  async getCharacter(@Param('id') id: string) {
    const character = await this.dataService.getCharacter(id);
    if (!character) {
      return null;
    }
    return character;
  }

  @Get('adventures')
  async getAdventures() {
    const adventures = await this.dataService.loadAdventures();
    // Retourner seulement les métadonnées (sans eventPool et bossPool complets pour réduire la taille)
    return Array.from(adventures.values()).map((adv) => ({
      id: adv.id,
      name: adv.name,
      description: adv.description,
      imageAsset: adv.imageAsset,
      eventsKey: adv.eventsKey,
      eventCount: adv.eventCount,
      bossIds: adv.bossIds,
    }));
  }

  @Get('adventures/:id')
  async getAdventure(@Param('id') id: string) {
    const adventure = await this.dataService.getAdventure(id);
    if (!adventure) {
      return null;
    }
    // Retourner seulement les métadonnées (sans eventPool et bossPool complets)
    return {
      id: adventure.id,
      name: adventure.name,
      description: adventure.description,
      imageAsset: adventure.imageAsset,
      eventsKey: adventure.eventsKey,
      eventCount: adventure.eventCount,
      bossIds: adventure.bossIds,
    };
  }

  @Get('enemies')
  async getEnemies() {
    const enemies = await this.dataService.loadEnemies();
    return Array.from(enemies.values());
  }

  @Get('enemies/all')
  async getAllEnemies() {
    // Endpoint pour charger tous les ennemis d'un coup (utile pour le client)
    const enemies = await this.dataService.loadEnemies();
    return Array.from(enemies.values());
  }

  @Get('enemies/:id')
  async getEnemy(@Param('id') id: string) {
    const enemy = await this.dataService.getEnemy(id);
    if (!enemy) {
      return null;
    }
    return enemy;
  }

  @Get('items')
  async getItems() {
    const items = await this.dataService.loadItems();
    return Array.from(items.values());
  }

  @Get('items/all')
  async getAllItems() {
    // Endpoint pour charger tous les items d'un coup (utile pour le client)
    const items = await this.dataService.loadItems();
    return Array.from(items.values());
  }

  @Get('items/:id')
  async getItem(@Param('id') id: string) {
    const item = await this.dataService.getItem(id);
    if (!item) {
      return null;
    }
    return item;
  }

  @Get('events')
  async getEvents() {
    const events = await this.dataService.loadEvents();
    // Retourner tous les events groupés par clé
    const result: Record<string, any[]> = {};
    for (const [key, value] of events.entries()) {
      result[key] = value;
    }
    return result;
  }

  @Get('events/:key')
  async getEventsByKey(@Param('key') key: string) {
    const events = await this.dataService.getAdventureEvents(key);
    return events;
  }

  @Get('events/:key/:id')
  async getEventById(
    @Param('key') key: string,
    @Param('id') id: string,
  ) {
    const event = await this.dataService.getEventById(key, id);
    if (!event) {
      return null;
    }
    return event;
  }
}

