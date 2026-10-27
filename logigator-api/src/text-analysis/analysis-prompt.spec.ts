import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  analysisRetryMessage,
  analysisUserMessage,
  TEXT_ANALYSIS_SYSTEM_PROMPT
} from './analysis-prompt';
import { ANALYSIS_REPLY_JSON_SCHEMA } from './analysis-reply';

const sha256 = (text: string) =>
  createHash('sha256').update(text).digest('hex');

/**
 * The system prompt and the reply schema were tuned against a run of real
 * translation and moderation cases, and together they are the cached prefix
 * whose length the prompt cache depends on. Both are assembled from sections
 * in three folders, so an edit to any section changes what the model reads. A
 * change needs the cases run again, and then the new hash here.
 */
describe('the text analysis request', () => {
  it('sends the evaluated system prompt', () => {
    expect(sha256(TEXT_ANALYSIS_SYSTEM_PROMPT)).toBe(
      'c03eddd17e9268b3540a02477d27f5a6c47948105176b18b5dfb5537d830a57b'
    );
  });

  it('asks for the evaluated reply schema', () => {
    expect(sha256(JSON.stringify(ANALYSIS_REPLY_JSON_SCHEMA))).toBe(
      '987dd5e3893e15d7ea91b7460c26e5cb5db88f380b1efcbe1775f589aec31365'
    );
  });

  it('sends the document and a retry in the evaluated form', () => {
    expect(
      analysisUserMessage({
        name: 'Adder',
        description: 'A *full* adder.',
        hint: 'de',
        versions: [{ language: 'en', name: 'Adder', description: null }]
      })
    ).toBe(
      '{"name":"Adder","description":"A *full* adder.","hint":"de","versions":[{"language":"en","name":"Adder","description":null}]}'
    );
    expect(analysisRetryMessage('the reply is not JSON')).toBe(
      'Your previous reply was rejected: the reply is not JSON. Reply again with the complete JSON.'
    );
  });
});
