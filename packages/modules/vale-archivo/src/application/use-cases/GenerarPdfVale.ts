/**
 * GenerarPdfVale — use case VA-002
 *
 * ARCHIVE_REQUEST_VIEW | REQUEST_CREATE → recuperar snapshot → generar PDF → auditar.
 *
 * Fuente: design.md §8.2, REQ-VA-002, INV-VA-004, INV-VA-008, INV-VA-009.
 *
 * El use case NO conoce PDFKit. Delega al port ValeArchivoReportGeneratorPort.
 */

import type { AuditWriter } from '@sigac/audit';
import type { RequestContext } from '@sigac/tenant';
import type { ValeArchivoQueryPort } from '../ports/ValeArchivoQueryPort.js';
import type {
  ValeArchivoReportGeneratorPort,
  ValeArchivoReportResult,
} from '../ports/ValeArchivoReportGeneratorPort.js';
import { ApplicationError } from '../ApplicationError.js';

export interface GenerarPdfValeQuery {
  readonly valeId: string;
  readonly context: RequestContext;
}

export interface GenerarPdfValeDeps {
  readonly queryPort: ValeArchivoQueryPort;
  readonly pdfGenerator: ValeArchivoReportGeneratorPort;
  readonly auditWriter: AuditWriter;
}

export class GenerarPdfVale {
  constructor(private readonly deps: GenerarPdfValeDeps) {}

  async execute(query: GenerarPdfValeQuery): Promise<ValeArchivoReportResult> {
    const { valeId, context } = query;

    // ── 1. Permiso (ADR-0033) ───────────────────────────────────────────────
    if (
      !context.actor.permissions.has('ARCHIVE_REQUEST_VIEW') &&
      !context.actor.permissions.has('REQUEST_CREATE')
    ) {
      await this.audit(valeId, 'denied', context);
      throw new ApplicationError(
        'PERMISSION_DENIED',
        'ARCHIVE_REQUEST_VIEW o REQUEST_CREATE requerido.',
      );
    }

    // ── 2. Obtener snapshot (ADR-0034: tenant del context) ──────────────────
    const snapshot = await this.deps.queryPort.findByIdForDetail(valeId, context.tenant);
    if (snapshot === null) {
      await this.audit(valeId, 'not-found', context);
      throw new ApplicationError(
        'VALE_ARCHIVO_NOT_FOUND',
        `ValeArchivo "${valeId}" no encontrado.`,
      );
    }

    // ── 3. Generar PDF (dominio no conoce PDFKit) ───────────────────────────
    const result = await this.deps.pdfGenerator.generate(snapshot);

    // ── 4. Audit (INV-VA-006 — sin PII de pacientes individuales) ───────────
    await this.audit(valeId, 'success', context);

    return result;
  }

  private audit(
    resourceId: string,
    result: 'success' | 'denied' | 'not-found',
    context: RequestContext,
  ): Promise<void> {
    return this.deps.auditWriter.append(
      {
        action: 'VALE_PDF_GENERADO',
        resourceType: 'VALE_ARCHIVO',
        resourceId,
        result,
      },
      context,
    );
  }
}
