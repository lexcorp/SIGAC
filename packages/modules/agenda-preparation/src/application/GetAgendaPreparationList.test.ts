import type { AuditEntry } from '@sigac/audit';
import type { RequestContext, TenantContext } from '@sigac/tenant';
import { describe, expect, it, vi } from 'vitest';
import { AgendaFecha } from '../domain/value-objects/index.js';
import { ApplicationError } from './ApplicationError.js';
import { GetAgendaPreparationList } from './GetAgendaPreparationList.js';
import type { PreparationItem, PreparationPage } from './ports/ReadQueryPorts.js';

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

const sampleItem: PreparationItem = {
  folio: 'FOLIO-001',
  nombrePaciente: 'PACIENTE SINTETICO',
  expediente: { original: 'PERR810604/10', reference: 'PERR810604/10' },
  tipoDerechohabiente: 'PENSIONISTA',
  tipoConsulta: 'FIRST_TIME',
  agendaDate: '2026-08-25',
  appointmentTime: '08:00',
  medico: { numeroEmpleado: '12345', nombre: 'DR MEDICO SINTETICO' },
  servicioEspecialidad: { codigo: 'CIR', nombre: 'CIRUGIA GENERAL' },
};

const samplePage: PreparationPage = { items: [sampleItem], nextCursor: null };
const emptyPage: PreparationPage = { items: [], nextCursor: null };
const pageWithCursor: PreparationPage = { items: [sampleItem], nextCursor: 'cursor-abc' };

function setup(queryResult: PreparationPage = samplePage) {
  const preparationQuery = {
    findPage: vi.fn().mockResolvedValue(queryResult),
    listForPrint: vi.fn().mockResolvedValue([]),
  };
  const auditWriter = { append: vi.fn().mockResolvedValue(undefined) };
  const useCase = new GetAgendaPreparationList({ preparationQuery, auditWriter });
  return { useCase, preparationQuery, auditWriter };
}

describe('GetAgendaPreparationList', () => {
  it('devuelve página con PreparationItem con campos exactos y audita success', async () => {
    const { useCase, preparationQuery, auditWriter } = setup();
    const result = await useCase.execute({
      agendaDate, order: 'APPOINTMENT_TIME_ASC', pagination: { limit: 20 }, context: makeContext(),
    });
    expect(result.items).toHaveLength(1);
    const item = result.items[0];
    expect(item.folio).toBe('FOLIO-001');
    expect(item.nombrePaciente).toBe('PACIENTE SINTETICO');
    expect(item.medico.numeroEmpleado).toBe('12345');
    expect(item.servicioEspecialidad.codigo).toBe('CIR');
    expect(item).not.toHaveProperty('turno');
    expect(item).not.toHaveProperty('consultorio');
    expect(item).not.toHaveProperty('destino');
    expect(item).not.toHaveProperty('curp');
    expect(preparationQuery.findPage).toHaveBeenCalledWith(agendaDate, 'APPOINTMENT_TIME_ASC', { limit: 20 }, tenant);
    const calls = (auditWriter.append as ReturnType<typeof vi.fn>).mock.calls as [AuditEntry, RequestContext][];
    const success = calls.find(([e]) => e.result === 'success');
    expect(success![0].action).toBe('AGENDA_PREPARATION_VIEW');
    expect(success![0].resourceType).toBe('AGENDA');
    expect(success![0].resourceId).toBe('2026-08-25');
  });

  it('lista vacía se considera success — retirada excluida de la lista', async () => {
    const { useCase, auditWriter } = setup(emptyPage);
    const result = await useCase.execute({
      agendaDate, order: 'APPOINTMENT_TIME_ASC', pagination: { limit: 20 }, context: makeContext(),
    });
    expect(result.items).toHaveLength(0);
    const calls = (auditWriter.append as ReturnType<typeof vi.fn>).mock.calls as [AuditEntry, RequestContext][];
    expect(calls.find(([e]) => e.result === 'success')).toBeDefined();
    expect(calls.find(([e]) => e.result === 'not-found')).toBeUndefined();
  });

  it('audita denied y lanza PERMISSION_DENIED sin consultar datos', async () => {
    const { useCase, preparationQuery, auditWriter } = setup();
    await expect(useCase.execute({
      agendaDate, order: 'APPOINTMENT_TIME_ASC', pagination: { limit: 10 }, context: makeContext([]),
    })).rejects.toMatchObject({ name: 'ApplicationError', code: 'PERMISSION_DENIED' });
    expect(preparationQuery.findPage).not.toHaveBeenCalled();
    const calls = (auditWriter.append as ReturnType<typeof vi.fn>).mock.calls as [AuditEntry, RequestContext][];
    expect(calls.find(([e]) => e.result === 'denied')).toBeDefined();
  });

  it('propaga order, pagination y tenant al query port', async () => {
    const { useCase, preparationQuery } = setup(pageWithCursor);
    await useCase.execute({
      agendaDate, order: 'PATIENT_NAME_ASC', pagination: { cursor: 'cur-1', limit: 5 }, context: makeContext(),
    });
    expect(preparationQuery.findPage).toHaveBeenCalledWith(agendaDate, 'PATIENT_NAME_ASC', { cursor: 'cur-1', limit: 5 }, tenant);
  });
});
