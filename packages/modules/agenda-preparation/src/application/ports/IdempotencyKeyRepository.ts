import type { TenantContext } from '@sigac/tenant';
import type { ImportacionAgendaId } from '../../domain/value-objects/index.js';

// PORT-AP-008 — Idempotency key tracking (Application-level concern)
export interface IdempotencyKeyRepository {
  /**
   * Returns the importacionId previously recorded for this key in this tenant, or null if
   * no prior record exists.
   */
  findByKey(
    key: string,
    tenant: TenantContext,
  ): Promise<{ readonly importacionId: ImportacionAgendaId } | null>;

  /**
   * Records an association between an idempotency key and a confirmed ImportacionAgenda.
   * Must be called inside the UoW transaction so the association is durable.
   */
  recordKey(
    key: string,
    importacionId: ImportacionAgendaId,
    tenant: TenantContext,
  ): Promise<void>;
}
