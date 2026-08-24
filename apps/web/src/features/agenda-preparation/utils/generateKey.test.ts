/**
 * Tests for generateKey — crypto compatibility fallback.
 *
 * Three paths must be covered:
 *   1. crypto.randomUUID available → used directly.
 *   2. crypto.randomUUID absent, getRandomValues present → RFC 4122 v4 UUID generated.
 *   3. No crypto source → throws TypeError (fail-closed, never Math.random()).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateKey } from './generateKey';

// UUID v4 pattern: xxxxxxxx-xxxx-4xxx-[89ab]xxx-xxxxxxxxxxxx
const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// Helpers to control the global crypto object in tests
// ---------------------------------------------------------------------------

let originalCrypto: Crypto;

beforeEach(() => {
  // jsdom provides globalThis.crypto — save it before each test
  originalCrypto = globalThis.crypto;
});

afterEach(() => {
  // Restore after every test regardless of what the test did
  Object.defineProperty(globalThis, 'crypto', {
    value: originalCrypto,
    configurable: true,
    writable: true,
  });
});

function setCrypto(value: unknown) {
  Object.defineProperty(globalThis, 'crypto', {
    value,
    configurable: true,
    writable: true,
  });
}

// ---------------------------------------------------------------------------
// Path 1 — crypto.randomUUID available
// ---------------------------------------------------------------------------

describe('generateKey — crypto.randomUUID available', () => {
  it('returns the value produced by crypto.randomUUID', () => {
    const fixed = '11111111-2222-4333-8444-555555555555';
    setCrypto({ ...originalCrypto, randomUUID: vi.fn().mockReturnValue(fixed) });

    expect(generateKey()).toBe(fixed);
  });

  it('produces a different key on each call (entropy comes from crypto)', () => {
    // Use the real crypto.randomUUID via jsdom — two calls must differ
    const k1 = generateKey();
    const k2 = generateKey();
    expect(k1).not.toBe(k2);
  });

  it('result matches UUID v4 pattern', () => {
    expect(generateKey()).toMatch(UUID_V4_REGEX);
  });
});

// ---------------------------------------------------------------------------
// Path 2 — crypto.randomUUID absent, getRandomValues present
// ---------------------------------------------------------------------------

describe('generateKey — randomUUID absent, getRandomValues present', () => {
  beforeEach(() => {
    // crypto methods are on the prototype and are NOT enumerable — spread doesn't copy them.
    // We need to build an explicit object with getRandomValues bound to the real implementation,
    // and explicitly exclude randomUUID so our fallback path is exercised.
    const realGetRandomValues = originalCrypto.getRandomValues.bind(originalCrypto);
    setCrypto({
      // No randomUUID property — triggers Path 2
      getRandomValues: realGetRandomValues,
    });
  });

  it('generates a UUID without throwing', () => {
    expect(() => generateKey()).not.toThrow();
  });

  it('result matches UUID v4 pattern', () => {
    expect(generateKey()).toMatch(UUID_V4_REGEX);
  });

  it('result has correct version nibble (4)', () => {
    const key = generateKey();
    // Position 14 is the version character in 'xxxxxxxx-xxxx-Vxxx-...'
    expect(key[14]).toBe('4');
  });

  it('result has correct variant bits ([89ab] at position 19)', () => {
    const key = generateKey();
    // Position 19 is the first character of the 4th group
    expect(['8', '9', 'a', 'b']).toContain(key[19]);
  });

  it('produces distinct keys on successive calls', () => {
    const keys = new Set(Array.from({ length: 10 }, () => generateKey()));
    expect(keys.size).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// Path 3 — no crypto source at all (fail-closed)
// ---------------------------------------------------------------------------

describe('generateKey — no crypto source (fail-closed)', () => {
  it('throws TypeError when crypto is undefined', () => {
    setCrypto(undefined);
    expect(() => generateKey()).toThrow(TypeError);
  });

  it('throws TypeError when crypto has neither randomUUID nor getRandomValues', () => {
    setCrypto({});
    expect(() => generateKey()).toThrow(TypeError);
  });

  it('error message mentions secure context', () => {
    setCrypto(undefined);
    expect(() => generateKey()).toThrow(/secure context/i);
  });

  it('never uses Math.random as a fallback (Math.random is not called)', () => {
    setCrypto(undefined);
    const spy = vi.spyOn(Math, 'random');
    try {
      generateKey();
    } catch {
      // expected
    }
    expect(spy).not.toHaveBeenCalled();
  });
});
