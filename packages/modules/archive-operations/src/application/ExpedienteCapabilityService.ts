import type { ActorContext, TenantContext } from '@sigac/tenant';

import type { EstadoOperativo } from '../domain/value-objects/EstadoOperativo.js';
import type { FuenteHabilitanteSalida } from '../domain/value-objects/FuenteHabilitanteSalida.js';

export const EXPEDIENTE_CAPABILITIES = [
  'SOLICITAR',
  'INICIAR_BUSQUEDA',
  'MARCAR_LOCALIZADO',
  'MARCAR_NO_LOCALIZADO',
  'DISPATCH',
  'ACCEPT_CUSTODY',
  'ABRIR_PRESTAMO',
  'RENOVAR_PRESTAMO',
  'RECIBIR_DEVOLUCION',
  'CONFIRMAR_REARCHIVO',
  'REPORTAR_INCIDENCIA',
] as const;

export type ExpedienteCapability = (typeof EXPEDIENTE_CAPABILITIES)[number];

export const ESTADOS_SOLICITUD = [
  'Pendiente',
  'Asignada',
  'EnBusqueda',
  'Localizada',
  'Preparada',
  'Entregada',
  'Cancelada',
  'NoLocalizada',
] as const;

export type EstadoSolicitud = (typeof ESTADOS_SOLICITUD)[number];

export const ESTADOS_PRESTAMO = [
  'Activo',
  'Vencido',
  'Renovado',
  'Devuelto',
  'Cerrado',
] as const;

export type EstadoPrestamo = (typeof ESTADOS_PRESTAMO)[number];

export interface SolicitudActivaContext {
  readonly estado: EstadoSolicitud;
}

export interface PrestamoActivoContext {
  readonly estado: EstadoPrestamo;
  readonly devolucionVerificada?: boolean;
}

export interface FuenteHabilitanteSalidaContext {
  readonly tipo: FuenteHabilitanteSalida;
  readonly validada: boolean;
}

export interface ExpedienteCapabilityInput {
  readonly estadoOperativo: EstadoOperativo;
  readonly solicitudActiva: SolicitudActivaContext | null;
  readonly prestamoActivo: PrestamoActivoContext | null;
  readonly fuenteHabilitanteSalida: FuenteHabilitanteSalidaContext | null;
  readonly actor: ActorContext;
  readonly tenant: TenantContext;
}

const ARCHIVO_ROLES = new Set(['ARCHIVISTA', 'ARCHIVO_JEFE']);

export class ExpedienteCapabilityService {
  calculate(input: ExpedienteCapabilityInput): readonly ExpedienteCapability[] {
    const { actor } = input;

    if (
      !actor.permissions.has('EXPEDIENT_VIEW') ||
      actor.roles.has('AUDITOR_CONSULTA')
    ) {
      return [];
    }

    const capabilities: ExpedienteCapability[] = [];
    const isArchivo = this.hasAnyRole(actor, ARCHIVO_ROLES);

    this.addIf(
      capabilities,
      'SOLICITAR',
      input.estadoOperativo === 'DISPONIBLE' && input.solicitudActiva === null,
      actor,
      'REQUEST_CREATE',
    );
    this.addIf(
      capabilities,
      'INICIAR_BUSQUEDA',
      input.solicitudActiva?.estado === 'Asignada',
      actor,
      'SEARCH_START',
    );
    this.addIf(
      capabilities,
      'MARCAR_LOCALIZADO',
      input.solicitudActiva?.estado === 'EnBusqueda',
      actor,
      'SEARCH_MARK_LOCATED',
    );
    this.addIf(
      capabilities,
      'MARCAR_NO_LOCALIZADO',
      input.solicitudActiva?.estado === 'EnBusqueda',
      actor,
      'SEARCH_MARK_NOT_LOCATED',
    );
    this.addIf(
      capabilities,
      'DISPATCH',
      input.estadoOperativo === 'APARTADO' && isArchivo,
      actor,
      'EXPEDIENT_DISPATCH',
    );
    this.addIf(
      capabilities,
      'ACCEPT_CUSTODY',
      input.estadoOperativo === 'EN_TRASLADO' && actor.roles.has('RECEPTOR_SERVICIO'),
      actor,
      'CUSTODY_ACCEPT',
    );
    this.addIf(
      capabilities,
      'ABRIR_PRESTAMO',
      input.estadoOperativo === 'DISPONIBLE' &&
        input.prestamoActivo === null &&
        isArchivo &&
        this.fuentePermiteAbrirPrestamo(input.fuenteHabilitanteSalida),
      actor,
      'LOAN_OPEN',
    );
    this.addIf(
      capabilities,
      'RENOVAR_PRESTAMO',
      input.prestamoActivo?.estado === 'Activo',
      actor,
      'LOAN_RENEW',
    );
    this.addIf(
      capabilities,
      'RECIBIR_DEVOLUCION',
      input.prestamoActivo?.estado === 'Activo' ||
        input.prestamoActivo?.estado === 'Vencido',
      actor,
      'RETURN_RECEIVE',
    );
    this.addIf(
      capabilities,
      'CONFIRMAR_REARCHIVO',
      input.prestamoActivo?.estado === 'Devuelto' &&
        input.prestamoActivo.devolucionVerificada === true,
      actor,
      'REARCHIVE_CONFIRM',
    );
    this.addIf(
      capabilities,
      'REPORTAR_INCIDENCIA',
      true,
      actor,
      'INCIDENT_OPEN',
    );

    return capabilities;
  }

  private fuentePermiteAbrirPrestamo(
    fuente: FuenteHabilitanteSalidaContext | null,
  ): boolean {
    if (fuente?.tipo === 'CONSULTA_PROGRAMADA') {
      return true;
    }

    return fuente?.tipo === 'VALE_ARCHIVO_SM_1_14' && fuente.validada;
  }

  private hasAnyRole(actor: ActorContext, roles: ReadonlySet<string>): boolean {
    return [...roles].some((role) => actor.roles.has(role));
  }

  private addIf(
    capabilities: ExpedienteCapability[],
    capability: ExpedienteCapability,
    contextIsValid: boolean,
    actor: ActorContext,
    permission: string,
  ): void {
    if (contextIsValid && actor.permissions.has(permission)) {
      capabilities.push(capability);
    }
  }
}
