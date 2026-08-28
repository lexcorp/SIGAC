import type { AuditWriter } from '@sigac/audit';
import type { RequestContext } from '@sigac/tenant';
import { ValeArchivo } from '../../domain/aggregates/ValeArchivo.js';
import { NumeroVale } from '../../domain/value-objects/NumeroVale.js';
import { parseSolicitanteReferencia } from '../../domain/value-objects/SolicitanteReferencia.js';
import { ApplicationError } from '../ApplicationError.js';
import type {
  ValeBatchSourceIdentity,
  ValeBatchTraceSnapshot,
  ValeBatchUnitOfWork,
} from '../ports/ValeBatchUnitOfWork.js';

export interface GenerateValeBatchCommand {
  readonly source: ValeBatchSourceIdentity;
  readonly header: {
    readonly fechaSolicitud: string;
    readonly fechaRecepcion: string;
    readonly unidadSolicitante: string;
    readonly solicitanteNombre: string;
    readonly solicitanteCargo: string;
    readonly autorizadorNombre: string;
    readonly autorizadorCargo: string;
  };
  readonly groups: readonly GenerateValeBatchGroup[];
  readonly context: RequestContext;
}

export interface GenerateValeBatchGroup {
  readonly agendaDate: string;
  readonly servicioCodigo: string;
  readonly servicioNombre: string;
  readonly medicoNumeroEmpleado: string;
  readonly medicoNombre: string;
  readonly items: readonly {
    readonly expedienteNumero: string;
    readonly pacienteNombre: string;
    readonly appointmentReferences: readonly {
      readonly folio: string;
      readonly servicioCodigo: string;
      readonly medicoNumeroEmpleado: string;
    }[];
  }[];
}

export interface GenerateValeBatchResult {
  readonly generatedVales: readonly {
    readonly valeId: string;
    readonly numeroVale: string;
    readonly agendaDate: string;
    readonly servicioCodigo: string;
    readonly medicoNumeroEmpleado: string;
    readonly outcome: 'GENERATED' | 'ALREADY_GENERATED';
  }[];
}

export interface GenerateValeBatchDependencies {
  readonly unitOfWork: ValeBatchUnitOfWork;
  /** Writer tenant-local independiente, usado sólo para authorization denied. */
  readonly auditWriter: AuditWriter;
}

export class GenerateValeBatch {
  constructor(private readonly deps: GenerateValeBatchDependencies) {}

  async execute(command: GenerateValeBatchCommand): Promise<GenerateValeBatchResult> {
    if (!command.context.actor.permissions.has('REQUEST_CREATE')) {
      await this.auditDenied(command);
      throw new ApplicationError(
        'PERMISSION_DENIED',
        'El actor no tiene el permiso REQUEST_CREATE.',
      );
    }

    if (command.groups.length === 0) return { generatedVales: [] };

    return this.deps.unitOfWork.execute(command.context, async (transaction) => {
      const replay = await transaction.findBySource({
        agendaDate: command.source.agendaDate,
        sourceImportacionId: command.source.sourceImportacionId,
        generationSnapshotHash: command.source.generationSnapshotHash,
      });
      if (replay.length > 0) {
        return {
          generatedVales: replay.map((vale) => ({
            ...vale,
            outcome: 'ALREADY_GENERATED' as const,
          })),
        };
      }

      const solicitante = parseSolicitanteReferencia(
        command.header.solicitanteNombre,
        command.header.solicitanteCargo,
      );
      const autorizador = parseSolicitanteReferencia(
        command.header.autorizadorNombre,
        command.header.autorizadorCargo,
      );
      const generatedVales: GenerateValeBatchResult['generatedVales'][number][] = [];

      for (const group of command.groups) {
        const sequence = await transaction.reserveDailySequence(command.header.fechaSolicitud);
        const numeroVale = NumeroVale.parse(formatNumeroVale(command.header.fechaSolicitud, sequence));
        const vale = ValeArchivo.create(
          {
            numeroVale,
            fechaSolicitud: parseCivilDate(command.header.fechaSolicitud),
            fechaRecepcion: parseCivilDate(command.header.fechaRecepcion),
            unidadSolicitante: command.header.unidadSolicitante,
            solicitante,
            autorizador,
            items: group.items.map((item) => ({
              expedienteNumero: item.expedienteNumero,
              pacienteNombre: item.pacienteNombre,
              especialidad: group.servicioNombre,
            })),
            creadoPor: command.context.actor.actorId,
          },
          transaction.operationOccurredAt,
        );

        await transaction.saveVale(vale);
        await transaction.appendTraceSnapshot(toTraceSnapshot(
          command.source,
          group,
          vale,
          transaction.operationOccurredAt,
        ));
        generatedVales.push({
          valeId: vale.id.toString(),
          numeroVale: vale.numeroVale.toString(),
          agendaDate: group.agendaDate,
          servicioCodigo: group.servicioCodigo,
          medicoNumeroEmpleado: group.medicoNumeroEmpleado,
          outcome: 'GENERATED',
        });
      }

      await transaction.auditWriter.append(
        {
          action: 'VALES_DESDE_AGENDA_GENERADOS',
          resourceType: 'AGENDA',
          resourceId: command.source.agendaDate,
          result: 'success',
          changeSummary: { generatedValeCount: String(generatedVales.length) },
        },
        command.context,
      );

      return { generatedVales };
    });
  }

  private auditDenied(command: GenerateValeBatchCommand): Promise<void> {
    return this.deps.auditWriter.append(
      {
        action: 'VALES_DESDE_AGENDA_GENERADOS',
        resourceType: 'AGENDA',
        resourceId: command.source.agendaDate,
        result: 'denied',
      },
      command.context,
    );
  }
}

function formatNumeroVale(fechaSolicitud: string, sequence: number): string {
  const compactDate = fechaSolicitud.replaceAll('-', '');
  return `VA-${compactDate}-${String(sequence).padStart(3, '0')}`;
}

function parseCivilDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function toTraceSnapshot(
  source: ValeBatchSourceIdentity,
  group: GenerateValeBatchGroup,
  vale: ValeArchivo,
  generatedAt: Date,
): ValeBatchTraceSnapshot {
  const snapshot = vale.snapshot();
  return {
    source,
    generatedAt,
    valeId: snapshot.id,
    numeroVale: snapshot.numeroVale,
    agendaDate: group.agendaDate,
    servicioCodigo: group.servicioCodigo,
    servicioNombre: group.servicioNombre,
    medicoNumeroEmpleado: group.medicoNumeroEmpleado,
    medicoNombre: group.medicoNombre,
    items: snapshot.items.map((item, index) => ({
      valeItemId: item.id,
      expedienteNumero: item.expedienteNumero,
      appointmentReferences: group.items[index]!.appointmentReferences,
    })),
  };
}
