import type {
  AgendaDayReadModel,
  AgendaImportDetail,
  AgendaImportHistoryPage,
  AgendaImportIncidentsPage,
  AgendaImportResponse,
  AgendaProblemDetails,
  AgendaPreparationPage,
  AgendaPreparationPrintResponse,
  PreparationOrder,
} from '../types/agenda.types';

type Fetcher = typeof fetch;

export class AgendaApiError extends Error {
  readonly name = 'AgendaApiError';
  constructor(
    readonly status: number,
    readonly problem: AgendaProblemDetails | null,
  ) {
    super('No fue posible completar la operación.');
  }
}

export class AgendaApi {
  constructor(
    private readonly fetcher: Fetcher = (input, init) => fetch(input, init),
  ) {}

  /** POST /api/v1/agenda-imports — multipart upload */
  async importAgenda(
    file: File,
    idempotencyKey: string,
  ): Promise<AgendaImportResponse> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await this.fetcher('/api/v1/agenda-imports', {
      method: 'POST',
      headers: {
        'Idempotency-Key': idempotencyKey,
        Accept: 'application/json',
      },
      body: formData,
    });
    if (!response.ok) throw await this.toError(response);
    return response.json() as Promise<AgendaImportResponse>;
  }

  /** GET /api/v1/agendas/{date} */
  async getAgendaDay(date: string): Promise<AgendaDayReadModel> {
    return this.get(`/api/v1/agendas/${encodeURIComponent(date)}`);
  }

  /** GET /api/v1/agendas/{date}/preparation-items */
  async getPreparationList(
    date: string,
    order: PreparationOrder,
    limit: number,
    cursor?: string,
  ): Promise<AgendaPreparationPage> {
    const params = new URLSearchParams({ order, limit: String(limit) });
    if (cursor !== undefined) params.set('cursor', cursor);
    return this.get(`/api/v1/agendas/${encodeURIComponent(date)}/preparation-items?${params}`);
  }

  /** GET /api/v1/agendas/{date}/preparation-items/print */
  async printPreparationList(
    date: string,
    order: PreparationOrder,
  ): Promise<AgendaPreparationPrintResponse> {
    const params = new URLSearchParams({ order });
    return this.get(`/api/v1/agendas/${encodeURIComponent(date)}/preparation-items/print?${params}`);
  }

  /**
   * POST /api/v1/agendas/{date}/preparation-report
   * Generates and downloads a PDF preparation report.
   * Returns a Blob — caller must trigger browser download.
   * Requires AGENDA_VIEW + AGENDA_PRINT (enforced server-side).
   * T-23 / preparation-reports REQ-PR-002.
   */
  async generatePreparationReport(
    date: string,
    options: {
      readonly services?: readonly string[] | null;
      readonly order?: PreparationOrder;
    } = {},
  ): Promise<{ blob: Blob; filename: string }> {
    const body: Record<string, unknown> = { order: options.order ?? 'APPOINTMENT_TIME_ASC' };
    if (options.services != null && options.services.length > 0) {
      body['services'] = options.services;
    }
    const response = await this.fetcher(
      `/api/v1/agendas/${encodeURIComponent(date)}/preparation-report`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/pdf' },
        body: JSON.stringify(body),
      },
    );
    if (!response.ok) throw await this.toError(response);
    const blob = await response.blob();
    // Extract filename from Content-Disposition header if present
    const disposition = response.headers.get('Content-Disposition') ?? '';
    const match = /filename="([^"]+)"/.exec(disposition);
    const filename = match?.[1] ?? `lista-preparacion-${date}.pdf`;
    return { blob, filename };
  }

  /** GET /api/v1/agenda-imports */
  async listImports(
    limit: number,
    cursor?: string,
    agendaDate?: string,
  ): Promise<AgendaImportHistoryPage> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor !== undefined) params.set('cursor', cursor);
    if (agendaDate !== undefined) params.set('agendaDate', agendaDate);
    return this.get(`/api/v1/agenda-imports?${params}`);
  }

  /** GET /api/v1/agenda-imports/{id} */
  async getImportDetail(importacionId: string): Promise<AgendaImportDetail> {
    return this.get(`/api/v1/agenda-imports/${encodeURIComponent(importacionId)}`);
  }

  /** GET /api/v1/agenda-imports/{id}/incidents */
  async getImportIncidents(
    importacionId: string,
    limit: number,
    cursor?: string,
  ): Promise<AgendaImportIncidentsPage> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor !== undefined) params.set('cursor', cursor);
    return this.get(
      `/api/v1/agenda-imports/${encodeURIComponent(importacionId)}/incidents?${params}`,
    );
  }

  private async get<T>(url: string): Promise<T> {
    const response = await this.fetcher(url, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw await this.toError(response);
    return response.json() as Promise<T>;
  }

  private async toError(response: Response): Promise<AgendaApiError> {
    let problem: AgendaProblemDetails | null = null;
    try {
      problem = (await response.json()) as AgendaProblemDetails;
    } catch {
      /* opaque */
    }
    return new AgendaApiError(response.status, problem);
  }
}

export const agendaApi = new AgendaApi();
