import { DomainError } from '@sigac/domain-kernel';
import { describe, expect, it } from 'vitest';
import { Expediente, type ExpedienteSnapshot } from './Expediente.js';
import { Custodia, ExpedienteId, ExpedienteNumero, Ubicacion } from './value-objects/index.js';

function snapshot(overrides: Partial<ExpedienteSnapshot> = {}): ExpedienteSnapshot {
  return {
    id: ExpedienteId.parse('9b2d3958-f383-4c53-9041-09172fdd408f'),
    expedienteNumero: ExpedienteNumero.parse('PERR810604/10'),
    pacienteReferencia: {
      idInstitucional: 'paciente-sintetico-1',
      curp: 'CURP-SINTETICA',
      nombreOperativo: 'Paciente Sintético',
      numeroIssste: 'ISSSTE-SINTETICO',
    },
    hospitalId: 'hospital-1',
    estadoOperativo: 'DISPONIBLE',
    ubicacionActual: Ubicacion.create({
      id: 'ubicacion-1',
      codigo: 'A-01',
      descripcion: 'Anaquel 1',
    }),
    custodiaActual: null,
    rowVersion: 0n,
    ...overrides,
  };
}

describe('Expediente', () => {
  it('rehidrata una situación operativa válida con todos sus campos', () => {
    const input = snapshot();
    const current = Expediente.rehydrate(input).snapshot();

    expect(current.id.equals(input.id)).toBe(true);
    expect(current.expedienteNumero.equals(input.expedienteNumero)).toBe(true);
    expect(current.pacienteReferencia).toEqual(input.pacienteReferencia);
    expect(current.hospitalId).toBe('hospital-1');
    expect(current.estadoOperativo).toBe('DISPONIBLE');
    expect(current.ubicacionActual?.equals(input.ubicacionActual!)).toBe(true);
    expect(current.custodiaActual).toBeNull();
    expect(current.rowVersion).toBe(0n);
  });

  it.each(['DISPONIBLE', 'APARTADO', 'NO_LOCALIZADO', 'EXTRAVIADO'] as const)(
    'acepta EstadoOperativo %s sin inventar reglas de custodia',
    (estadoOperativo) => {
      expect(Expediente.rehydrate(snapshot({ estadoOperativo })).snapshot().estadoOperativo).toBe(
        estadoOperativo,
      );
    },
  );

  it('acepta EN_TRASLADO con Custodia no aceptada', () => {
    const custodiaActual = Custodia.enTraslado({
      custodianType: 'MENSAJERO',
      custodianReference: 'mensajero-1',
      service: 'Consulta externa',
      location: null,
    });

    const current = Expediente.rehydrate(
      snapshot({ estadoOperativo: 'EN_TRASLADO', custodiaActual }),
    ).snapshot();

    expect(current.custodiaActual?.acceptedAt).toBeNull();
  });

  it('acepta EN_CONSULTA con Custodia aceptada', () => {
    const acceptedAt = new Date('2026-08-14T12:00:00.000Z');
    const custodiaActual = Custodia.aceptada({
      custodianType: 'SERVICIO',
      custodianReference: 'receptor-1',
      service: 'Consulta externa',
      location: 'Consultorio 1',
      acceptedAt,
    });

    const current = Expediente.rehydrate(
      snapshot({ estadoOperativo: 'EN_CONSULTA', custodiaActual }),
    ).snapshot();

    expect(current.custodiaActual?.acceptedAt).toEqual(acceptedAt);
  });

  it.each(['EN_BUSQUEDA', 'PRESTADO'])('rechaza el estado antiguo %s', (estadoOperativo) => {
    expect(() =>
      Expediente.rehydrate(snapshot({ estadoOperativo } as Partial<ExpedienteSnapshot>)),
    ).toThrow(DomainError);
  });

  it('rechaza EN_TRASLADO sin Custodia actual', () => {
    expect(() =>
      Expediente.rehydrate(snapshot({ estadoOperativo: 'EN_TRASLADO', custodiaActual: null })),
    ).toThrow(/Custodia actual todavía no aceptada/);
  });

  it('rechaza EN_TRASLADO con Custodia ya aceptada', () => {
    const custodiaActual = Custodia.aceptada({
      custodianType: 'SERVICIO',
      custodianReference: 'receptor-1',
      service: 'Consulta externa',
      location: 'Consultorio 1',
      acceptedAt: new Date('2026-08-14T12:00:00.000Z'),
    });

    expect(() =>
      Expediente.rehydrate(snapshot({ estadoOperativo: 'EN_TRASLADO', custodiaActual })),
    ).toThrow(/todavía no aceptada/);
  });

  it('rechaza EN_CONSULTA sin Custodia aceptada', () => {
    const custodiaActual = Custodia.enTraslado({
      custodianType: 'MENSAJERO',
      custodianReference: 'mensajero-1',
      service: 'Consulta externa',
      location: null,
    });

    expect(() =>
      Expediente.rehydrate(snapshot({ estadoOperativo: 'EN_CONSULTA', custodiaActual })),
    ).toThrow(/Custodia actual aceptada/);
  });

  it('conserva rowVersion como bigint', () => {
    const current = Expediente.rehydrate(snapshot({ rowVersion: 42n })).snapshot();

    expect(current.rowVersion).toBe(42n);
    expect(typeof current.rowVersion).toBe('bigint');
  });

  it('protege el estado y la referencia mínima frente a mutaciones externas', () => {
    const input = snapshot();
    const expediente = Expediente.rehydrate(input);

    (input.pacienteReferencia as { nombreOperativo: string }).nombreOperativo = 'Alterado';
    const exposed = expediente.snapshot();
    expect(() => {
      (exposed.pacienteReferencia as { nombreOperativo: string }).nombreOperativo = 'Otro';
    }).toThrow(TypeError);

    expect(expediente.snapshot().pacienteReferencia.nombreOperativo).toBe('Paciente Sintético');
    expect(Object.isFrozen(exposed)).toBe(true);
    expect(Object.isFrozen(exposed.id)).toBe(true);
    expect(Object.isFrozen(exposed.expedienteNumero)).toBe(true);
    expect(Object.isFrozen(exposed.ubicacionActual)).toBe(true);
  });

  it('mantiene NO_LOCALIZADO distinto de EXTRAVIADO sin transición automática', () => {
    const current = Expediente.rehydrate(
      snapshot({ estadoOperativo: 'NO_LOCALIZADO' }),
    ).snapshot();

    expect(current.estadoOperativo).toBe('NO_LOCALIZADO');
    expect(current.estadoOperativo).not.toBe('EXTRAVIADO');
  });

  it('no admite campos clínicos en su contrato público ni los conserva en runtime', () => {
    const expediente = Expediente.rehydrate({
      ...snapshot(),
      // @ts-expect-error El contrato del aggregate no acepta información clínica.
      diagnostico: 'dato que no debe incorporarse',
    });

    expect(expediente.snapshot()).not.toHaveProperty('diagnostico');
    expect(expediente.snapshot()).not.toHaveProperty('notas');
    expect(expediente.snapshot()).not.toHaveProperty('tratamiento');
    expect(expediente.snapshot()).not.toHaveProperty('estudios');
  });
});
