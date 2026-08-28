import { DomainError } from '@sigac/domain-kernel';
import type { EstadoBusqueda } from '../value-objects/EstadoBusqueda.js';

/**
 * ValeArchivoItem — Entity
 *
 * Línea individual del vale; representa un expediente solicitado.
 * Vive dentro del Aggregate ValeArchivo; no tiene identidad independiente.
 *
 * Fuente: design.md §10.2, REQ-VA-005, INV-VA-003, INV-VA-007
 *
 * Nota: expedienteNumero es un string operativo que NO referencia el Aggregate
 * Expediente de archive-operations (bounded contexts separados, ADR-0032).
 */

/** Observaciones máximo 500 caracteres (INV-VA-007 no permite datos clínicos). */
const MAX_OBSERVACIONES_LENGTH = 500;

export interface ValeArchivoItemProps {
  readonly id: string;
  readonly valeId: string;
  readonly expedienteNumero: string;
  readonly pacienteNombre: string;
  readonly especialidad: string;
  estadoBusqueda: EstadoBusqueda;
  ubicacionEncontrada: string | null;
  observaciones: string | null;
}

export class ValeArchivoItem {
  readonly id: string;
  readonly valeId: string;
  readonly expedienteNumero: string;
  readonly pacienteNombre: string;
  readonly especialidad: string;

  private _estadoBusqueda: EstadoBusqueda;
  private _ubicacionEncontrada: string | null;
  private _observaciones: string | null;

  private constructor(props: ValeArchivoItemProps) {
    this.id = props.id;
    this.valeId = props.valeId;
    this.expedienteNumero = props.expedienteNumero;
    this.pacienteNombre = props.pacienteNombre;
    this.especialidad = props.especialidad;
    this._estadoBusqueda = props.estadoBusqueda;
    this._ubicacionEncontrada = props.ubicacionEncontrada;
    this._observaciones = props.observaciones;
  }

  get estadoBusqueda(): EstadoBusqueda {
    return this._estadoBusqueda;
  }

  get ubicacionEncontrada(): string | null {
    return this._ubicacionEncontrada;
  }

  get observaciones(): string | null {
    return this._observaciones;
  }

  /** Indica si el ítem ya tiene una resolución (no está en PENDIENTE). */
  get estaResuelto(): boolean {
    return this._estadoBusqueda !== 'PENDIENTE';
  }

  /**
   * Factory para nuevos ítems al crear un vale.
   * El estado inicial de búsqueda siempre es PENDIENTE.
   */
  static create(
    props: Omit<ValeArchivoItemProps, 'estadoBusqueda' | 'ubicacionEncontrada' | 'observaciones'>,
  ): ValeArchivoItem {
    if (!props.expedienteNumero.trim()) {
      throw new DomainError(
        'VALE_ARCHIVO_ITEM_INVALIDO',
        'El número de expediente no puede estar vacío.',
      );
    }
    if (!props.pacienteNombre.trim()) {
      throw new DomainError(
        'VALE_ARCHIVO_ITEM_INVALIDO',
        'El nombre del paciente no puede estar vacío.',
      );
    }
    if (!props.especialidad.trim()) {
      throw new DomainError(
        'VALE_ARCHIVO_ITEM_INVALIDO',
        'La especialidad no puede estar vacía.',
      );
    }

    return new ValeArchivoItem({
      ...props,
      estadoBusqueda: 'PENDIENTE',
      ubicacionEncontrada: null,
      observaciones: null,
    });
  }

  /** Factory de reconstitución desde persistencia (no valida invariantes de creación). */
  static reconstitute(props: ValeArchivoItemProps): ValeArchivoItem {
    return new ValeArchivoItem(props);
  }

  /**
   * Registra el resultado de la búsqueda para este ítem.
   * Lanza DomainError si observaciones excede 500 caracteres.
   */
  registrarLocalizacion(
    estadoBusqueda: 'LOCALIZADO' | 'NO_LOCALIZADO',
    ubicacionEncontrada: string | null,
    observaciones: string | null,
  ): void {
    if (observaciones !== null && observaciones.length > MAX_OBSERVACIONES_LENGTH) {
      throw new DomainError(
        'OBSERVACIONES_DEMASIADO_LARGAS',
        `Las observaciones no pueden superar ${MAX_OBSERVACIONES_LENGTH} caracteres.`,
      );
    }

    this._estadoBusqueda = estadoBusqueda;
    this._ubicacionEncontrada = ubicacionEncontrada;
    this._observaciones = observaciones;
  }

  /** Snapshot del ítem para persistencia y serialización. */
  toProps(): ValeArchivoItemProps {
    return {
      id: this.id,
      valeId: this.valeId,
      expedienteNumero: this.expedienteNumero,
      pacienteNombre: this.pacienteNombre,
      especialidad: this.especialidad,
      estadoBusqueda: this._estadoBusqueda,
      ubicacionEncontrada: this._ubicacionEncontrada,
      observaciones: this._observaciones,
    };
  }
}
