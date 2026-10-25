import { describe, expect, it } from 'vitest';
import { failureKeys } from './login-attempts.service';

describe('failureKeys', () => {
  it('keys one mailbox once, however its address is spelled', () => {
    expect(failureKeys('192.0.2.1', ' Ada@Example.COM ')).toEqual(
      failureKeys('192.0.2.1', 'ada@example.com')
    );
  });

  it('keeps the address out of every key', () => {
    for (const key of failureKeys('192.0.2.1', 'ada@example.com')) {
      expect(key).not.toContain('ada');
      expect(key).not.toContain('example');
    }
  });

  it('shares the address budget across accounts but not across addresses', () => {
    const [adaHere, here] = failureKeys('192.0.2.1', 'ada@example.com');
    const [graceHere, hereToo] = failureKeys('192.0.2.1', 'grace@example.com');
    const [adaThere, there] = failureKeys('192.0.2.2', 'ada@example.com');

    expect(hereToo).toBe(here);
    expect(graceHere).not.toBe(adaHere);
    expect(adaThere).not.toBe(adaHere);
    expect(there).not.toBe(here);
  });
});
