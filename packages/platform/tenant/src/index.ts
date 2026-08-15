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

export interface RequestContext {
  readonly tenant: TenantContext;
  readonly actor: ActorContext;
  readonly correlationId: string;
}
