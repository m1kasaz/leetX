import { describe, expect, it } from 'vitest';
import { sha256Hex } from './hash';

describe('sha256Hex', () => {
  it('returns deterministic 64-character hashes', async () => {
    const first = await sha256Hex('print(1)');
    expect(first).toBe(await sha256Hex('print(1)'));
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(first).not.toBe(await sha256Hex('print(2)'));
  });
});
