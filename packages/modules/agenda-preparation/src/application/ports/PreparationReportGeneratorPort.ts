/**
 * PreparationReportGeneratorPort — port for on-demand PDF generation.
 *
 * Source: preparation-reports design.md §5.1, REQ-PR-002, REQ-PR-004.
 *
 * Contract:
 * - Receives only PreparationItem[] — no extra fields, no PII beyond what
 *   PreparationItem already holds.
 * - Returns a readable stream and a filename safe for Content-Disposition.
 * - The adapter (PDFKitPreparationReportGenerator) is the sole implementer.
 * - The use case (GeneratePreparationReport) is the sole caller.
 * - Domain and Application layers never import PDFKit directly.
 */

import type { PreparationItem, PreparationOrder } from './ReadQueryPorts.js';

// ─── Request ─────────────────────────────────────────────────────────────────

export interface ReportGenerationRequest {
  /**
   * Agenda date in YYYY-MM-DD format, used in the PDF header and filename.
   * Must be a valid ISO date string.
   */
  readonly agendaDate: string;

  /** Items to include in the report, already filtered and ordered by the use case. */
  readonly items: readonly PreparationItem[];

  /** Ordering applied to items — used for per-group sorting within the adapter. */
  readonly order: PreparationOrder;

  /**
   * ID of the SIMEF import that sourced these citas.
   * Used for audit log correlation only; never rendered in the PDF.
   * See design.md §5.3 — metadata.sourceImportId in the audit entry.
   */
  readonly sourceImportId: string;
}

// ─── Result ───────────────────────────────────────────────────────────────────

export interface ReportGenerationResult {
  /**
   * Readable stream of the generated PDF bytes.
   * The adapter is responsible for closing the stream when finished.
   * The caller (controller) pipes this stream directly to the HTTP response.
   */
  readonly stream: NodeJS.ReadableStream;

  /**
   * Safe filename for Content-Disposition header.
   * Format: "lista-preparacion-{YYYY-MM-DD}.pdf"
   * Must not contain patient data.
   */
  readonly filename: string;

  /**
   * Optional byte count estimate for Content-Length header.
   * Set only if the adapter can determine it without buffering the full document
   * a second time. The controller must treat this as advisory.
   */
  readonly byteEstimate?: number;
}

// ─── Port interface ───────────────────────────────────────────────────────────

export interface PreparationReportGeneratorPort {
  /**
   * Generates a PDF preparation report from the given items and returns
   * a readable stream. Throws on generation failure.
   *
   * @throws Error if items is empty (defensive; the use case prevents this).
   */
  generate(request: ReportGenerationRequest): Promise<ReportGenerationResult>;
}
