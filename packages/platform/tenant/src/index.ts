export interface TenantContext {
  readonly tenantId: string;
  readonly slug: string;
  readonly hospitalId: string;
  readonly databaseName: string;
  readonly timezone: string;
}

export const PERMISSIONS = [
  'REQUEST_CREATE', 'REQUEST_ASSIGN', 'SEARCH_START', 'SEARCH_MARK_LOCATED',
  'SEARCH_MARK_NOT_LOCATED', 'PREPARATION_MARK_READY', 'CUSTODY_TRANSFER',
  'EXPEDIENT_DISPATCH', 'CUSTODY_ACCEPT', 'LOAN_OPEN', 'LOAN_RENEW',
  'RETURN_RECEIVE', 'REARCHIVE_CONFIRM', 'INCIDENT_OPEN', 'INCIDENT_RESOLVE',
  'EXPEDIENT_VIEW', 'EXPEDIENT_AUDIT_VIEW', 'LOCATION_VIEW', 'REPORT_VIEW',
  'ADMIN_CONFIGURE',
  'AGENDA_IMPORT', 'AGENDA_VIEW', 'AGENDA_INCIDENT_VIEW',
  // T-20 / preparation-reports — REQ-PR-005, ADR-0030
  // Required to generate the preparation PDF report (POST /agendas/{date}/preparation-report).
  // Does NOT grant AGENDA_VIEW by itself; both permissions are required AND-together.
  // Not derived automatically from any role.
  'AGENDA_PRINT',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}

export interface ActorContext {
  readonly actorId: string;
  readonly roles: ReadonlySet<string>;
  readonly permissions: ReadonlySet<string>;
  readonly tenantIds: ReadonlySet<string>;
}

export const REQUEST_SOURCES = ['WEB', 'INTERNAL'] as const;

export type RequestSource = (typeof REQUEST_SOURCES)[number];

export interface RequestContext {
  readonly actor: ActorContext;
  readonly tenant: TenantContext;
  readonly requestId: string;
  readonly correlationId: string;
  readonly source: RequestSource;
}
