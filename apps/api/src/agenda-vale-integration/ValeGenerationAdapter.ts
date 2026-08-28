import type {
  ValeGenerationBatchCommand,
  ValeGenerationBatchResult,
  ValeGenerationPort,
} from '@sigac/agenda-vale-integration';
import type { GenerateValeBatch } from '@sigac/vale-archivo';
import type { RequestContext } from '@sigac/tenant';

type GenerateValeBatchUseCase = Pick<GenerateValeBatch, 'execute'>;

/** ACL target: traduce el batch neutral al command propietario de Vale Archivo. */
export class ValeGenerationAdapter implements ValeGenerationPort {
  constructor(private readonly useCase: GenerateValeBatchUseCase) {}

  generateBatch(
    batch: ValeGenerationBatchCommand,
    context: RequestContext,
  ): Promise<ValeGenerationBatchResult> {
    return this.useCase.execute({
      source: {
        kind: 'AGENDA_PREPARATION',
        agendaDate: batch.agendaDate,
        sourceImportacionId: batch.sourceImportacionId,
        sourceVersion: batch.sourceVersion,
        generationSnapshotHash: batch.generationSnapshotHash,
      },
      header: {
        fechaSolicitud: batch.header.fechaSolicitud,
        fechaRecepcion: batch.header.fechaRecepcion,
        unidadSolicitante: batch.header.unidadSolicitante,
        solicitanteNombre: batch.header.solicitante.nombre,
        solicitanteCargo: batch.header.solicitante.cargo,
        autorizadorNombre: batch.header.autorizador.nombre,
        autorizadorCargo: batch.header.autorizador.cargo,
      },
      groups: batch.groups.map((group) => ({
        agendaDate: group.key.agendaDate,
        servicioCodigo: group.key.servicioCodigo,
        servicioNombre: group.servicioNombre,
        medicoNumeroEmpleado: group.key.medicoNumeroEmpleado,
        medicoNombre: group.medicoNombre,
        items: group.items.map((item) => ({
          expedienteNumero: item.expedienteReference,
          pacienteNombre: item.pacienteNombre,
          appointmentReferences: item.references.map((reference) => ({ ...reference })),
        })),
      })),
      resolvedConflicts: batch.resolvedConflicts.map((conflict) => ({
        expedienteNumero: conflict.expedienteReference,
        ownerGroup: { ...conflict.ownerGroup },
        alternatives: conflict.alternatives.map((alternative) => ({
          group: { ...alternative.group },
          appointmentReferences: alternative.references.map((reference) => ({ ...reference })),
        })),
      })),
      context,
    }).then((result) => ({
      generatedVales: result.generatedVales.map((vale) => ({
        valeId: vale.valeId,
        numeroVale: vale.numeroVale,
        group: {
          agendaDate: vale.agendaDate,
          servicioCodigo: vale.servicioCodigo,
          medicoNumeroEmpleado: vale.medicoNumeroEmpleado,
        },
        outcome: vale.outcome,
      })),
    }));
  }
}
