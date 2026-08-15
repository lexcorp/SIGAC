import type {
  AcceptCustodyRequest,
  DispatchRequest,
  ExpedienteReadModel,
  ExpedienteSearchResponse,
  ProblemDetails,
  TimelinePage,
} from '../types/expediente.types';

type Fetcher = typeof fetch;

export class ExpedienteApiError extends Error {
  readonly name = 'ExpedienteApiError';

  constructor(
    readonly status: number,
    readonly problem: ProblemDetails | null,
  ) {
    super('No fue posible completar la operación.');
  }
}

export class ExpedienteApi {
  constructor(private readonly fetcher: Fetcher = fetch) {}

  async searchByNumero(numero: string): Promise<ExpedienteSearchResponse> {
    return this.get(`/api/v1/expedientes?numero=${encodeURIComponent(numero)}`);
  }

  async getById(expedienteId: string): Promise<ExpedienteReadModel> {
    return this.get(`/api/v1/expedientes/${encodeURIComponent(expedienteId)}`);
  }

  async getTimeline(
    expedienteId: string,
    input: { readonly limit: number; readonly cursor?: string },
  ): Promise<TimelinePage> {
    const params = new URLSearchParams({ limit: String(input.limit) });
    if (input.cursor !== undefined) params.set('cursor', input.cursor);
    return this.get(`/api/v1/expedientes/${encodeURIComponent(expedienteId)}/timeline?${params}`);
  }

  dispatch(expedienteId: string, body: DispatchRequest): Promise<void> {
    return this.command(`/api/v1/expedientes/${encodeURIComponent(expedienteId)}/dispatch`, body);
  }

  acceptCustody(expedienteId: string, body: AcceptCustodyRequest): Promise<void> {
    return this.command(`/api/v1/expedientes/${encodeURIComponent(expedienteId)}/accept-custody`, body);
  }

  private async get<T>(url: string): Promise<T> {
    const response = await this.fetcher(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw await this.toError(response);
    return response.json() as Promise<T>;
  }

  private async command(url: string, body: DispatchRequest | AcceptCustodyRequest): Promise<void> {
    const response = await this.fetcher(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw await this.toError(response);
  }

  private async toError(response: Response): Promise<ExpedienteApiError> {
    let problem: ProblemDetails | null = null;
    try {
      problem = await response.json() as ProblemDetails;
    } catch {
      // A non-Problem response remains opaque to the UI.
    }
    return new ExpedienteApiError(response.status, problem);
  }
}

export const expedienteApi = new ExpedienteApi();
