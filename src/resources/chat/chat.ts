import type { APIClient } from '../../core/api.js';
import { APIResource } from '../resource.js';
import { Completions } from './completions.js';

export class Chat extends APIResource {
  completions: Completions;

  constructor(client: APIClient) {
    super(client);
    this.completions = new Completions(client);
  }
}
