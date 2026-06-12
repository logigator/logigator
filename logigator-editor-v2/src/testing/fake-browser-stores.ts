import {
  StoredBrowserComponent,
  StoredBrowserProject
} from '../app/persistence/browser/browser-project.types';

/** In-memory stand-in for {@link BrowserProjectStore} (which uses IndexedDB). */
export class FakeBrowserProjectStore {
  readonly records = new Map<string, StoredBrowserProject>();
  private _counter = 0;

  async save(params: {
    id?: string;
    name: string;
    content: string;
  }): Promise<StoredBrowserProject> {
    const id = params.id ?? `browser-id-${++this._counter}`;
    const existing = params.id ? this.records.get(params.id) : undefined;
    const now = 1000 + ++this._counter;
    const record: StoredBrowserProject = {
      id,
      name: params.name,
      createdOn: existing?.createdOn ?? now,
      lastEdited: now,
      content: params.content
    };
    this.records.set(id, record);
    return record;
  }

  async get(id: string): Promise<StoredBrowserProject | undefined> {
    return this.records.get(id);
  }

  async list() {
    return [...this.records.values()].map(
      ({ id, name, createdOn, lastEdited }) => ({
        id,
        name,
        createdOn,
        lastEdited
      })
    );
  }

  async delete(id: string): Promise<void> {
    this.records.delete(id);
  }
}

/** In-memory stand-in for {@link BrowserComponentStore} (which uses IndexedDB). */
export class FakeBrowserComponentStore {
  readonly records = new Map<string, StoredBrowserComponent>();
  private _counter = 0;

  async save(params: {
    id?: string;
    version: number;
    name: string;
    symbol: string;
    description: string;
    numInputs: number;
    numOutputs: number;
    labels: string[];
    content: string;
  }): Promise<StoredBrowserComponent> {
    const id = params.id ?? `comp-id-${++this._counter}`;
    const existing = params.id ? this.records.get(params.id) : undefined;
    const now = 1000 + ++this._counter;
    const record: StoredBrowserComponent = {
      id,
      version: params.version,
      name: params.name,
      symbol: params.symbol,
      description: params.description,
      numInputs: params.numInputs,
      numOutputs: params.numOutputs,
      labels: [...params.labels],
      createdOn: existing?.createdOn ?? now,
      lastEdited: now,
      content: params.content
    };
    this.records.set(id, record);
    return record;
  }

  async get(id: string): Promise<StoredBrowserComponent | undefined> {
    return this.records.get(id);
  }

  async list() {
    return [...this.records.values()];
  }

  async delete(id: string): Promise<void> {
    this.records.delete(id);
  }
}
