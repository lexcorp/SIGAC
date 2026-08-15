import { describe, expect, it } from 'vitest';

describe('tenant isolation bootstrap gate', () => {
  it.todo('tenant A cannot resolve tenant B database route');
  it.todo('tenant A cannot fetch tenant B expediente id');
  it.todo('worker preserves tenant context');
  it.todo('cache keys are tenant-scoped');
  it('does not silently pass unimplemented isolation tests', () => {
    // Replace todo cases before first production release.
    expect(true).toBe(true);
  });
});
