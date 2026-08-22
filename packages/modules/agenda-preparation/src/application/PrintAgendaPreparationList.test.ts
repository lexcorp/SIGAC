import type { AuditEntry } from '@sigac/audit';
import type { RequestContext, TenantContext } from '@sigac/tenant';
import { describe, expect, it, vi } from 'vitest';
import { AgendaFecha } from '../domain/value-objects/index.js';
import { ApplicationError } from './ApplicationError.js';
import { PrintAgendaPreparationList } from './PrintAgendaPreparationList.js';
import type { PreparationItem } from './ports/ReadQueryPorts.js';

const tenant: TenantContext = {
  tenantId: 'tenant-a', slug: 'hospital-a', hospitalId: 'hosp-a',
  databaseName: 'sigac_hosp_a', timezone: 'America/Mexico_City',
};

function makeContext(permissions: string[] = ['AGENDA_VIEW']): RequestContext {
  return {
    actor: { actorId: 'actor-001', roles: new Set(['ARCHIVISTA']),
      permissions: new Set(permissions), tenantIds: new Set(['tenant-a']) },
    tenant, requestId: 'req-001', correlationId: 'corr-001', source: 'WEB',
  };
}

const agendaDate = AgendaFecha.parse('2026-08-25');

const sampleItems: PreparationItem[] = [
  {
    folio: 'FOLIO-001', nombrePaciente: 'PACIENTE SINTETICO',
    expediente: { original: 'PERR810604/10', reference: null },
    tipoDerechohabiente: 'PENSIONISTA', tipoConsulta: 'FIRST_TIME',
    agendaDate: '2026-08-25', appointmentTime: '08:00',
    medico: { numeroEmpleado: '12345', nombre: 'DR MEDICO SINTETICO' },
    servicioEspecialidad: { codigo: 'CIR', nombre: 'CIRUGIA GENERAL' },
  },
  {
    folio: 'FOLIO-002', nombrePaciente: 'OTRO PACIENTE SINTETICO',
    expediente: { original: 'PERR810604/11', reference: 'PERR810604/11' },
    tipoDerechohabiente: 'ACTIVO', tipoConsulta: 'SUBSEQUENT',
    agendaDate: '2026-08-25', appointmentTime: '09:00',
    medico: { numeroEmpleado: '12345', nombre: 'DR MEDICO SINTETICO' },
    servicioEspecialidad: { codigo: 'CIR', nombre: 'CIRUGIA GENERAL' },
  },
];

function setup(queryResult: PreparationItem[] = sampleItems) {
  const preparationQuery = {
    findPage: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    listForPrint: vi.fn().mockResolvedValue(queryResult),
  };
  const auditWriter = { append: vi.fn().mockResolvedValue(undefined) };
  const useCase = new PrintAgendaPreparationList({ preparationQuery, auditWriter });
  return { useCase, preparationQuery, auditWriter };
}

describe('PrintAgendaPreparationList', () => {
  it('devuelve la colección completa sin cursor y audita success', async () => {
    const { useCase, preparationQuery, auditWriter } = setup();
    const result = await useCase.execute({ agendaDate, order: 'APPOINTMENT_TIME_ASC', context: makeContext() });
    expect(result).toHaveLength(2);
    expect(result[0].folio).toBe('FOLIO-001');
    expect(result[1].folio).toBe('FOLIO-002');
    expect(Array.isArray(result)).toBe(true);
    expect(preparationQuery.listForPrint).toHaveBeenCalledWith(agendaDate, 'APPOINTMENT_TIME_ASC', tenant);
    expect(preparationQuery.findPage).not.toHaveBeenCalled();
    const calls = (auditWriter.append as ReturnType<typeof vi.fn>).mock.calls as [AuditEntry, RequestContext][];
    expect(calls.find(([e]) => e.result === 'success')![0].action).toBe('AGENDA_PREPARATION_VIEW');
  });

  it('mismo shape de PreparationItem que pantalla, sin Turno/Consultorio/Destino', async () => {
    const { useCase } = setup();
    const result = await useCase.execute({ agendaDate, order: 'APPOINTMENT_TIME_ASC', context: makeContext() });
    const item = result[0];
    expect(item).toHaveProperty('folio');
    expect(item).toHaveProperty('nombrePaciente');
    expect(item).toHaveProperty('medico');
    expect(item).toHaveProperty('servicioEspecialidad');
    expect(item).not.toHaveProperty('turno');
    expect(item).not.toHaveProperty('consultorio');
    expect(item).not.toHaveProperty('destino');
  });

  it('audita denied y lanza PERMISSION_DENIED sin consultar datos', async () => {
    const { useCase, preparationQuery, auditWriter } = setup();
    await expect(useCase.execute({ agendaDate, order: 'APPOINTMENT_TIME_ASC', context: makeContext([]) }))
      .rejects.toMatchObject({ name: 'ApplicationError', code: 'PERMISSION_DENIED' });
    expect(preparationQuery.listForPrint).not.toHaveBeenCalled();
    const calls = (auditWriter.append as ReturnType<typeof vi.fn>).mock.calls as [AuditEntry, RequestContext][];
    expect(calls.find(([e]) => e.result === 'denied')).toBeDefined();
  });

  it('propaga el order a listForPrint', async () => {
    const { useCase, preparationQuery } = setup();
    await useCase.execute({ agendaDate, order: 'PATIENT_NAME_ASC', context: makeContext() });
    expect(preparationQuery.listForPrint).toHaveBeenCalledWith(agendaDate, 'PATIENT_NAME_ASC', tenant);
  });
});
