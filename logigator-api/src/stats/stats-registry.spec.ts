import { describe, expect, it } from 'vitest';
import { statsRegistry, type Stats } from './stats-registry';

function stats(overrides: Partial<Stats> = {}): Stats {
  return {
    users: { verified: 0, unverified: 0 },
    documents: [],
    stars: 0,
    openReports: { human: 0, machine: 0 },
    textsAwaitingCheck: 0,
    textsParked: 0,
    storageBytes: { documents: 0, previews: 0 },
    ...overrides
  };
}

function series(text: string, name: string): string[] {
  return text
    .split('\n')
    .filter(
      (line) => line.startsWith(`${name}{`) || line.startsWith(`${name} `)
    );
}

describe('statsRegistry', () => {
  it('reports every document combination, zeros included', async () => {
    const text = await statsRegistry(
      stats({
        documents: [
          { kind: 'component', visibility: 'public', hidden: true, count: 4 }
        ]
      })
    ).metrics();

    const documents = series(text, 'logigator_documents');
    expect(documents).toHaveLength(12);
    expect(documents).toContain(
      'logigator_documents{kind="component",visibility="public",hidden="true"} 4'
    );
    expect(documents).toContain(
      'logigator_documents{kind="project",visibility="private",hidden="false"} 0'
    );
    expect(documents.filter((line) => !line.endsWith(' 0'))).toHaveLength(1);
  });
});
