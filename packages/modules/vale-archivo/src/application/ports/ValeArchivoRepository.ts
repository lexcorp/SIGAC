/**
 * ValeArchivoRepository — port de escritura (write side).
 *
 * Fuente: design.md §8.1, ADR-0034 (database-per-tenant, sin tenant_id en tablas).
 *
 * La infraestructura que implemente este port es responsable de:
 *   - enrutar la conexión al schema del tenant mediante TenantDatabaseRouter.
 *   - serializar/deserializar ValeArchivoSnapshot ↔ filas SQL.
 *
 * Este port no conoce SQL, Drizzle ni ninguna clase de infraestructura.
 */

import type { TenantContext } from '@sigac/tenant';
import type { ValeArchivo, ValeArchivoSnapshot } from '../../domain/aggregates/ValeArchivo.js';

export interface ValeArchivoRepository {
  /**
   * Persiste el aggregate (INSERT o UPDATE).
   * La implementación decide si usa upsert o diferencia create/update.
   */
  save(vale: ValeArchivo, tenant: TenantContext): Promise<void>;

  /**
   * Recupera el aggregate por su id dentro del tenant activo.
   * Retorna null si no existe — NUNCA lanza error por not-found.
   */
  findById(id: string, tenant: TenantContext): Promise<ValeArchivoSnapshot | null>;

  /**
   * Verifica si ya existe un ValeArchivo con el mismo numero_vale en el tenant.
   * Usado en RegistrarVale para rechazar duplicados antes de persistir.
   * Retorna true si existe, false si no.
   */
  existsByNumeroVale(numeroVale: string, tenant: TenantContext): Promise<boolean>;
}
