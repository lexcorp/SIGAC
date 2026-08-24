/**
 * generateKey — cryptographically secure UUID v4 generator.
 *
 * Priority order (fail-closed):
 *   1. crypto.randomUUID()        — available in modern browsers and secure contexts.
 *   2. crypto.getRandomValues()   — available in older browsers (IE11+, non-HTTPS contexts).
 *   3. throws                     — never silently falls back to Math.random().
 *
 * Idempotency keys must be opaque and unguessable; Math.random() is explicitly
 * excluded as a source of randomness.
 */

function uuidFromRandomValues(): string {
  const bytes = new Uint8Array(16);
  // getRandomValues is defined on both window.crypto and globalThis.crypto
  (crypto as Crypto).getRandomValues(bytes);
  // Set version = 4 (RFC 4122 §4.4)
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  // Set variant = 10xx (RFC 4122 §4.1.1)
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;

  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

/**
 * Returns a new UUID v4 suitable for use as an idempotency key.
 * @throws {TypeError} if no cryptographically secure random source is available.
 */
export function generateKey(): string {
  // Path 1: modern browsers & secure contexts
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // Path 2: older browsers with getRandomValues but without randomUUID
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    return uuidFromRandomValues();
  }

  // Path 3: no secure source — fail closed, never fall back to Math.random()
  throw new TypeError(
    'No cryptographically secure random source available. ' +
      'Ensure the application runs in a secure context (HTTPS or localhost).',
  );
}
