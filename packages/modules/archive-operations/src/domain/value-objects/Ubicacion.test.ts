import { describe, expect, it } from 'vitest';
import { Ubicacion } from './Ubicacion.js';

describe('Ubicacion', () => {
  it('construye el valor con id, código y descripción', () => {
    const ubicacion = Ubicacion.create({ id: 'u-1', codigo: 'A-01', descripcion: 'Anaquel 1' });

    expect(ubicacion.toString()).toBe('A-01 — Anaquel 1');
  });

  it('compara todos sus componentes por valor', () => {
    const base = Ubicacion.create({ id: 'u-1', codigo: 'A-01', descripcion: 'Anaquel 1' });
    const igual = Ubicacion.create({ id: 'u-1', codigo: 'A-01', descripcion: 'Anaquel 1' });
    const distintaDescripcion = Ubicacion.create({
      id: 'u-1',
      codigo: 'A-01',
      descripcion: 'Anaquel actualizado',
    });

    expect(base.equals(igual)).toBe(true);
    expect(base.equals(distintaDescripcion)).toBe(false);
  });
});
