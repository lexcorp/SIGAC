import { describe, expect, it, vi } from 'vitest';
import type { RequestContext, TenantContext } from '@sigac/tenant';
import { AgendaPreparationReadAdapter } from './AgendaPreparationReadAdapter.js';
import { ValeGenerationAdapter } from './ValeGenerationAdapter.js';

const tenant: TenantContext = {
  tenantId: 'tenant-acl',
  slug: 'tenant-acl',
  hospitalId: 'hospital-acl',
  databaseName: 'db_acl',
  timezone: 'America/Mexico_City',
};

const context: RequestContext = {
  actor: {
    actorId: 'actor-acl',
    roles: new Set(),
    permissions: new Set(['AGENDA_VIEW', 'REQUEST_CREATE']),
    tenantIds: new Set(['tenant-acl']),
  },
  tenant,
  requestId: 'request-acl',
  correlationId: 'correlation-acl',
  source: 'INTERNAL',
};

describe('AgendaPreparationReadAdapter', () => {
  it('returns only the neutral projection and propagates tenant/sourceVersion', async () => {
    const execute = vi.fn().mockResolvedValue({
      agendaDate: '2026-08-29',
      sourceImportacionId: 'importacion-acl',
      sourceVersion: 'a'.repeat(64),
      items: [{
        folio: 'F-1',
        agendaDate: '2026-08-29',
        appointmentTime: '08:00',
        tipoConsulta: 'FIRST_TIME',
        tipoDerechohabiente: 'ACTIVO',
        pacienteNombre: 'PACIENTE PRUEBA',
        expedienteReference: 'EXP-1',
        medico: { numeroEmpleado: 'EMP-1', nombre: 'MEDICO PRUEBA' },
        servicio: { codigo: 'CARD', nombre: 'CARDIOLOGIA' },
      }],
      internalAggregate: 'must-not-leak',
    });
    const isCurrentVersion = vi.fn().mockResolvedValue(true);
    const adapter = new AgendaPreparationReadAdapter({ execute, isCurrentVersion });

    const projection = await adapter.findPreparedAgenda('2026-08-29', tenant);

    expect(projection).toEqual({
      agendaDate: '2026-08-29',
      sourceImportacionId: 'importacion-acl',
      sourceVersion: 'a'.repeat(64),
      items: [{
        folio: 'F-1',
        agendaDate: '2026-08-29',
        appointmentTime: '08:00',
        tipoConsulta: 'FIRST_TIME',
        tipoDerechohabiente: 'ACTIVO',
        pacienteNombre: 'PACIENTE PRUEBA',
        expedienteReference: 'EXP-1',
        medico: { numeroEmpleado: 'EMP-1', nombre: 'MEDICO PRUEBA' },
        servicio: { codigo: 'CARD', nombre: 'CARDIOLOGIA' },
      }],
    });
    expect(execute).toHaveBeenCalledWith({
      agendaDate: expect.objectContaining({ value: '2026-08-29' }),
      tenant,
    });
    expect(JSON.stringify(projection)).not.toContain('internalAggregate');

    await expect(adapter.isCurrentVersion(
      '2026-08-29',
      'importacion-acl',
      'a'.repeat(64),
      tenant,
    )).resolves.toBe(true);
    expect(isCurrentVersion).toHaveBeenCalledWith({
      agendaDate: expect.objectContaining({ value: '2026-08-29' }),
      sourceImportacionId: 'importacion-acl',
      sourceVersion: 'a'.repeat(64),
      tenant,
    });
  });

  it('propagates Agenda errors without translating them silently', async () => {
    const error = new Error('agenda query failed');
    const adapter = new AgendaPreparationReadAdapter({
      execute: vi.fn().mockRejectedValue(error),
      isCurrentVersion: vi.fn(),
    });

    await expect(adapter.findPreparedAgenda('2026-08-29', tenant)).rejects.toBe(error);
  });
});

