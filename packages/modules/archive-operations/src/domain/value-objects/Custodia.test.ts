import { describe, expect, it } from 'vitest';
import { Custodia } from './Custodia.js';

const props = {
  custodianType: 'SERVICIO',
  custodianReference: 'servicio-1',
  service: 'Consulta externa',
  location: 'Consultorio 1',
} as const;

describe('Custodia', () => {
  it('representa una custodia no aceptada con acceptedAt null', () => {
    const custodia = Custodia.enTraslado(props);

    expect(custodia.acceptedAt).toBeNull();
    expect(custodia.estaAceptada).toBe(false);
  });

  it('representa una custodia aceptada con timestamp', () => {
    const acceptedAt = new Date('2026-08-14T12:00:00.000Z');
    const custodia = Custodia.aceptada({ ...props, acceptedAt });

    expect(custodia.acceptedAt).toEqual(acceptedAt);
    expect(custodia.estaAceptada).toBe(true);
  });

  it('compara por valor y protege el timestamp frente a mutaciones externas', () => {
    const acceptedAt = new Date('2026-08-14T12:00:00.000Z');
    const custodia = Custodia.aceptada({ ...props, acceptedAt });
    const igual = Custodia.aceptada({ ...props, acceptedAt: new Date(acceptedAt) });

    acceptedAt.setUTCFullYear(2030);
    custodia.acceptedAt?.setUTCFullYear(2031);

    expect(custodia.equals(igual)).toBe(true);
  });
});
