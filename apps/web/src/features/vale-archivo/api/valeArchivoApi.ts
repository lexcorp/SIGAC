/**
 * valeArchivoApi — cliente HTTP para el bounded context Vale Archivo.
 *
 * Patrón idéntico a agendaApi.ts:
 *   - Clase inyectable con fetcher intercambiable (tests)
 *   - ValeArchivoApiError con code RFC7807
 *   - Singleton `valeArchivoApi` para producción
 */
import type {
  CreateValeInput,
  EstadoVale,
  RegistrarEntregaInput,
  RegistrarLocalizacionInput,
  ValeArchivoProblem,
  ValeArchivoDetail,
  ValeArchivoPage,
  ValeArchivoSummary,
} from '../types/vale-archivo.types';

type Fetcher = typeof fetch;

export class ValeArchivoApiError extends Error {
  readonly name = 'ValeArchivoApiError';
  constructor(
    readonly status: number,
    readonly problem: ValeArchivoProblem | null,
  ) {
    super('No fue posible completar la operación de Vale Archivo.');
  }
}

async function parseProblem(res: Response): Promise<ValeArchivoProblem | null> {
  try {
    return (await res.json()) as ValeArchivoProblem;
  } catch {
    return null;
  }
}

export class ValeArchivoApi {
  constructor(
    private readonly fetcher: Fetcher = (input, init) => fetch(input, init),
  ) {}

  // ── Lista paginada (cursor-based) ────────────────────────────────────────

  async listVales(opts: {
    limit?: number;
    cursor?: string;
    estado?: EstadoVale;
    fecha?: string;
    unidad?: string;
  } = {}): Promise<ValeArchivoPage> {
    const params = new URLSearchParams();
    if (opts.limit)  params.set('limit',  String(opts.limit));
    if (opts.cursor) params.set('cursor', opts.cursor);
    if (opts.estado) params.set('estado', opts.estado);
    if (opts.fecha)  params.set('fecha',  opts.fecha);
    if (opts.unidad) params.set('unidad', opts.unidad);
    const qs = params.size > 0 ? `?${params.toString()}` : '';
    const res = await this.fetcher(`/api/v1/vale-archivo${qs}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new ValeArchivoApiError(res.status, await parseProblem(res));
    return res.json() as Promise<ValeArchivoPage>;
  }

  // ── Detalle ──────────────────────────────────────────────────────────────

  async getVale(id: string): Promise<ValeArchivoDetail> {
    const res = await this.fetcher(`/api/v1/vale-archivo/${encodeURIComponent(id)}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new ValeArchivoApiError(res.status, await parseProblem(res));
    return res.json() as Promise<ValeArchivoDetail>;
  }

  // ── Crear ────────────────────────────────────────────────────────────────

  async createVale(input: CreateValeInput): Promise<Pick<ValeArchivoSummary, 'id' | 'numeroVale' | 'estado'>> {
    const res = await this.fetcher('/api/v1/vale-archivo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new ValeArchivoApiError(res.status, await parseProblem(res));
    return res.json() as Promise<Pick<ValeArchivoSummary, 'id' | 'numeroVale' | 'estado'>>;
  }

  // ── Transiciones ─────────────────────────────────────────────────────────

  async iniciarBusqueda(id: string): Promise<void> {
    const res = await this.fetcher(
      `/api/v1/vale-archivo/${encodeURIComponent(id)}/iniciar-busqueda`,
      { method: 'POST', headers: { Accept: 'application/json' } },
    );
    if (!res.ok) throw new ValeArchivoApiError(res.status, await parseProblem(res));
  }

  async registrarLocalizacion(
    id: string,
    itemId: string,
    input: RegistrarLocalizacionInput,
  ): Promise<void> {
    const res = await this.fetcher(
      `/api/v1/vale-archivo/${encodeURIComponent(id)}/items/${encodeURIComponent(itemId)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(input),
      },
    );
    if (!res.ok) throw new ValeArchivoApiError(res.status, await parseProblem(res));
  }

  async registrarEntrega(id: string, input: RegistrarEntregaInput): Promise<void> {
    const res = await this.fetcher(
      `/api/v1/vale-archivo/${encodeURIComponent(id)}/entrega`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(input),
      },
    );
    if (!res.ok) throw new ValeArchivoApiError(res.status, await parseProblem(res));
  }

  async cerrarVale(id: string, motivo?: string): Promise<void> {
    const res = await this.fetcher(
      `/api/v1/vale-archivo/${encodeURIComponent(id)}/cerrar`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ motivo }),
      },
    );
    if (!res.ok) throw new ValeArchivoApiError(res.status, await parseProblem(res));
  }

  // ── PDF ───────────────────────────────────────────────────────────────────
  // Descarga el PDF SM 1-14 y dispara la descarga del navegador.

  async descargarPdf(id: string, filename: string): Promise<void> {
    const res = await this.fetcher(
      `/api/v1/vale-archivo/${encodeURIComponent(id)}/pdf`,
      { headers: { Accept: 'application/pdf' } },
    );
    if (!res.ok) throw new ValeArchivoApiError(res.status, await parseProblem(res));
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
}

export const valeArchivoApi = new ValeArchivoApi();
