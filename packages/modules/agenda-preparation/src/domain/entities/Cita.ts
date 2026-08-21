import { DomainError } from '@sigac/domain-kernel';
import type { AppointmentKind } from './RegistroImportadoAgenda.js';
import {
  AgendaFecha,
  ExpedienteReferencia,
  FolioCita,
  HoraCita,
  MedicoReferencia,
  ServicioEspecialidad,
} from '../value-objects/index.js';

export const CITA_LIFECYCLES = ['ACTIVA', 'RETIRADA_DE_AGENDA'] as const;
export type CitaLifecycle = (typeof CITA_LIFECYCLES)[number];
export const TIPOS_CONSULTA = ['FIRST_TIME', 'SUBSEQUENT'] as const satisfies readonly AppointmentKind[];
export type TipoConsulta = AppointmentKind;

export interface CitaSnapshot {
  readonly folio: FolioCita;
  readonly agendaFecha: AgendaFecha;
  readonly hora: HoraCita;
  readonly expedienteReference: ExpedienteReferencia | null;
  readonly nombrePaciente: string;
  readonly tipoDerechohabiente: string;
  readonly tipoConsulta: TipoConsulta;
  readonly medico: MedicoReferencia;
  readonly servicioEspecialidad: ServicioEspecialidad;
}

interface CitaMutableState {
  hora: HoraCita;
  expedienteReference: ExpedienteReferencia | null;
  nombrePaciente: string;
  tipoDerechohabiente: string;
  tipoConsulta: TipoConsulta;
  medico: MedicoReferencia;
  servicioEspecialidad: ServicioEspecialidad;
  lifecycle: CitaLifecycle;
}

const states = new WeakMap<Cita, CitaMutableState>();

export class Cita {
  readonly folio: FolioCita;
  readonly agendaFecha: AgendaFecha;

  private constructor(snapshot: CitaSnapshot) {
    this.folio = snapshot.folio;
    this.agendaFecha = snapshot.agendaFecha;
    states.set(this, {
      hora: snapshot.hora,
      expedienteReference: snapshot.expedienteReference,
      nombrePaciente: snapshot.nombrePaciente.trim(),
      tipoDerechohabiente: snapshot.tipoDerechohabiente.trim(),
      tipoConsulta: snapshot.tipoConsulta,
      medico: snapshot.medico,
      servicioEspecialidad: snapshot.servicioEspecialidad,
      lifecycle: 'ACTIVA',
    });
  }

  static create(snapshot: CitaSnapshot): Cita {
    validateSnapshot(snapshot);
    return new Cita(snapshot);
  }

  get hora(): HoraCita { return stateOf(this).hora; }
  get expedienteReference(): ExpedienteReferencia | null { return stateOf(this).expedienteReference; }
  get nombrePaciente(): string { return stateOf(this).nombrePaciente; }
  get tipoDerechohabiente(): string { return stateOf(this).tipoDerechohabiente; }
  get tipoConsulta(): TipoConsulta { return stateOf(this).tipoConsulta; }
  get medico(): MedicoReferencia { return stateOf(this).medico; }
  get servicioEspecialidad(): ServicioEspecialidad { return stateOf(this).servicioEspecialidad; }
  get lifecycle(): CitaLifecycle { return stateOf(this).lifecycle; }
}

/** @internal API del límite Aggregate; no se reexporta desde el módulo. */
export function updateCitaFrom(cita: Cita, incoming: Cita): void {
  copyFunctionalData(stateOf(cita), stateOf(incoming));
}

/** @internal API del límite Aggregate; no se reexporta desde el módulo. */
export function withdrawCita(cita: Cita): void {
  stateOf(cita).lifecycle = 'RETIRADA_DE_AGENDA';
}

/** @internal API del límite Aggregate; no se reexporta desde el módulo. */
export function restoreCitaFrom(cita: Cita, incoming: Cita): void {
  const state = stateOf(cita);
  copyFunctionalData(state, stateOf(incoming));
  state.lifecycle = 'ACTIVA';
}

/** @internal Comparación funcional definida por AGD-AP-004. */
export function citaHasSameFunctionalData(cita: Cita, incoming: Cita): boolean {
  const current = stateOf(cita);
  const candidate = stateOf(incoming);
  return current.hora.equals(candidate.hora) &&
    nullableReferenceEquals(current.expedienteReference, candidate.expedienteReference) &&
    current.nombrePaciente === candidate.nombrePaciente &&
    current.tipoDerechohabiente === candidate.tipoDerechohabiente &&
    current.tipoConsulta === candidate.tipoConsulta &&
    current.medico.numeroEmpleado.equals(candidate.medico.numeroEmpleado) &&
    current.medico.nombre === candidate.medico.nombre &&
    current.servicioEspecialidad.codigo === candidate.servicioEspecialidad.codigo &&
    current.servicioEspecialidad.nombre === candidate.servicioEspecialidad.nombre;
}

function validateSnapshot(snapshot: CitaSnapshot): void {
  if (
    !(snapshot?.folio instanceof FolioCita) ||
    !(snapshot.agendaFecha instanceof AgendaFecha) ||
    !(snapshot.hora instanceof HoraCita) ||
    (snapshot.expedienteReference !== null && !(snapshot.expedienteReference instanceof ExpedienteReferencia)) ||
    typeof snapshot.nombrePaciente !== 'string' ||
    snapshot.nombrePaciente.trim() === '' ||
    typeof snapshot.tipoDerechohabiente !== 'string' ||
    snapshot.tipoDerechohabiente.trim() === '' ||
    !TIPOS_CONSULTA.includes(snapshot.tipoConsulta) ||
    !(snapshot.medico instanceof MedicoReferencia) ||
    !(snapshot.servicioEspecialidad instanceof ServicioEspecialidad)
  ) {
    throw new DomainError('CITA_INVALID', 'La Cita no cumple el contrato Domain aprobado.');
  }
}

function nullableReferenceEquals(
  left: ExpedienteReferencia | null,
  right: ExpedienteReferencia | null,
): boolean {
  return left === null ? right === null : right !== null && left.equals(right);
}

function stateOf(cita: Cita): CitaMutableState {
  const state = states.get(cita);
  if (!state) {
    throw new DomainError('CITA_INVALID', 'La Cita no contiene estado Domain válido.');
  }
  return state;
}

function copyFunctionalData(target: CitaMutableState, source: CitaMutableState): void {
  target.hora = source.hora;
  target.expedienteReference = source.expedienteReference;
  target.nombrePaciente = source.nombrePaciente;
  target.tipoDerechohabiente = source.tipoDerechohabiente;
  target.tipoConsulta = source.tipoConsulta;
  target.medico = source.medico;
  target.servicioEspecialidad = source.servicioEspecialidad;
}
