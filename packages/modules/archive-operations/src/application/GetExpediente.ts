import type { RequestContext } from '@sigac/tenant';
import type { ExpedienteRepository } from '../domain/ports/ExpedienteRepository.js';
import type { EstadoOperativo, ExpedienteId } from '../domain/value-objects/index.js';
import { ApplicationError } from './ApplicationError.js';
import type { AuditResult, AuditWriter } from './AuditWriter.js';
import { ExpedienteCapabilityService, type ExpedienteCapability } from './ExpedienteCapabilityService.js';
import type {
  ActiveLoanQueryPort,
  ActiveLoanSummary,
  ActiveRequestQueryPort,
  ActiveRequestSummary,
  ExitEnablingSourceQueryPort,
  OpenIncidentSummary,
  OpenIncidentsQueryPort,
} from './ExpedienteWorkspaceQueryPorts.js';

export interface GetExpedienteInput {
  readonly expedienteId: ExpedienteId;
  readonly context: RequestContext;
}

export interface ExpedienteReadModel {
  readonly id: string;
  readonly expedienteNumero: string;
  readonly pacienteRef: { readonly id: string; readonly displayLabel: string };
  readonly estadoOperativo: EstadoOperativo;
  readonly ubicacionActual: {
    readonly id: string;
    readonly codigo: string;
    readonly descripcion: string;
  } | null;
  readonly custodiaActual: {
    readonly custodioTipo: string;
    readonly custodioRef: string;
    readonly servicio: string | null;
    readonly aceptadaEn: Date | null;
  } | null;
  readonly prestamoActivo: ActiveLoanSummary | null;
  readonly solicitudActiva: ActiveRequestSummary | null;
  readonly incidenciasAbiertas: readonly OpenIncidentSummary[];
  readonly capabilities: readonly ExpedienteCapability[];
  readonly rowVersion: bigint;
}

export interface GetExpedienteDependencies {
  readonly expedienteRepository: ExpedienteRepository;
  readonly activeRequestQuery: ActiveRequestQueryPort;
  readonly activeLoanQuery: ActiveLoanQueryPort;
  readonly openIncidentsQuery: OpenIncidentsQueryPort;
  readonly exitEnablingSourceQuery: ExitEnablingSourceQueryPort;
  readonly capabilityService: ExpedienteCapabilityService;
  readonly auditWriter: AuditWriter;
}

export class GetExpediente {
  constructor(private readonly dependencies: GetExpedienteDependencies) {}

  async execute(input: GetExpedienteInput): Promise<ExpedienteReadModel> {
    const { expedienteId, context } = input;

    if (!context.actor.permissions.has('EXPEDIENT_VIEW')) {
      await this.audit(expedienteId, context, 'denied');
      throw new ApplicationError(
        'PERMISSION_DENIED',
        'El actor no tiene permiso para consultar el Expediente.',
      );
    }

    const expediente = await this.dependencies.expedienteRepository.findById(
      expedienteId,
      context.tenant,
    );

    if (expediente === null) {
      await this.audit(expedienteId, context, 'not-found');
      throw new ApplicationError(
        'EXPEDIENTE_NOT_FOUND',
        'El Expediente no existe en el tenant activo.',
      );
    }

    const solicitudActiva = await this.dependencies.activeRequestQuery.findActiveByExpedienteId(
      expedienteId,
      context.tenant,
    );
    const prestamoActivo = await this.dependencies.activeLoanQuery.findActiveByExpedienteId(
      expedienteId,
      context.tenant,
    );
    const incidenciasAbiertas = await this.dependencies.openIncidentsQuery.findOpenByExpedienteId(
      expedienteId,
      context.tenant,
    );
    const fuentesHabilitantesSalida = await this.dependencies.exitEnablingSourceQuery.findAvailableByExpediente(
      expedienteId,
      context.tenant,
    );

    const snapshot = expediente.snapshot();
    const capabilities = this.dependencies.capabilityService.calculate({
      estadoOperativo: snapshot.estadoOperativo,
      solicitudActiva: solicitudActiva ? { estado: solicitudActiva.estado } : null,
      prestamoActivo: prestamoActivo ? { estado: prestamoActivo.estado } : null,
      fuentesHabilitantesSalida,
      actor: context.actor,
      tenant: context.tenant,
    });

    const readModel: ExpedienteReadModel = {
      id: snapshot.id.toString(),
      expedienteNumero: snapshot.expedienteNumero.toDisplay(),
      pacienteRef: {
        id: snapshot.pacienteReferencia.idInstitucional,
        displayLabel: snapshot.pacienteReferencia.nombreOperativo,
      },
      estadoOperativo: snapshot.estadoOperativo,
      ubicacionActual: snapshot.ubicacionActual
        ? {
            id: snapshot.ubicacionActual.id,
            codigo: snapshot.ubicacionActual.codigo,
            descripcion: snapshot.ubicacionActual.descripcion,
          }
        : null,
      custodiaActual: snapshot.custodiaActual
        ? {
            custodioTipo: snapshot.custodiaActual.custodianType,
            custodioRef: snapshot.custodiaActual.custodianReference,
            servicio: snapshot.custodiaActual.service,
            aceptadaEn: snapshot.custodiaActual.acceptedAt,
          }
        : null,
      prestamoActivo,
      solicitudActiva,
      incidenciasAbiertas,
      capabilities,
      rowVersion: snapshot.rowVersion,
    };

    await this.audit(expedienteId, context, 'success');
    return readModel;
  }

  private audit(
    expedienteId: ExpedienteId,
    context: RequestContext,
    result: AuditResult,
  ): Promise<void> {
    return this.dependencies.auditWriter.append(
      {
        action: 'EXPEDIENTE_VIEW',
        resourceType: 'EXPEDIENTE',
        resourceId: expedienteId.toString(),
        result,
      },
      context,
    );
  }
}
