/**
 * ValeArchivoReportGeneratorPort — port de generación PDF SM 1-14.
 *
 * Fuente: design.md §7.2, REQ-VA-002, ADR-0030 (PDFKit), ADR-0032 (BC independiente).
 *
 * El domain y Application no conocen PDFKit. El adapter vive en packages/platform/pdf.
 */

import type { ValeArchivoSnapshot } from '../../domain/aggregates/ValeArchivo.js';

export interface ValeArchivoReportResult {
  /** PDF stream — generado en memoria, nunca escrito a filesystem. */
  readonly stream: NodeJS.ReadableStream;
  /** filename para Content-Disposition: sm1-14-{numeroVale}-{YYYY-MM-DD}.pdf */
  readonly filename: string;
}

export interface ValeArchivoReportGeneratorPort {
  generate(snapshot: ValeArchivoSnapshot): Promise<ValeArchivoReportResult>;
}
