import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import type { RequestContext, TenantContext } from '@sigac/tenant';
import type {
  AgendaAgendaItem,
  AgendaPreparationProjection,
  AgendaPreparationReadPort,
  GenerationSnapshotHasherPort,
  GenerateValesFromAgendaResult,
  ValeGenerationBatchCommand,
  ValeGenerationPort,
} from './index.js';

const srcDirectory = dirname(fileURLToPath(import.meta.url));
const packageDirectory = dirname(srcDirectory);

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [path] : [];
  });
}

const tenant: TenantContext = {
  tenantId: 'tenant-contract',
  slug: 'contract',
  hospitalId: 'hospital-contract',
  databaseName: 'tenant_contract',
  timezone: 'America/Mexico_City',
};

const context: RequestContext = {
  actor: {
    actorId: 'actor-contract',
    roles: new Set<string>(),
    permissions: new Set(['AGENDA_VIEW', 'REQUEST_CREATE']),
    tenantIds: new Set(['tenant-contract']),
  },
  tenant,
  requestId: 'request-contract',
  correlationId: 'correlation-contract',
  source: 'INTERNAL',
};

const item: AgendaAgendaItem = {
  folio: 'FOLIO-CONTRACT-1',
  agendaDate: '2026-08-29',
  appointmentTime: '08:00',
  tipoConsulta: 'FIRST_TIME',
  tipoDerechohabiente: 'ACTIVO',
  pacienteNombre: 'PACIENTE SINTETICO',
  expedienteReference: 'EXP-CONTRACT-1',
  medico: { numeroEmpleado: '000123', nombre: 'MEDICO SINTETICO' },
  servicio: { codigo: 'CARD', nombre: 'CARDIOLOGIA' },
};

const projection: AgendaPreparationProjection = {
  agendaDate: '2026-08-29',
  sourceImportacionId: 'import-contract',
  sourceVersion: 'opaque-version',
  items: [item],
};

const command: ValeGenerationBatchCommand = {
  agendaDate: projection.agendaDate,
  sourceImportacionId: projection.sourceImportacionId,
  sourceVersion: projection.sourceVersion,
  generationSnapshotHash: 'opaque-hash',
  header: {
    fechaSolicitud: '2026-08-29',
    fechaRecepcion: '2026-08-27',
    unidadSolicitante: 'UNIDAD SINTETICA',
    solicitante: { nombre: 'SOLICITANTE SINTETICO', cargo: 'CARGO' },
    autorizador: { nombre: 'AUTORIZADOR SINTETICO', cargo: 'CARGO' },
  },
  groups: [{
    key: {
      agendaDate: '2026-08-29',
      servicioCodigo: 'CARD',
      medicoNumeroEmpleado: '000123',
    },
    servicioNombre: 'CARDIOLOGIA',
    medicoNombre: 'MEDICO SINTETICO',
    items: [{
      expedienteReference: 'EXP-CONTRACT-1',
      pacienteNombre: 'PACIENTE SINTETICO',
      references: [{
        folio: 'FOLIO-CONTRACT-1',
        servicioCodigo: 'CARD',
        medicoNumeroEmpleado: '000123',
      }],
    }],
  }],
};

describe('@sigac/agenda-vale-integration — contract boundaries', () => {
  it('declares only the neutral runtime dependency', () => {
    const packageJson = JSON.parse(
      readFileSync(join(packageDirectory, 'package.json'), 'utf8'),
    ) as { dependencies?: Record<string, string> };

    expect(packageJson.dependencies).toEqual({ '@sigac/tenant': 'workspace:*' });
  });

  it('does not import either bounded context', () => {
    const productionSource = sourceFiles(srcDirectory)
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n');

    expect(productionSource).not.toContain("from '@sigac/agenda-preparation'");
    expect(productionSource).not.toContain("from '@sigac/vale-archivo'");
  });

  it('contains no Domain, Repository, Controller or adapter layer', () => {
    for (const prohibitedDirectory of ['domain', 'repositories', 'controllers', 'adapters']) {
      expect(existsSync(join(srcDirectory, prohibitedDirectory))).toBe(false);
    }
  });

  it('keeps the source projection neutral and tenant-scoped', async () => {
    const port: AgendaPreparationReadPort = {
      findPreparedAgenda: vi.fn().mockResolvedValue(projection),
      isCurrentVersion: vi.fn().mockResolvedValue(true),
    };

    await expect(port.findPreparedAgenda('2026-08-29', tenant)).resolves.toEqual(projection);
    await expect(
      port.isCurrentVersion('2026-08-29', 'import-contract', 'opaque-version', tenant),
    ).resolves.toBe(true);
  });

  it('keeps hashing and target generation behind ports', async () => {
    const hasher: GenerationSnapshotHasherPort = {
      compute: vi.fn().mockResolvedValue('opaque-hash'),
    };
    const target: ValeGenerationPort = {
      generateBatch: vi.fn().mockResolvedValue({ generatedVales: [] }),
    };

    await expect(hasher.compute({
      agendaDate: command.agendaDate,
      sourceImportacionId: command.sourceImportacionId,
      sourceVersion: command.sourceVersion,
      groups: command.groups,
    })).resolves.toBe('opaque-hash');
    await expect(target.generateBatch(command, context)).resolves.toEqual({ generatedVales: [] });
  });

  it('represents generated, conflict and unresolved outcomes without Domain entities', () => {
    const result: GenerateValesFromAgendaResult = {
      generatedVales: [{
        valeId: 'vale-contract',
        numeroVale: 'VA-20260829-001',
        group: command.groups[0]!.key,
        outcome: 'GENERATED',
      }],
      conflicts: [],
      unresolvedItems: [{
        folio: 'FOLIO-UNRESOLVED',
        reason: 'EXPEDIENT_NOT_RESOLVED',
      }],
    };

    expect(result.generatedVales[0]?.numeroVale).toBe('VA-20260829-001');
    expect(result.unresolvedItems[0]?.reason).toBe('EXPEDIENT_NOT_RESOLVED');
  });
});
