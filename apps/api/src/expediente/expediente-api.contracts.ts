import type {
  AcceptCustody,
  DispatchExpediente,
  GetExpediente,
  GetExpedienteTimeline,
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
  readonly dispatchExpediente: DispatchExpediente;
  readonly acceptCustody: AcceptCustody;
}

export const EXPEDIENTE_API_TOKENS = {
  requestContextResolver: Symbol('AuthenticatedRequestContextResolver'),
  getExpediente: Symbol('GetExpediente'),
  getExpedienteTimeline: Symbol('GetExpedienteTimeline'),
  dispatchExpediente: Symbol('DispatchExpediente'),
  acceptCustody: Symbol('AcceptCustody'),
} as const;
