/**
 * GeneratePreparationReport — application use case.
 *
 * Orchestrates: fetch items → filter by service → validate non-empty →
 *               generate PDF → write audit → return stream.
 *
 * Source: preparation-reports design.md §5.2, REQ-PR-002, REQ-PR-006..REQ-PR-008.
 *
 * Invariants enforced here:
 *   INV-PR-001 — at least one active cita must exist.
 *   INV-PR-005 — tenant isolation: TenantContext passed through to every port.
 *   INV-PR-008 — audit written for every invocation (success AND failure).
 *
 * This use case:
 *   - does NOT import PDFKit, NestJS, React or any infrastructure class.
 *   - does NOT create a new Aggregate.
 *   - does NOT write to the filesystem or any storage.
 *   - does NOT add fields to PreparationItem.
 */

import type { AuditResult, AuditWriter } from '@sigac/audit';
import type { RequestContext, TenantContext } from '@sigac/tenant';
import { ApplicationError } from '../ApplicationError.js';
import type { AgendaFecha } from '../../domain/value-objects/index.js';
import type { PreparationListQueryPort, PreparationOrder } from '../ports/ReadQueryPorts.js';
import type {
  PreparationReportGeneratorPort,
  ReportGenerationResult,
} from '../ports/PreparationReportGeneratorPort.js';

// ─── Input / Output contracts ────────────────────────────────────────────────

export interface GeneratePreparationReportCommand {
  readonly agendaDate: AgendaFecha;

  /**
   * Optional filter by service code(s). null / undefined = include all services.
   * Values are compared against PreparationItem.servicioEspecialidad.codigo.
   */
  readonly services?: readonly string[] | null;

  /** Ordering applied to the preparation list before PDF generation. */
  readonly order: PreparationOrder;

  /**
   * Full request context (actor + tenant + requestId + correlationId).
   * Server-resolved; never from HTTP body/query.
   * Passed directly to AuditWriter.append().
   */
  readonly context: RequestContext;

  /**
   * ID of the SIMEF import that sourced the citas for this date.
   * Used only in the audit entry (metadata.sourceImportId).
   * Obtained by the controller from AgendaDayReadModel.latestImportacionId.
   */
  readonly sourceImportId: string;
}

export interface GeneratePreparationReportResult {
  readonly stream: NodeJS.ReadableStream;
  readonly filename: string;
}

// ─── Dependencies ─────────────────────────────────────────────────────────────

export interface GeneratePreparationReportDeps {
  readonly preparationListQuery: PreparationListQueryPort;
  readonly reportGenerator: PreparationReportGeneratorPort;
  readonly auditWriter: AuditWriter;
}

// ─── Use Case ────────────────────────────────────────────────────────────────

export class GeneratePreparationReport {
  constructor(private readonly deps: GeneratePreparationReportDeps) {}

  async execute(
    command: GeneratePreparationReportCommand,
  ): Promise<GeneratePreparationReportResult> {
    const { agendaDate, order, context, sourceImportId } = command;
    const { tenant, actor } = context;
    const auditResourceId = agendaDate.value;

    // ── 1. Fetch all active items for this date / tenant ───────────────────
    const allItems = await this.deps.preparationListQuery.listForPrint(
      agendaDate,
      order,
      tenant,
    );

    // ── 2. Optional service filter ─────────────────────────────────────────
    const services = command.services;
    const items =
      services != null && services.length > 0
        ? allItems.filter((item) =>
            services.includes(item.servicioEspecialidad.codigo),
          )
        : allItems;

    // ── 3. Fail fast if no citas (INV-PR-001) ──────────────────────────────
    if (items.length === 0) {
      await this.audit(auditResourceId, context, 'not-found', {
        agendaDate: agendaDate.value,
        sourceImportId,
        serviceCount: services?.length ?? 0,
        recordCount: 0,
      });
      throw new ApplicationError(
        'NO_ACTIVE_APPOINTMENTS',
        `No hay citas activas para la fecha ${agendaDate.value}` +
          (services != null && services.length > 0
            ? ` en los servicios solicitados (${services.join(', ')})`
            : ''),
      );
    }

    // ── 4. Generate PDF stream ─────────────────────────────────────────────
    let result: ReportGenerationResult;
    try {
      result = await this.deps.reportGenerator.generate({
        agendaDate: agendaDate.value,
        items,
        order,
        sourceImportId,
      });
    } catch (err: unknown) {
      await this.audit(auditResourceId, context, 'conflict', {
        agendaDate: agendaDate.value,
        sourceImportId,
        serviceCount: services?.length ?? items.length,
        recordCount: items.length,
      });
      throw err;
    }

    // ── 5. Audit success (INV-PR-008) ──────────────────────────────────────
    // Audit metadata: no patient names, no folios, no PII.
    const uniqueServices = new Set(
      items.map((i) => i.servicioEspecialidad.codigo),
    ).size;

    await this.audit(auditResourceId, context, 'success', {
      agendaDate: agendaDate.value,
      sourceImportId,
      serviceCount: uniqueServices,
      recordCount: items.length,
    });

    return { stream: result.stream, filename: result.filename };
  }

  private audit(
    resourceId: string,
    context: RequestContext,
    result: AuditResult,
    metadata: {
      agendaDate: string;
      sourceImportId: string;
      serviceCount: number;
      recordCount: number;
    },
  ): Promise<void> {
    return this.deps.auditWriter.append(
      {
        action: 'AGENDA_REPORT_GENERATED',
        resourceType: 'AGENDA',
        resourceId: resourceId,
        result,
        // changeSummary carries non-PII operational metadata only.
        changeSummary: {
          agendaDate: metadata.agendaDate,
          sourceImportId: metadata.sourceImportId,
          serviceCount: String(metadata.serviceCount),
          recordCount: String(metadata.recordCount),
        },
      },
      context,
    );
  }
}