describe('ValeGenerationAdapter', () => {
  it('maps the neutral batch once and propagates context, sourceVersion and snapshotHash', async () => {
    const execute = vi.fn().mockResolvedValue({
      generatedVales: [{
        valeId: 'vale-1',
        numeroVale: 'VA-20260829-001',
        agendaDate: '2026-08-29',
        servicioCodigo: 'CARD',
        medicoNumeroEmpleado: 'EMP-1',
        outcome: 'GENERATED',
      }],
    });
    const adapter = new ValeGenerationAdapter({ execute });

    const result = await adapter.generateBatch({
      agendaDate: '2026-08-29',
      sourceImportacionId: 'importacion-acl',
      sourceVersion: 'a'.repeat(64),
      generationSnapshotHash: 'b'.repeat(64),
      resolvedConflicts: [{
        expedienteReference: 'EXP-1',
        ownerGroup: { agendaDate: '2026-08-29', servicioCodigo: 'CARD', medicoNumeroEmpleado: 'EMP-1' },
        alternatives: [{
          group: { agendaDate: '2026-08-29', servicioCodigo: 'CIR', medicoNumeroEmpleado: 'EMP-2' },
          references: [{ folio: 'F-2', servicioCodigo: 'CIR', medicoNumeroEmpleado: 'EMP-2' }],
        }],
      }],
      header: {
        fechaSolicitud: '2026-08-29',
        fechaRecepcion: '2026-08-29',
        unidadSolicitante: 'ARCHIVO',
        solicitante: { nombre: 'SOLICITANTE', cargo: 'MEDICO' },
        autorizador: { nombre: 'AUTORIZADOR', cargo: 'DIRECTOR' },
      },
      groups: [{
        key: {
          agendaDate: '2026-08-29',
          servicioCodigo: 'CARD',
          medicoNumeroEmpleado: 'EMP-1',
        },
        servicioNombre: 'CARDIOLOGIA',
        medicoNombre: 'MEDICO PRUEBA',
        items: [{
          expedienteReference: 'EXP-1',
          pacienteNombre: 'PACIENTE PRUEBA',
          references: [{
            folio: 'F-1',
            servicioCodigo: 'CARD',
            medicoNumeroEmpleado: 'EMP-1',
          }],
        }],
      }],
    }, context);

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      source: {
        kind: 'AGENDA_PREPARATION',
        agendaDate: '2026-08-29',
        sourceImportacionId: 'importacion-acl',
        sourceVersion: 'a'.repeat(64),
        generationSnapshotHash: 'b'.repeat(64),
      },
      context,
      groups: [expect.objectContaining({
        agendaDate: '2026-08-29',
        servicioCodigo: 'CARD',
        medicoNumeroEmpleado: 'EMP-1',
      })],
      resolvedConflicts: [{
        expedienteNumero: 'EXP-1',
        ownerGroup: { agendaDate: '2026-08-29', servicioCodigo: 'CARD', medicoNumeroEmpleado: 'EMP-1' },
        alternatives: [{
          group: { agendaDate: '2026-08-29', servicioCodigo: 'CIR', medicoNumeroEmpleado: 'EMP-2' },
          appointmentReferences: [{ folio: 'F-2', servicioCodigo: 'CIR', medicoNumeroEmpleado: 'EMP-2' }],
        }],
      }],
    }));
    expect(result).toEqual({
      generatedVales: [{
        valeId: 'vale-1',
        numeroVale: 'VA-20260829-001',
        group: {
          agendaDate: '2026-08-29',
          servicioCodigo: 'CARD',
          medicoNumeroEmpleado: 'EMP-1',
        },
        outcome: 'GENERATED',
      }],
    });
  });

  it('propagates ALREADY_GENERATED without converting it into an error', async () => {
    const execute = vi.fn().mockResolvedValue({
      generatedVales: [{
        valeId: 'vale-existing',
        numeroVale: 'VA-20260829-007',
        agendaDate: '2026-08-29',
        servicioCodigo: 'CARD',
        medicoNumeroEmpleado: 'EMP-1',
        outcome: 'ALREADY_GENERATED',
      }],
    });
    const adapter = new ValeGenerationAdapter({ execute });

    const result = await adapter.generateBatch({
      agendaDate: '2026-08-29',
      sourceImportacionId: 'i',
      sourceVersion: 'v',
      generationSnapshotHash: 'h',
      resolvedConflicts: [],
      header: {
        fechaSolicitud: '2026-08-29', fechaRecepcion: '2026-08-29',
        unidadSolicitante: 'ARCHIVO',
        solicitante: { nombre: 'S', cargo: 'C' },
        autorizador: { nombre: 'A', cargo: 'C' },
      },
      groups: [],
    }, context);

    expect(result.generatedVales[0]!.outcome).toBe('ALREADY_GENERATED');
  });
});
