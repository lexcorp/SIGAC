import { DomainError } from '@sigac/domain-kernel';
import {
  Cita,
  citaHasSameFunctionalData,
  restoreCitaFrom,
  updateCitaFrom,
  withdrawCita,
  type CitaSnapshot,
} from '../entities/Cita.js';
import { AgendaFecha, FolioCita } from '../value-objects/index.js';

export interface CreateAgendaInput {
  readonly fecha: AgendaFecha;
  readonly citasIniciales?: readonly Cita[];
}

export interface ReconcileAgendaInput {
  readonly incoming: readonly CitaSnapshot[];
}

export interface AgendaReconciliationResult {
  readonly added: readonly FolioCita[];
  readonly updated: readonly FolioCita[];
  readonly unchanged: readonly FolioCita[];
  readonly restored: readonly FolioCita[];
  readonly withdrawn: readonly FolioCita[];
}

export class Agenda {
  readonly fecha: AgendaFecha;
  private readonly appointments: Cita[];

  private constructor(fecha: AgendaFecha, citasIniciales: readonly Cita[]) {
    this.fecha = fecha;
    this.appointments = [...citasIniciales];
  }

  static create(input: CreateAgendaInput): Agenda {
    if (!(input?.fecha instanceof AgendaFecha)) {
      throw new DomainError('AGENDA_INVALID', 'La Agenda requiere una fecha válida.');
    }
    const citas = input.citasIniciales ?? [];
    if (!Array.isArray(citas) || citas.some(cita => !(cita instanceof Cita))) {
      throw new DomainError('AGENDA_INVALID', 'Las Citas iniciales de la Agenda son inválidas.');
    }
    validateDates(input.fecha, citas);
    validateUniqueFolios(citas);
    return new Agenda(input.fecha, citas);
  }

  get citas(): readonly Cita[] { return [...this.appointments]; }

  reconcile(input: ReconcileAgendaInput): AgendaReconciliationResult {
    if (!input || !Array.isArray(input.incoming)) {
      throw new DomainError(
        'AGENDA_RECONCILIACION_INVALIDA',
        'La reconciliación requiere un snapshot de Citas.',
      );
    }

    // Construir y validar el snapshot completo antes de tocar el estado del Aggregate.
    const incoming = input.incoming.map(snapshot => Cita.create(snapshot));
    validateDates(this.fecha, incoming);
    validateUniqueFolios(incoming);

    const result = {
      added: [] as FolioCita[],
      updated: [] as FolioCita[],
      unchanged: [] as FolioCita[],
      restored: [] as FolioCita[],
      withdrawn: [] as FolioCita[],
    };
    const incomingFolios = new Set(incoming.map(cita => cita.folio.value));

    for (const candidate of incoming) {
      const existing = this.appointments.find(cita => cita.folio.equals(candidate.folio));
      if (!existing) {
        this.appointments.push(candidate);
        result.added.push(candidate.folio);
      } else if (existing.lifecycle === 'RETIRADA_DE_AGENDA') {
        restoreCitaFrom(existing, candidate);
        result.restored.push(existing.folio);
      } else if (citaHasSameFunctionalData(existing, candidate)) {
        result.unchanged.push(existing.folio);
      } else {
        updateCitaFrom(existing, candidate);
        result.updated.push(existing.folio);
      }
    }

    for (const existing of this.appointments) {
      if (existing.lifecycle === 'ACTIVA' && !incomingFolios.has(existing.folio.value)) {
        withdrawCita(existing);
        result.withdrawn.push(existing.folio);
      }
    }

    return Object.freeze({
      added: Object.freeze(result.added),
      updated: Object.freeze(result.updated),
      unchanged: Object.freeze(result.unchanged),
      restored: Object.freeze(result.restored),
      withdrawn: Object.freeze(result.withdrawn),
    });
  }
}

function validateDates(fecha: AgendaFecha, citas: readonly Cita[]): void {
  if (citas.some(cita => !cita.agendaFecha.equals(fecha))) {
    throw new DomainError(
      'AGENDA_FECHA_INCOMPATIBLE',
      'Todas las Citas deben corresponder a la fecha de la Agenda.',
    );
  }
}

function validateUniqueFolios(citas: readonly Cita[]): void {
  const folios = new Set<string>();
  for (const cita of citas) {
    if (folios.has(cita.folio.value)) {
      throw new DomainError(
        'AGENDA_FOLIO_DUPLICADO',
        'El snapshot contiene más de una Cita con el mismo FOLIO.',
      );
    }
    folios.add(cita.folio.value);
  }
}
