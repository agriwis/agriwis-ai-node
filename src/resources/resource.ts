import type { APIClient } from '../core/api.js';

/** 资源基类：持有底层 APIClient 实例 */
export class APIResource {
  protected readonly _client: APIClient;

  constructor(client: APIClient) {
    this._client = client;
  }
}
