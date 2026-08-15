import type {
  AcceptCustody,
  DispatchExpediente,
  GetExpediente,
  GetExpedienteTimeline,
  GetExpedienteAudit,
  GetSessionAuthorization,
  ListUbicaciones,
  SearchExpedientesByNumero,
} from '@sigac/archive-operations';
import type { RequestContext } from '@sigac/tenant';

/** Framework-neutral input owned by the HTTP infrastructure boundary. */
export interface HttpRequestContext {
  readonly nativeRequest: unknown;
}

export interface AuthenticatedRequestContextResolver {
  resolve(request: HttpRequestContext): Promise<RequestContext>;
}

export interface ExpedienteApiModuleDependencies {
  readonly requestContextResolver: AuthenticatedRequestContextResolver;
  readonly getExpediente: GetExpediente;
  readonly getExpedienteTimeline: GetExpedienteTimeline;
  readonly getExpedienteAudit: GetExpedienteAudit;
  readonly getSessionAuthorization: GetSessionAuthorization;
  readonly listUbicaciones: ListUbicaciones;
  readonly searchExpedientesByNumero: SearchExpedientesByNumero;
  readonly dispatchExpediente: DispatchExpediente;
  readonly acceptCustody: AcceptCustody;
}

export const EXPEDIENTE_API_TOKENS = {
  requestContextResolver: Symbol('AuthenticatedRequestContextResolver'),
  getExpediente: Symbol('GetExpediente'),
  getExpedienteTimeline: Symbol('GetExpedienteTimeline'),
  getExpedienteAudit: Symbol('GetExpedienteAudit'),
  getSessionAuthorization: Symbol('GetSessionAuthorization'),
  listUbicaciones: Symbol('ListUbicaciones'),
  searchExpedientesByNumero: Symbol('SearchExpedientesByNumero'),
  dispatchExpediente: Symbol('DispatchExpediente'),
  acceptCustody: Symbol('AcceptCustody'),
} as const;
