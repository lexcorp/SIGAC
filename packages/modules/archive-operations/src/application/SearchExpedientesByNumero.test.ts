import type { RequestContext } from '@sigac/tenant';
import { describe, expect, it, vi } from 'vitest';
import { Expediente } from '../domain/Expediente.js';
import type { ExpedienteRepository } from '../domain/ports/ExpedienteRepository.js';
import {
  ExpedienteId,
  ExpedienteNumero,
  Ubicacion,
} from '../domain/value-objects/index.js';
import type { AuditWriter } from '@sigac/audit';
import { SearchExpedientesByNumero } from './SearchExpedientesByNumero.js';

const tenant = {
  tenantId: 'tenant-a',
  slug: 'hospital-a',
  hospitalId: 'hospital-a',
  databaseName: 'tenant_a',
  timezone: 'America/Mexico_City',
};

function context(canView = true): RequestContext {
  return {
    actor: {
      actorId: 'actor-1',
      roles: new Set(['ARCHIVISTA']),
      permissions: new Set(canView ? ['EXPEDIENT_VIEW'] : []),
      tenantIds: new Set(['tenant-a']),
    },
    tenant,
    requestId: 'request-1',
    correlationId: 'correlation-1',
    source: 'WEB',
  };
}

function expediente(id: string, numero = 'PERR810604/10'): Expediente {
  return Expediente.rehydrate({
    id: ExpedienteId.parse(id),
    expedienteNumero: ExpedienteNumero.parse(numero),
    pacienteReferencia: {
      idInstitucional: `patient-${id}`,
      curp: `CURP-${id}`,
      nombreOperativo: `Paciente ${id}`,
      numeroIssste: `ISSSTE-${id}`,
    },
    hospitalId: 'hospital-a',
    estadoOperativo: 'DISPONIBLE',
    ubicacionActual: Ubicacion.create({
      id: '11111111-1111-4111-8111-111111111111',
      codigo: 'ARCH-1',
      descripcion: 'Archivo central',
    }),
    custodiaActual: null,
    rowVersion: 7n,
  });
}

function setup(results: readonly Expediente[] = []) {
  const repository: ExpedienteRepository = {
    findById: vi.fn(),
    findByNumero: vi.fn().mockResolvedValue(results),
    save: vi.fn(),
  };
  const auditWriter: AuditWriter = { append: vi.fn().mockResolvedValue(undefined) };
  return {
    useCase: new SearchExpedientesByNumero({ expedienteRepository: repository, auditWriter }),
    repository,
    auditWriter,
  };
}

describe('SearchExpedientesByNumero', () => {
  it.each([
    ['PERR810604/10'],
    ['PERR810604-10'],
    ['PERR81060410'],
  ])('delega al VO la normalización de %s y propaga el tenant', async (raw) => {
    const { useCase, repository } = setup();
    const numero = ExpedienteNumero.parse(raw);
    await useCase.execute({ numero, context: context() });
    expect(numero.toNormalized()).toBe('PERR81060410');
    expect(repository.findByNumero).toHaveBeenCalledWith(numero, tenant);
  });

  it('retorna cero resultados y audita success sin tratarlo como not-found', async () => {
    const { useCase, auditWriter } = setup();
    await expect(useCase.execute({
      numero: ExpedienteNumero.parse('PERR810604/10'),
      context: context(),
    })).resolves.toEqual([]);
    expect(auditWriter.append).toHaveBeenCalledWith({
      action: 'EXPEDIENTE_SEARCH',
      resourceType: 'EXPEDIENTE',
      resourceId: 'PERR81060410',
      result: 'success',
    }, expect.any(Object));
  });

  it.each([1, 2])('retorna exactamente %s summary(s) sin datos extra y audita success', async (count) => {
    const matches = [
      expediente('9b2d3958-f383-4c53-9041-09172fdd408f'),
      expediente('2d414e5b-9ef3-45d1-8be3-e71daf358595'),
    ].slice(0, count);
    const { useCase, auditWriter } = setup(matches);
    const result = await useCase.execute({
      numero: ExpedienteNumero.parse('PERR810604/10'),
      context: context(),
    });
    expect(result).toHaveLength(count);
    expect(Object.keys(result[0] ?? {}).sort()).toEqual([
      'estadoOperativo', 'expedienteId', 'expedienteNumero', 'paciente', 'ubicacion',
    ]);
    expect(Object.keys(result[0]?.paciente ?? {}).sort()).toEqual([
      'curp', 'idInstitucional', 'nombreOperativo', 'numeroIssste',
    ]);
    expect(result[0]).not.toHaveProperty('rowVersion');
    expect(result[0]).not.toHaveProperty('custodia');
    expect(auditWriter.append).toHaveBeenCalledWith(expect.objectContaining({
      result: 'success',
    }), expect.any(Object));
    expect(auditWriter.append).not.toHaveBeenCalledWith(expect.objectContaining({
      changeSummary: expect.anything(),
    }), expect.anything());
  });

  it('audita denied, no consulta Repository y lanza PERMISSION_DENIED', async () => {
    const { useCase, repository, auditWriter } = setup();
    const requestContext = context(false);
    await expect(useCase.execute({
      numero: ExpedienteNumero.parse('PERR810604/10'),
      context: requestContext,
    })).rejects.toMatchObject({
      name: 'ApplicationError',
      code: 'PERMISSION_DENIED',
    });
    expect(repository.findByNumero).not.toHaveBeenCalled();
    expect(auditWriter.append).toHaveBeenCalledWith({
      action: 'EXPEDIENTE_SEARCH',
      resourceType: 'EXPEDIENTE',
      resourceId: 'PERR81060410',
      result: 'denied',
    }, requestContext);
  });
});
