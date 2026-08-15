import type { RequestContext } from '@sigac/tenant';
import { ApplicationError } from './ApplicationError.js';
import type { UbicacionOption, UbicacionesQueryPort } from './UbicacionesQueryPort.js';

export interface ListUbicacionesInput {
  readonly context: RequestContext;
}

export class ListUbicaciones {
  constructor(private readonly ubicacionesQuery: UbicacionesQueryPort) {}

  async execute(input: ListUbicacionesInput): Promise<readonly UbicacionOption[]> {
    if (!input.context.actor.permissions.has('LOCATION_VIEW')) {
      throw new ApplicationError('PERMISSION_DENIED', 'El actor no puede consultar ubicaciones.');
    }
    return this.ubicacionesQuery.findAll(input.context.tenant);
  }
}
