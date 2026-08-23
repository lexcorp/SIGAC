import type {
  GetAgendaDaySummary,
  GetAgendaImportIncidents,
  GetAgendaImportResult,
  GetAgendaPreparationList,
  ImportAgenda,
  ListAgendaImports,
  PrintAgendaPreparationList,
} from '@sigac/agenda-preparation';
import type { RequestContext } from '@sigac/tenant';

/** Framework-neutral input owned by the HTTP infrastructure boundary. */
export interface HttpRequestContext {
  readonly nativeRequest: unknown;
}

export interface AuthenticatedRequestContextResolver {
  resolve(request: HttpRequestContext): Promise<RequestContext>;
}

export interface AgendaApiModuleDependencies {
  readonly requestContextResolver: AuthenticatedRequestContextResolver;
  readonly importAgenda: ImportAgenda;
  readonly getAgendaImportResult: GetAgendaImportResult;
  readonly listAgendaImports: ListAgendaImports;
  readonly getAgendaDaySummary: GetAgendaDaySummary;
  readonly getAgendaPreparationList: GetAgendaPreparationList;
  readonly printAgendaPreparationList: PrintAgendaPreparationList;
  readonly getAgendaImportIncidents: GetAgendaImportIncidents;
}

export const AGENDA_API_TOKENS = {
  requestContextResolver: Symbol('AgendaAuthenticatedRequestContextResolver'),
  importAgenda: Symbol('ImportAgenda'),
  getAgendaImportResult: Symbol('GetAgendaImportResult'),
  listAgendaImports: Symbol('ListAgendaImports'),
  getAgendaDaySummary: Symbol('GetAgendaDaySummary'),
  getAgendaPreparationList: Symbol('GetAgendaPreparationList'),
  printAgendaPreparationList: Symbol('PrintAgendaPreparationList'),
  getAgendaImportIncidents: Symbol('GetAgendaImportIncidents'),
} as const;

/** Environment variable key for the upload size limit (bytes). */
export const AGENDA_UPLOAD_SIZE_LIMIT_KEY = 'AGENDA_UPLOAD_SIZE_BYTES';

/** Sentinel: limit not configured — service must not start in production. */
export const AGENDA_UPLOAD_SIZE_LIMIT_UNCONFIGURED = 0;
