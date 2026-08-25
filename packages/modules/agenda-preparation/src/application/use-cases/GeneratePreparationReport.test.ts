/**
 * T-21 — GeneratePreparationReport use case unit tests
 *
 * All dependencies are mocked. No PostgreSQL, no PDFKit, no HTTP.
 * Source: preparation-reports REQ-PR-002, REQ-PR-006, REQ-PR-007, REQ-PR-008, design.md §5.2.
 */

import { Readable } from 'node:stream';
import type { AuditEntry } from '@sigac/audit';
import type { RequestContext, TenantContext } from '@sigac/tenant';
import { describe, expect, it, vi, type Mock } from 'vitest';
import { ApplicationError } from '../ApplicationError.js';
import {
  AgendaFecha,
  ServicioEspecialidad,
  NumeroEmpleado,
} from '../../domain/value-objects/index.js';
import {
  GeneratePreparationReport,
  type GeneratePreparationReportCommand,
} from './GeneratePreparationReport.js';
import type { PreparationItem } from '../ports/ReadQueryPorts.js';
import type { ReportGenerationResult } from '../ports/PreparationReportGeneratorPort.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TENANT: TenantContext = {
  tenantId: 'tenant-pr',
  slug: 'hospital-pr',
  hospitalId: 'hosp-pr',
  databaseName: 'sigac_pr',
  timezone: 'America/Mexico_City',
};

const CONTEXT: RequestContext = {
  actor: {
    actorId: 'actor-pr',
    roles: new Set(['ARCHIVISTA']),
    permissions: new Set(['AGENDA_VIEW', 'AGENDA_PRINT']),
    tenantIds: new Set(['tenant-pr']),
  },
  tenant: TENANT,
  requestId: 'req-pr-001',
  correlationId: 'corr-pr-001',
  source: 'WEB',
};

function makeItem(overrides: Partial<PreparationItem> = {}): PreparationItem {
  return {
    folio: 'FOLIO-PR-001',
    nombrePaciente: 'PACIENTE SINTETICO PR',
    expediente: { original: 'PRXX810101/10', reference: null },
    tipoDerechohabiente: '10',
    tipoConsulta: 'FIRST_TIME',
    agendaDate: '2026-09-01',
    appointmentTime: '08:00',
    medico: { numeroEmpleado: '55501', nombre: 'DR SINTETICO PR' },
    servicioEspecialidad: { codigo: 'CIR', nombre: 'CIRUGIA SINTETICA' },
    ...overrides,
  };
}

function makeStream(): NodeJS.ReadableStream {
  return Readable.from(['%PDF-1.4 synthetic']);
}

function makeResult(): ReportGenerationResult {
  return {
    stream: makeStream(),
    filename: 'lista-preparacion-2026-09-01.pdf',
  };
}

// ─── Mock factory ─────────────────────────────────────────────────────────────

function makeMocks(itemsToReturn: readonly PreparationItem[] = [makeItem()]) {
  const auditWriter = { append: vi.fn().mockResolvedValue(undefined) };

  const preparationListQuery = {
    findPage: vi.fn(),
    listForPrint: vi.fn().mockResolvedValue(itemsToReturn),
  };

  const reportGenerator = {
    generate: vi.fn().mockResolvedValue(makeResult()),
  };

  const useCase = new GeneratePreparationReport({
    preparationListQuery,
    reportGenerator,
    auditWriter,
  });

  return { useCase, preparationListQuery, reportGenerator, auditWriter };
}

