import { describe, expect, it } from 'vitest';
import { DomainError } from '@sigac/domain-kernel';
import { ExpedienteId } from './ExpedienteId.js';

describe('ExpedienteId', () => {
  it('construye la identidad técnica desde un UUID', () => {
    const id = ExpedienteId.parse('9b2d3958-f383-4c53-9041-09172fdd408f');

    expect(id.toString()).toBe('9b2d3958-f383-4c53-9041-09172fdd408f');
  });

  it('compara por valor y normaliza mayúsculas de la representación UUID', () => {
    const lower = ExpedienteId.parse('9b2d3958-f383-4c53-9041-09172fdd408f');
    const upper = ExpedienteId.parse('9B2D3958-F383-4C53-9041-09172FDD408F');

    expect(lower.equals(upper)).toBe(true);
  });

  it.each(['', 'e1', '9b2d3958f3834c53904109172fdd408f'])(
    'rechaza una identidad que no sea UUID: "%s"',
    (value) => {
      expect(() => ExpedienteId.parse(value)).toThrow(DomainError);
    },
  );
});
