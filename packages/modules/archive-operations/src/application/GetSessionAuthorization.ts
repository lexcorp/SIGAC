import { isPermission, type Permission, type RequestContext } from '@sigac/tenant';

export interface SessionAuthorizationReadModel {
  readonly actorId: string;
  readonly permissions: readonly Permission[];
}

export interface GetSessionAuthorizationInput {
  readonly context: RequestContext;
}

export class GetSessionAuthorization {
  execute(input: GetSessionAuthorizationInput): SessionAuthorizationReadModel {
    return {
      actorId: input.context.actor.actorId,
      permissions: [...input.context.actor.permissions].filter(isPermission),
    };
  }
}