function makeCommand(
  overrides: Partial<GeneratePreparationReportCommand> = {},
): GeneratePreparationReportCommand {
  return {
    agendaDate: AgendaFecha.parse('2026-09-01'),
    order: 'APPOINTMENT_TIME_ASC',
    context: CONTEXT,
    sourceImportId: 'import-pr-001',
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GeneratePreparationReport — T-21', () => {
  describe('happy path: items available, no service filter', () => {
    it('calls listForPrint with correct agendaDate, order and tenant', async () => {
      const { useCase, preparationListQuery } = makeMocks();
      await useCase.execute(makeCommand());
      expect(preparationListQuery.listForPrint).toHaveBeenCalledWith(
        expect.objectContaining({ value: '2026-09-01' }),
        'APPOINTMENT_TIME_ASC',
        TENANT,
      );
    });

    it('passes all items to generate() when no service filter is given', async () => {
      const items = [makeItem({ folio: 'F1' }), makeItem({ folio: 'F2' })];
      const { useCase, reportGenerator } = makeMocks(items);
      await useCase.execute(makeCommand());
      const req = (reportGenerator.generate as Mock).mock.calls[0]![0];
      expect(req.items).toHaveLength(2);
    });

    it('includes sourceImportId in the generate request', async () => {
      const { useCase, reportGenerator } = makeMocks();
      await useCase.execute(makeCommand({ sourceImportId: 'imp-xyz' }));
      const req = (reportGenerator.generate as Mock).mock.calls[0]![0];
      expect(req.sourceImportId).toBe('imp-xyz');
    });

    it('returns stream and filename from the generator', async () => {
      const { useCase } = makeMocks();
      const result = await useCase.execute(makeCommand());
      expect(result.filename).toBe('lista-preparacion-2026-09-01.pdf');
      expect(result.stream).toBeDefined();
    });

    it('writes audit SUCCESS entry after generation', async () => {
      const { useCase, auditWriter } = makeMocks();
      await useCase.execute(makeCommand());
      const calls = (auditWriter.append as Mock).mock.calls as [AuditEntry][];
      const successCall = calls.find(([e]) => e.result === 'success');
      expect(successCall).toBeDefined();
      const [entry] = successCall!;
      expect(entry.action).toBe('AGENDA_REPORT_GENERATED');
      expect(entry.resourceType).toBe('AGENDA');
      expect(entry.resourceId).toBe('2026-09-01');
    });

    it('audit SUCCESS changeSummary contains agendaDate and sourceImportId but not patient name or folio', async () => {
      const { useCase, auditWriter } = makeMocks();
      await useCase.execute(makeCommand({ sourceImportId: 'imp-audit-check' }));
      const calls = (auditWriter.append as Mock).mock.calls as [AuditEntry][];
      const [entry] = calls.find(([e]) => e.result === 'success')!;
      const summary = entry.changeSummary ?? {};
      expect(summary).toHaveProperty('agendaDate', '2026-09-01');
      expect(summary).toHaveProperty('sourceImportId', 'imp-audit-check');
      expect(summary).toHaveProperty('recordCount');
      expect(summary).toHaveProperty('serviceCount');
      // Must NOT contain PII
      const summaryStr = JSON.stringify(summary);
      expect(summaryStr).not.toContain('PACIENTE');
      expect(summaryStr).not.toContain('FOLIO');
      expect(summaryStr).not.toContain('PRXX810101');
    });
  });

  describe('service filter', () => {
    it('passes only matching items to generate() when services filter is provided', async () => {
      const items = [
        makeItem({ servicioEspecialidad: { codigo: 'CIR', nombre: 'CIRUGIA' } }),
        makeItem({ servicioEspecialidad: { codigo: 'CARD', nombre: 'CARDIO' } }),
        makeItem({ servicioEspecialidad: { codigo: 'CIR', nombre: 'CIRUGIA' } }),
      ];
      const { useCase, reportGenerator } = makeMocks(items);
      await useCase.execute(makeCommand({ services: ['CIR'] }));
      const req = (reportGenerator.generate as Mock).mock.calls[0]![0];
      expect(req.items).toHaveLength(2);
      expect(req.items.every((i: PreparationItem) => i.servicioEspecialidad.codigo === 'CIR')).toBe(true);
    });

    it('includes all items when services is null', async () => {
      const items = [makeItem(), makeItem({ folio: 'F2' })];
      const { useCase, reportGenerator } = makeMocks(items);
      await useCase.execute(makeCommand({ services: null }));
      const req = (reportGenerator.generate as Mock).mock.calls[0]![0];
      expect(req.items).toHaveLength(2);
    });

    it('includes all items when services is undefined', async () => {
      const items = [makeItem(), makeItem({ folio: 'F2' })];
      const { useCase, reportGenerator } = makeMocks(items);
      const cmd = makeCommand();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { services: _s, ...cmdWithoutServices } = cmd;
      await useCase.execute(cmdWithoutServices as GeneratePreparationReportCommand);
      const req = (reportGenerator.generate as Mock).mock.calls[0]![0];
      expect(req.items).toHaveLength(2);
    });
  });

  describe('INV-PR-001: NoActiveAppointmentsError when no items', () => {
    it('throws NO_ACTIVE_APPOINTMENTS when listForPrint returns empty array', async () => {
      const { useCase } = makeMocks([]);
      await expect(useCase.execute(makeCommand())).rejects.toMatchObject({
        name: 'ApplicationError',
        code: 'NO_ACTIVE_APPOINTMENTS',
      });
    });

    it('throws NO_ACTIVE_APPOINTMENTS when service filter leaves zero items', async () => {
      const { useCase } = makeMocks([
        makeItem({ servicioEspecialidad: { codigo: 'CIR', nombre: 'CIRUGIA' } }),
      ]);
      await expect(
        useCase.execute(makeCommand({ services: ['CARD'] })),
      ).rejects.toMatchObject({ code: 'NO_ACTIVE_APPOINTMENTS' });
    });

    it('does NOT call generate() when items are empty', async () => {
      const { useCase, reportGenerator } = makeMocks([]);
      await useCase.execute(makeCommand()).catch(() => undefined);
      expect(reportGenerator.generate).not.toHaveBeenCalled();
    });

    it('writes audit not-found entry when no items', async () => {
      const { useCase, auditWriter } = makeMocks([]);
      await useCase.execute(makeCommand()).catch(() => undefined);
      const calls = (auditWriter.append as Mock).mock.calls as [AuditEntry][];
      const notFound = calls.find(([e]) => e.result === 'not-found');
      expect(notFound).toBeDefined();
    });
  });

  describe('INV-PR-007: tenant isolation', () => {
    it('passes TenantContext from context to listForPrint — never from HTTP body', async () => {
      const { useCase, preparationListQuery } = makeMocks();
      await useCase.execute(makeCommand());
      const [, , passedTenant] = (preparationListQuery.listForPrint as Mock).mock.calls[0]!;
      expect(passedTenant).toStrictEqual(TENANT);
    });
  });

  describe('generator failure handling', () => {
    it('writes audit conflict entry and re-throws on generator error', async () => {
      const { useCase, reportGenerator, auditWriter } = makeMocks();
      (reportGenerator.generate as Mock).mockRejectedValue(
        new Error('PDF generation failed'),
      );
      await expect(useCase.execute(makeCommand())).rejects.toThrow('PDF generation failed');
      const calls = (auditWriter.append as Mock).mock.calls as [AuditEntry][];
      const conflictCall = calls.find(([e]) => e.result === 'conflict');
      expect(conflictCall).toBeDefined();
    });
  });

  describe('audit entry correctness', () => {
    it('audit entry passes RequestContext directly to auditWriter', async () => {
      const { useCase, auditWriter } = makeMocks();
      await useCase.execute(makeCommand());
      const calls = (auditWriter.append as Mock).mock.calls;
      const successCallPair = calls.find((pair) => (pair[0] as AuditEntry).result === 'success')!;
      const [, ctx] = successCallPair;;
      expect(ctx).toStrictEqual(CONTEXT);
    });
  });
});
