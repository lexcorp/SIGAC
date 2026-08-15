import type { TenantContext } from '@sigac/tenant';
import type { ExpedienteId } from '../domain/value-objects/ExpedienteId.js';
import type { FuenteHabilitanteSalida } from '../domain/value-objects/FuenteHabilitanteSalida.js';
import type { EstadoSolicitud, FuenteHabilitanteSalidaContext } from './ExpedienteCapabilityService.js';

export interface ActiveRequestSummary {
  readonly solicitudId: string;
  readonly tipo: string;
  readonly origen: string;
  readonly estado: EstadoSolicitud;
  readonly asignadoA: string | null;
}

export interface ActiveRequestQueryPort {
  findActiveByExpedienteId(expedienteId: ExpedienteId, tenant: TenantContext): Promise<ActiveRequestSummary | null>;
}

export interface ActiveLoanSummary {
  readonly prestamoId: string;
  readonly finalidad: string;
  readonly custodioRef: string;
  readonly destinoTipo: string;
  readonly destinoRef: string;
  readonly dueAt: Date;
  readonly fuenteHabilitanteSalida: FuenteHabilitanteSalida;
  readonly estado: 'Activo' | 'Vencido';
}

export interface ActiveLoanQueryPort {
  findActiveByExpedienteId(expedienteId: ExpedienteId, tenant: TenantContext): Promise<ActiveLoanSummary | null>;
}

export interface OpenIncidentSummary {
  readonly incidenciaId: string;
  readonly tipo: string;
  readonly severidad: string;
  readonly estado: 'Abierta' | 'EnInvestigacion' | 'Escalada';
  readonly resumen: string;
  readonly asignadoA: string | null;
  readonly openedAt: Date;
}

export interface OpenIncidentsQueryPort {
  findOpenByExpedienteId(expedienteId: ExpedienteId, tenant: TenantContext): Promise<readonly OpenIncidentSummary[]>;
}

export interface ExitEnablingSourceQueryPort {
  findAvailableByExpediente(expedienteId: ExpedienteId, tenant: TenantContext): Promise<readonly FuenteHabilitanteSalidaContext[]>;
}
