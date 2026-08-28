/**
 * Proyección neutral de una Cita preparada.
 *
 * No es una Entity de Agenda Preparation ni un item de Vale Archivo.
 * Los campos nullable permiten reportar evidencia no resoluble sin inventar valores.
 */
export interface AgendaAgendaItem {
  readonly folio: string;
  readonly agendaDate: string;
  readonly appointmentTime: string;
  readonly tipoConsulta: 'FIRST_TIME' | 'SUBSEQUENT';
  readonly tipoDerechohabiente: string;
  readonly pacienteNombre: string;
  readonly expedienteReference: string | null;
  readonly medico: {
    readonly numeroEmpleado: string;
    readonly nombre: string;
  };
  readonly servicio: {
    readonly codigo: string | null;
    readonly nombre: string | null;
  };
}
