import { describe, expect, it, vi } from 'vitest';
import type { TenantContext } from '@sigac/tenant';
import { AgendaFecha } from '../domain/value-objects/index.js';
import {
  GetPreparedAgendaGenerationSource,
  computeAgendaSourceVersion,
} from './GetPreparedAgendaGenerationSource.js';
import type { PreparedAgendaGenerationItem } from './GetPreparedAgendaGenerationSource.js';
import type { AgendaGenerationSourceQueryPort } from './ports/AgendaGenerationSourceQueryPort.js';
import type { PreparationItem } from './ports/ReadQueryPorts.js';

const tenant: TenantContext = {
  tenantId: 'tenant-t02a',
  slug: 'tenant-t02a',
  hospitalId: 'hospital-t02a',
  databaseName: 'tenant_t02a',
  timezone: 'America/Mexico_City',
};

const agendaDate = AgendaFecha.parse('2026-08-29');

function item(overrides: Partial<PreparationItem> = {}): PreparationItem {
  return {
    folio: 'FOLIO-002',
    nombrePaciente: 'PACIENTE SINTETICO DOS',
    expediente: { original: 'EXP-002', reference: 'EXP-002' },
    tipoDerechohabiente: 'ACTIVO',
    tipoConsulta: 'FIRST_TIME',
    agendaDate: '2026-08-29',
    appointmentTime: '08:20',
    medico: { numeroEmpleado: '000200', nombre: 'MEDICO DOS' },
    servicioEspecialidad: { codigo: 'CARD', nombre: 'CARDIOLOGIA' },
    ...overrides,
  };
}

function queryPort(items: readonly PreparationItem[] | null): AgendaGenerationSourceQueryPort {
  return {
    findCurrentByDate: vi.fn().mockResolvedValue(items === null ? null : {
      sourceImportacionId: 'importacion-t02a',
      items,
    }),
  };
}

function generationItem(
  overrides: Partial<PreparedAgendaGenerationItem> = {},
): PreparedAgendaGenerationItem {
  const source = item();
  return {
    folio: source.folio,
    agendaDate: source.agendaDate,
    appointmentTime: source.appointmentTime,
    tipoConsulta: source.tipoConsulta,
    tipoDerechohabiente: source.tipoDerechohabiente,
    pacienteNombre: source.nombrePaciente,
    expedienteReference: source.expediente.reference,
    medico: source.medico,
    servicio: source.servicioEspecialidad,
    ...overrides,
  };
}

describe('GetPreparedAgendaGenerationSource — T-02A', () => {
  it('returns null when the current prepared Agenda does not exist', async () => {
    const useCase = new GetPreparedAgendaGenerationSource({ queryPort: queryPort(null) });

    await expect(useCase.execute({ agendaDate, tenant })).resolves.toBeNull();
  });

  it('returns the official import identity, sourceVersion and prepared items', async () => {
    const items = [item()];
    const port = queryPort(items);
    const useCase = new GetPreparedAgendaGenerationSource({ queryPort: port });

    const result = await useCase.execute({ agendaDate, tenant });

    expect(result).toMatchObject({
      agendaDate: '2026-08-29',
      sourceImportacionId: 'importacion-t02a',
      items: [generationItem()],
    });
    expect(result?.sourceVersion).toMatch(/^[a-f0-9]{64}$/);
    expect(port.findCurrentByDate).toHaveBeenCalledWith(agendaDate, tenant);
  });

  it('orders items deterministically by exact FOLIO ascending', async () => {
    const useCase = new GetPreparedAgendaGenerationSource({
      queryPort: queryPort([
        item({ folio: 'FOLIO-010' }),
        item({ folio: 'FOLIO-002' }),
        item({ folio: 'FOLIO-001' }),
      ]),
    });

    const result = await useCase.execute({ agendaDate, tenant });

    expect(result?.items.map(({ folio }) => folio)).toEqual([
      'FOLIO-001',
      'FOLIO-002',
      'FOLIO-010',
    ]);
  });

  it('produces the same sourceVersion regardless of input item order', () => {
    const first = generationItem({ folio: 'FOLIO-001', appointmentTime: '08:00' });
    const second = generationItem({ folio: 'FOLIO-002', appointmentTime: '08:20' });

    const forward = computeAgendaSourceVersion({
      agendaDate: '2026-08-29',
      sourceImportacionId: 'importacion-t02a',
      items: [first, second],
    });
    const reverse = computeAgendaSourceVersion({
      agendaDate: '2026-08-29',
      sourceImportacionId: 'importacion-t02a',
      items: [second, first],
    });

    expect(forward).toBe(reverse);
  });

  it.each([
    ['folio', generationItem({ folio: 'FOLIO-CHANGED' })],
    ['hora', generationItem({ appointmentTime: '09:00' })],
    ['expediente', generationItem({ expedienteReference: 'EXP-003' })],
    ['paciente', generationItem({ pacienteNombre: 'PACIENTE CAMBIADO' })],
    ['tipo consulta', generationItem({ tipoConsulta: 'SUBSEQUENT' })],
    ['médico', generationItem({ medico: { numeroEmpleado: '000201', nombre: 'MEDICO DOS' } })],
    ['servicio', generationItem({ servicio: { codigo: 'NEUR', nombre: 'NEUROLOGIA' } })],
  ])('changes sourceVersion when %s changes', (_field, changedItem) => {
    const base = computeAgendaSourceVersion({
      agendaDate: '2026-08-29',
      sourceImportacionId: 'importacion-t02a',
      items: [generationItem()],
    });
    const changed = computeAgendaSourceVersion({
      agendaDate: '2026-08-29',
      sourceImportacionId: 'importacion-t02a',
      items: [changedItem],
    });

    expect(changed).not.toBe(base);
  });

  it('changes sourceVersion when the confirmed source import changes', () => {
    const first = computeAgendaSourceVersion({
      agendaDate: '2026-08-29',
      sourceImportacionId: 'importacion-a',
      items: [generationItem()],
    });
    const second = computeAgendaSourceVersion({
      agendaDate: '2026-08-29',
      sourceImportacionId: 'importacion-b',
      items: [generationItem()],
    });

    expect(second).not.toBe(first);
  });

  it('verifies current and stale versions through the same tenant-scoped query', async () => {
    const port = queryPort([item()]);
    const useCase = new GetPreparedAgendaGenerationSource({ queryPort: port });
    const current = await useCase.execute({ agendaDate, tenant });

    await expect(useCase.isCurrentVersion({
      agendaDate,
      tenant,
      sourceImportacionId: current!.sourceImportacionId,
      sourceVersion: current!.sourceVersion,
    })).resolves.toBe(true);
    await expect(useCase.isCurrentVersion({
      agendaDate,
      tenant,
      sourceImportacionId: current!.sourceImportacionId,
      sourceVersion: '0'.repeat(64),
    })).resolves.toBe(false);
  });

  it('does not expose timestamp, filename or row-count metadata', async () => {
    const useCase = new GetPreparedAgendaGenerationSource({ queryPort: queryPort([item()]) });
    const result = await useCase.execute({ agendaDate, tenant });

    expect(Object.keys(result!)).toEqual([
      'agendaDate',
      'sourceImportacionId',
      'items',
      'sourceVersion',
    ]);
    expect(JSON.stringify(result)).not.toMatch(/filename|timestamp|rowCount|updatedAt/i);
  });
});
