import type { RequestContext } from '@sigac/tenant';
import type { ExpedienteRepository } from '../domain/ports/ExpedienteRepository.js';
import type {
  EstadoOperativo,
  ExpedienteNumero,
  Ubicacion,
} from '../domain/value-objects/index.js';
import { ApplicationError } from './ApplicationError.js';
import type { AuditWriter } from './AuditWriter.js';

export interface SearchExpedientesByNumeroInput {
  readonly numero: ExpedienteNumero;
  readonly context: RequestContext;
}

export interface ExpedienteSearchItem {
  readonly expedienteId: string;
  readonly expedienteNumero: string;
  readonly paciente: {
    readonly idInstitucional: string;
    readonly curp: string;
    readonly nombreOperativo: string;
    readonly numeroIssste: string;
  };
  readonly estadoOperativo: EstadoOperativo;
  readonly ubicacion: Ubicacion | null;
}

export interface SearchExpedientesByNumeroDependencies {
  readonly expedienteRepository: ExpedienteRepository;
  readonly auditWriter: AuditWriter;
}

export class SearchExpedientesByNumero {
  constructor(private readonly dependencies: SearchExpedientesByNumeroDependencies) {}

  async execute(
    input: SearchExpedientesByNumeroInput,
  ): Promise<readonly ExpedienteSearchItem[]> {
    const { numero, context } = input;

    if (!context.actor.permissions.has('EXPEDIENT_VIEW')) {
      await this.dependencies.auditWriter.append(
        {
          action: 'EXPEDIENTE_SEARCH',
          resourceType: 'EXPEDIENTE',
          resourceId: numero.toNormalized(),
          result: 'denied',
        },
        context,
      );
      throw new ApplicationError(
        'PERMISSION_DENIED',
        'El actor no tiene permiso para buscar Expedientes.',
      );
    }

    const expedientes = await this.dependencies.expedienteRepository.findByNumero(
      numero,
      context.tenant,
    );
    const items = expedientes.map((expediente): ExpedienteSearchItem => {
      const snapshot = expediente.snapshot();
      return {
        expedienteId: snapshot.id.toString(),
        expedienteNumero: snapshot.expedienteNumero.toDisplay(),
        paciente: {
          idInstitucional: snapshot.pacienteReferencia.idInstitucional,
          curp: snapshot.pacienteReferencia.curp,
          nombreOperativo: snapshot.pacienteReferencia.nombreOperativo,
          numeroIssste: snapshot.pacienteReferencia.numeroIssste,
        },
        estadoOperativo: snapshot.estadoOperativo,
        ubicacion: snapshot.ubicacionActual,
      };
    });

    await this.dependencies.auditWriter.append(
      {
        action: 'EXPEDIENTE_SEARCH',
        resourceType: 'EXPEDIENTE',
        resourceId: numero.toNormalized(),
        result: 'success',
      },
      context,
    );

    return items;
  }
}
