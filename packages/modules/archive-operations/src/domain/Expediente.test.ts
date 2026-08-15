import { describe, expect, it } from 'vitest';
import { Expediente } from './Expediente.js';

describe('Expediente', () => {
  it('rehydrates an operational snapshot', () => {
    const expediente = Expediente.rehydrate({
      id: 'e1',
      expedienteNumero: 'DEMO-0001',
      estadoOperativo: 'DISPONIBLE',
      rowVersion: 1,
    });
    expect(expediente.snapshot().expedienteNumero).toBe('DEMO-0001');
  });
});
