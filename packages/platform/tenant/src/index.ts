export interface TenantContext {
  readonly tenantId: string;
  readonly slug: string;
  readonly hospitalId: string;
  readonly databaseName: string;
  readonly timezone: string;
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
