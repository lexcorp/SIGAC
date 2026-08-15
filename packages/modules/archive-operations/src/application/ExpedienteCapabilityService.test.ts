import type { ActorContext, TenantContext } from '@sigac/tenant';
import { describe, expect, it } from 'vitest';

import {
  ExpedienteCapabilityService,
  type ExpedienteCapabilityInput,
} from './ExpedienteCapabilityService.js';

const tenant: TenantContext = {
  tenantId: 'tenant-a',
  slug: 'hospital-a',
  hospitalId: 'hospital-a',
  databaseName: 'sigac_hospital_a',
  timezone: 'America/Mexico_City',
};

const ARCHIVISTA_PERMISSIONS = [
  'EXPEDIENT_VIEW',
  'REQUEST_CREATE',
  'SEARCH_START',
  'SEARCH_MARK_LOCATED',
  'SEARCH_MARK_NOT_LOCATED',
  'EXPEDIENT_DISPATCH',
  'LOAN_OPEN',
  'LOAN_RENEW',
  'RETURN_RECEIVE',
  'REARCHIVE_CONFIRM',
  'INCIDENT_OPEN',
] as const;

function actor(
  roles: readonly string[],
  permissions: readonly string[],
): ActorContext {
  return {
    actorId: 'actor-a',
    roles: new Set(roles),
    permissions: new Set(permissions),
    tenantIds: new Set([tenant.tenantId]),
  };
}

function input(
  overrides: Partial<ExpedienteCapabilityInput> = {},
): ExpedienteCapabilityInput {
  return {
    estadoOperativo: 'DISPONIBLE',
    solicitudActiva: null,
    prestamoActivo: null,
    fuentesHabilitantesSalida: [],
    actor: actor(['ARCHIVISTA'], ARCHIVISTA_PERMISSIONS),
    tenant,
    ...overrides,
  };
}

