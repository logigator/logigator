import { Gauge, Registry } from '@prometheus-io/client';
import { documentVisibility } from '../database/schema';

export type DocumentKind = 'project' | 'component';
export type Visibility = (typeof documentVisibility.enumValues)[number];

/** The documents of one kind, visibility and hidden state. */
export interface DocumentGroup {
  kind: DocumentKind;
  visibility: Visibility;
  hidden: boolean;
  count: number;
}

/** What `stats.js` reports, the examples account left out. */
export interface Stats {
  users: Record<'verified' | 'unverified', number>;
  /** Only the groups that hold a document; the rest are reported as zero. */
  documents: DocumentGroup[];
  stars: number;
  openReports: Record<'human' | 'machine', number>;
  textsAwaitingCheck: number;
  textsParked: number;
  storageBytes: Record<'documents' | 'previews', number>;
}

const KINDS: readonly DocumentKind[] = ['project', 'component'];

/**
 * The stats as gauges on a registry of their own. Every label combination is
 * set, zeros included, so a series never vanishes when its count drops to
 * nothing.
 */
export function statsRegistry(stats: Stats): Registry {
  const registry = new Registry();
  const registers = [registry];

  const users = new Gauge({
    name: 'logigator_users',
    help: 'Accounts, by whether their address is verified.',
    labelNames: ['state'] as const,
    registers
  });
  for (const [state, value] of Object.entries(stats.users)) {
    users.set({ state }, value);
  }

  const documents = new Gauge({
    name: 'logigator_documents',
    help: 'Projects and components, by kind, visibility and whether moderation hid them.',
    labelNames: ['kind', 'visibility', 'hidden'] as const,
    registers
  });
  for (const kind of KINDS) {
    for (const visibility of documentVisibility.enumValues) {
      for (const hidden of [false, true]) {
        const group = stats.documents.find(
          (g) =>
            g.kind === kind &&
            g.visibility === visibility &&
            g.hidden === hidden
        );
        documents.set(
          { kind, visibility, hidden: String(hidden) },
          group?.count ?? 0
        );
      }
    }
  }

  new Gauge({
    name: 'logigator_stars',
    help: 'Stars on projects and components.',
    registers
  }).set(stats.stars);

  const reports = new Gauge({
    name: 'logigator_document_reports_open',
    help: 'Document reports not yet resolved, by source (human, machine).',
    labelNames: ['source'] as const,
    registers
  });
  for (const [source, value] of Object.entries(stats.openReports)) {
    reports.set({ source }, value);
  }

  new Gauge({
    name: 'logigator_texts_awaiting_check',
    help: 'Public documents whose current text waits for its check, while text analysis runs.',
    registers
  }).set(stats.textsAwaitingCheck);

  new Gauge({
    name: 'logigator_texts_parked',
    help: 'Texts the analysis worker gave up on until they change.',
    registers
  }).set(stats.textsParked);

  const storage = new Gauge({
    name: 'logigator_storage_bytes',
    help: 'Bytes counted against storage quotas, by type (documents, previews).',
    labelNames: ['type'] as const,
    registers
  });
  for (const [type, value] of Object.entries(stats.storageBytes)) {
    storage.set({ type }, value);
  }

  return registry;
}
