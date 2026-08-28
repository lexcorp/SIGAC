import { AgendaFecha, type GetPreparedAgendaGenerationSource } from '@sigac/agenda-preparation';
import type {
  AgendaPreparationProjection,
  AgendaPreparationReadPort,
} from '@sigac/agenda-vale-integration';
import type { TenantContext } from '@sigac/tenant';

type AgendaGenerationSourceUseCase = Pick<
  GetPreparedAgendaGenerationSource,
  'execute' | 'isCurrentVersion'
>;

/** ACL de lectura: traduce Application de Agenda a la proyección neutral. */
export class AgendaPreparationReadAdapter implements AgendaPreparationReadPort {
  constructor(private readonly useCase: AgendaGenerationSourceUseCase) {}

  async findPreparedAgenda(
    agendaDate: string,
    tenant: TenantContext,
  ): Promise<AgendaPreparationProjection | null> {
    const source = await this.useCase.execute({
      agendaDate: AgendaFecha.parse(agendaDate),
      tenant,
    });
    if (source === null) return null;

    return Object.freeze({
      agendaDate: source.agendaDate,
      sourceImportacionId: source.sourceImportacionId,
      sourceVersion: source.sourceVersion,
      items: Object.freeze(source.items.map((item) => Object.freeze({
        folio: item.folio,
        agendaDate: item.agendaDate,
        appointmentTime: item.appointmentTime,
        tipoConsulta: item.tipoConsulta,
        tipoDerechohabiente: item.tipoDerechohabiente,
        pacienteNombre: item.pacienteNombre,
        expedienteReference: item.expedienteReference,
        medico: Object.freeze({ ...item.medico }),
        servicio: Object.freeze({ ...item.servicio }),
      }))),
    });
  }

  isCurrentVersion(
    agendaDate: string,
    sourceImportacionId: string,
    sourceVersion: string,
    tenant: TenantContext,
  ): Promise<boolean> {
    return this.useCase.isCurrentVersion({
      agendaDate: AgendaFecha.parse(agendaDate),
      sourceImportacionId,
      sourceVersion,
      tenant,
    });
  }
}