describe('ExpedienteCapabilityService', () => {
  const service = new ExpedienteCapabilityService();

  it('ofrece al Archivista sólo las capabilities válidas para el contexto', () => {
    expect(service.calculate(input())).toEqual([
      'SOLICITAR',
      'REPORTAR_INCIDENCIA',
    ]);
  });

  it('no ofrece una capability cuando falta su permission canónica', () => {
    const permissions = ARCHIVISTA_PERMISSIONS.filter(
      (permission) => permission !== 'REQUEST_CREATE',
    );

    expect(service.calculate(input({ actor: actor(['ARCHIVISTA'], permissions) }))).toEqual([
      'REPORTAR_INCIDENCIA',
    ]);
  });

  it('devuelve [] sin EXPEDIENT_VIEW', () => {
    expect(
      service.calculate(
        input({ actor: actor(['ARCHIVISTA'], ['REQUEST_CREATE', 'INCIDENT_OPEN']) }),
      ),
    ).toEqual([]);
  });

  it('devuelve [] para AUDITOR_CONSULTA aunque tenga permissions operativas', () => {
    expect(
      service.calculate(
        input({ actor: actor(['AUDITOR_CONSULTA'], ARCHIVISTA_PERMISSIONS) }),
      ),
    ).toEqual([]);
  });

  it('ofrece DISPATCH sólo a Archivo/Jefatura con permission y APARTADO', () => {
    expect(service.calculate(input({ estadoOperativo: 'APARTADO' }))).toContain('DISPATCH');
    expect(service.calculate(input({ estadoOperativo: 'DISPONIBLE' }))).not.toContain(
      'DISPATCH',
    );
    expect(
      service.calculate(
        input({
          estadoOperativo: 'APARTADO',
          actor: actor(['DIRECCION'], ['EXPEDIENT_VIEW', 'EXPEDIENT_DISPATCH']),
        }),
      ),
    ).not.toContain('DISPATCH');
  });

  it('ofrece ACCEPT_CUSTODY sólo al receptor con permission y EN_TRASLADO', () => {
    const receptor = actor(
      ['RECEPTOR_SERVICIO'],
      ['EXPEDIENT_VIEW', 'CUSTODY_ACCEPT'],
    );

    expect(
      service.calculate(input({ estadoOperativo: 'EN_TRASLADO', actor: receptor })),
    ).toEqual(['ACCEPT_CUSTODY']);
    expect(
      service.calculate(input({ estadoOperativo: 'EN_CONSULTA', actor: receptor })),
    ).toEqual([]);
    expect(
      service.calculate(
        input({
          estadoOperativo: 'EN_TRASLADO',
          actor: actor(['TRASLADO'], ['EXPEDIENT_VIEW', 'CUSTODY_ACCEPT']),
        }),
      ),
    ).not.toContain('ACCEPT_CUSTODY');
  });

  it('ofrece ABRIR_PRESTAMO por CONSULTA_PROGRAMADA a Archivo/Jefatura con LOAN_OPEN', () => {
    const capabilities = service.calculate(
      input({
        fuentesHabilitantesSalida: [{
          tipo: 'CONSULTA_PROGRAMADA',
          validada: true,
        }],
      }),
    );

    expect(capabilities).toContain('ABRIR_PRESTAMO');
  });

  it('no ofrece ABRIR_PRESTAMO con una colección de fuentes vacía', () => {
    expect(
      service.calculate(input({ fuentesHabilitantesSalida: [] })),
    ).not.toContain('ABRIR_PRESTAMO');
  });

  it('no ofrece ABRIR_PRESTAMO con CONSULTA_PROGRAMADA no validada', () => {
    expect(
      service.calculate(
        input({
          fuentesHabilitantesSalida: [
            { tipo: 'CONSULTA_PROGRAMADA', validada: false },
          ],
        }),
      ),
    ).not.toContain('ABRIR_PRESTAMO');
  });

  it('ofrece ABRIR_PRESTAMO por SM 1-14 sólo al ejecutor de Archivo con fuente validada', () => {
    const fuenteValidada = {
      tipo: 'VALE_ARCHIVO_SM_1_14' as const,
      validada: true,
    };

    expect(
      service.calculate(input({ fuentesHabilitantesSalida: [fuenteValidada] })),
    ).toContain('ABRIR_PRESTAMO');
    expect(
      service.calculate(
        input({
          fuentesHabilitantesSalida: [{ ...fuenteValidada, validada: false }],
        }),
      ),
    ).not.toContain('ABRIR_PRESTAMO');
  });

  it.each(['DIRECCION', 'COORDINACION_MEDICA'])(
    '%s no recibe ABRIR_PRESTAMO por emitir el vale',
    (role) => {
      expect(
        service.calculate(
          input({
            actor: actor([role], ['EXPEDIENT_VIEW', 'LOAN_OPEN']),
            fuentesHabilitantesSalida: [{
              tipo: 'VALE_ARCHIVO_SM_1_14',
              validada: true,
            }],
          }),
        ),
      ).not.toContain('ABRIR_PRESTAMO');
    },
  );

  it('mantiene ORDEN_SUPERIOR fail-closed', () => {
    expect(
      service.calculate(
        input({
          fuentesHabilitantesSalida: [{
            tipo: 'ORDEN_SUPERIOR',
            validada: true,
          }],
        }),
      ),
    ).not.toContain('ABRIR_PRESTAMO');
  });

  it('ofrece ABRIR_PRESTAMO cuando múltiples fuentes incluyen una permitida y validada', () => {
    expect(
      service.calculate(
        input({
          fuentesHabilitantesSalida: [
            { tipo: 'ORDEN_SUPERIOR', validada: true },
            { tipo: 'CONSULTA_PROGRAMADA', validada: false },
            { tipo: 'VALE_ARCHIVO_SM_1_14', validada: true },
          ],
        }),
      ),
    ).toContain('ABRIR_PRESTAMO');
  });

  it('no ofrece ABRIR_PRESTAMO cuando múltiples fuentes son todas inválidas', () => {
    expect(
      service.calculate(
        input({
          fuentesHabilitantesSalida: [
            { tipo: 'ORDEN_SUPERIOR', validada: true },
            { tipo: 'CONSULTA_PROGRAMADA', validada: false },
            { tipo: 'VALE_ARCHIVO_SM_1_14', validada: false },
          ],
        }),
      ),
    ).not.toContain('ABRIR_PRESTAMO');
  });

  it('un préstamo existente impide ABRIR_PRESTAMO', () => {
    expect(
      service.calculate(
        input({
          prestamoActivo: { estado: 'Activo' },
          fuentesHabilitantesSalida: [{
            tipo: 'CONSULTA_PROGRAMADA',
            validada: true,
          }],
        }),
      ),
    ).not.toContain('ABRIR_PRESTAMO');
  });

  it('deriva renovación, devolución y rearchivo de estados canónicos de Préstamo', () => {
    expect(service.calculate(input({ prestamoActivo: { estado: 'Activo' } }))).toEqual(
      expect.arrayContaining(['RENOVAR_PRESTAMO', 'RECIBIR_DEVOLUCION']),
    );
    expect(service.calculate(input({ prestamoActivo: { estado: 'Vencido' } }))).toContain(
      'RECIBIR_DEVOLUCION',
    );
    expect(
      service.calculate(
        input({
          prestamoActivo: { estado: 'Devuelto', devolucionVerificada: true },
        }),
      ),
    ).toContain('CONFIRMAR_REARCHIVO');
    expect(
      service.calculate(
        input({
          prestamoActivo: { estado: 'Devuelto', devolucionVerificada: false },
        }),
      ),
    ).not.toContain('CONFIRMAR_REARCHIVO');
  });

  it('deriva las capabilities de búsqueda sólo de estados compatibles de Solicitud', () => {
    expect(
      service.calculate(input({ solicitudActiva: { estado: 'Asignada' } })),
    ).toContain('INICIAR_BUSQUEDA');
    expect(
      service.calculate(input({ solicitudActiva: { estado: 'EnBusqueda' } })),
    ).toEqual(
      expect.arrayContaining(['MARCAR_LOCALIZADO', 'MARCAR_NO_LOCALIZADO']),
    );
    expect(
      service.calculate(input({ solicitudActiva: { estado: 'Preparada' } })),
    ).not.toEqual(
      expect.arrayContaining([
        'INICIAR_BUSQUEDA',
        'MARCAR_LOCALIZADO',
        'MARCAR_NO_LOCALIZADO',
      ]),
    );
  });

  it('no inventa una capability de lectura', () => {
    const capabilities = service.calculate(input());

    expect(capabilities).not.toContain('EXPEDIENT_VIEW');
  });
});
