import { DomainError } from '@sigac/domain-kernel';
import {
  InvalidStateTransitionError,
  ValeArchivoItemNotFoundError,
  ValeRequiereItemsError,
} from '../errors/ValeArchivoErrors.js';
import type { ValeArchivoItemProps } from '../entities/ValeArchivoItem.js';
import { ValeArchivoItem } from '../entities/ValeArchivoItem.js';
import type { EstadoVale } from '../value-objects/EstadoVale.js';
import { NumeroVale } from '../value-objects/NumeroVale.js';
import type { SolicitanteReferencia } from '../value-objects/SolicitanteReferencia.js';
import { ValeArchivoId } from '../value-objects/ValeArchivoId.js';

/**
 * ValeArchivo — Aggregate Root
 *
 * Gestiona el ciclo de vida completo de una solicitud extraordinaria SM 1-14.
 * Es la única autoridad sobre los estados, transiciones y reglas de negocio.
 *
 * Fuente: design.md §5, REQ-VA-001..REQ-VA-007, INV-VA-001..INV-VA-012
 *
 * Restricciones:
 * - No importa NestJS, Drizzle, PDFKit ni HTTP.
 * - No referencia el Aggregate Expediente ni Ubicacion de archive-operations (ADR-0032).
 * - No contiene el campo turno/shift (INV-VA-011).
 * - Las transiciones de estado son unidireccionales (INV-VA-010).
 */

export interface ValeArchivoCreateProps {
  readonly numeroVale: NumeroVale;
  readonly fechaSolicitud: Date;
  readonly fechaRecepcion: Date;
  readonly unidadSolicitante: string;
  readonly solicitante: SolicitanteReferencia;
  readonly autorizador: SolicitanteReferencia;
  readonly items: readonly Omit<
    ValeArchivoItemProps,
    'id' | 'valeId' | 'estadoBusqueda' | 'ubicacionEncontrada' | 'observaciones'
  >[];
  readonly creadoPor: string;
}

export interface ValeArchivoSnapshot {
  readonly id: string;
  readonly numeroVale: string;
  readonly fechaSolicitud: Date;
  readonly fechaRecepcion: Date;
  readonly unidadSolicitante: string;
  readonly solicitante: SolicitanteReferencia;
  readonly autorizador: SolicitanteReferencia;
  readonly estado: EstadoVale;
  readonly items: readonly ValeArchivoItemProps[];
  readonly creadoPor: string;
  readonly busquedaIniciadaPor: string | null;
  readonly busquedaIniciadaAt: Date | null;
  readonly entregadoPor: string | null;
  readonly entregadoAt: Date | null;
  readonly receptorEntrega: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

interface ValeArchivoState {
  id: ValeArchivoId;
  numeroVale: NumeroVale;
  fechaSolicitud: Date;
  fechaRecepcion: Date;
  unidadSolicitante: string;
  solicitante: SolicitanteReferencia;
  autorizador: SolicitanteReferencia;
  estado: EstadoVale;
  items: ValeArchivoItem[];
  creadoPor: string;
  busquedaIniciadaPor: string | null;
  busquedaIniciadaAt: Date | null;
  entregadoPor: string | null;
  entregadoAt: Date | null;
  receptorEntrega: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class ValeArchivo {
  private state: ValeArchivoState;

  private constructor(state: ValeArchivoState) {
    this.state = state;
  }

  // ── Queries ─────────────────────────────────────────────────────────────────

  get id(): ValeArchivoId {
    return this.state.id;
  }

  get estado(): EstadoVale {
    return this.state.estado;
  }

  get items(): readonly ValeArchivoItem[] {
    return this.state.items;
  }

  get numeroVale(): NumeroVale {
    return this.state.numeroVale;
  }

  /** Devuelve un snapshot inmutable para persistencia y serialización. */
  snapshot(): ValeArchivoSnapshot {
    return Object.freeze({
      id: this.state.id.toString(),
      numeroVale: this.state.numeroVale.toString(),
      fechaSolicitud: this.state.fechaSolicitud,
      fechaRecepcion: this.state.fechaRecepcion,
      unidadSolicitante: this.state.unidadSolicitante,
      solicitante: Object.freeze({ ...this.state.solicitante }),
      autorizador: Object.freeze({ ...this.state.autorizador }),
      estado: this.state.estado,
      items: Object.freeze(this.state.items.map((i) => ({ ...i.toProps() }))),
      creadoPor: this.state.creadoPor,
      busquedaIniciadaPor: this.state.busquedaIniciadaPor,
      busquedaIniciadaAt: this.state.busquedaIniciadaAt,
      entregadoPor: this.state.entregadoPor,
      entregadoAt: this.state.entregadoAt,
      receptorEntrega: this.state.receptorEntrega,
      createdAt: this.state.createdAt,
      updatedAt: this.state.updatedAt,
    });
  }

  // ── Factories ────────────────────────────────────────────────────────────────

  /**
   * Crea un nuevo ValeArchivo en estado RECIBIDA.
   * INV-VA-001: lanza ValeRequiereItemsError si no hay ítems.
   */
  static create(props: ValeArchivoCreateProps, occurredAt: Date): ValeArchivo {
    if (props.items.length === 0) {
      throw new ValeRequiereItemsError();
    }

    if (!props.unidadSolicitante.trim()) {
      throw new DomainError(
        'UNIDAD_SOLICITANTE_INVALIDA',
        'La unidad solicitante no puede estar vacía.',
      );
    }

    if (!props.creadoPor.trim()) {
      throw new DomainError(
        'CREADO_POR_INVALIDO',
        'El actorId del capturista no puede estar vacío.',
      );
    }

    const valeId = ValeArchivoId.generate();

    const items = props.items.map((itemProps) =>
      ValeArchivoItem.create({
        id: ValeArchivoId.generate().toString(),
        valeId: valeId.toString(),
        expedienteNumero: itemProps.expedienteNumero,
        pacienteNombre: itemProps.pacienteNombre,
        especialidad: itemProps.especialidad,
      }),
    );

    return new ValeArchivo({
      id: valeId,
      numeroVale: props.numeroVale,
      fechaSolicitud: props.fechaSolicitud,
      fechaRecepcion: props.fechaRecepcion,
      unidadSolicitante: props.unidadSolicitante.trim(),
      solicitante: Object.freeze({ ...props.solicitante }),
      autorizador: Object.freeze({ ...props.autorizador }),
      estado: 'RECIBIDA',
      items,
      creadoPor: props.creadoPor,
      busquedaIniciadaPor: null,
      busquedaIniciadaAt: null,
      entregadoPor: null,
      entregadoAt: null,
      receptorEntrega: null,
      createdAt: occurredAt,
      updatedAt: occurredAt,
    });
  }

  /**
   * Reconstituye el Aggregate desde un snapshot de persistencia.
   * No aplica invariantes de creación (confía en los datos almacenados).
   */
  static reconstitute(snapshot: ValeArchivoSnapshot): ValeArchivo {
    const items = snapshot.items.map((itemProps) =>
      ValeArchivoItem.reconstitute({
        ...itemProps,
        estadoBusqueda: itemProps.estadoBusqueda,
        ubicacionEncontrada: itemProps.ubicacionEncontrada,
        observaciones: itemProps.observaciones,
      }),
    );

    return new ValeArchivo({
      id: ValeArchivoId.parse(snapshot.id),
      numeroVale: NumeroVale.parse(snapshot.numeroVale),
      fechaSolicitud: snapshot.fechaSolicitud,
      fechaRecepcion: snapshot.fechaRecepcion,
      unidadSolicitante: snapshot.unidadSolicitante,
      solicitante: snapshot.solicitante,
      autorizador: snapshot.autorizador,
      estado: snapshot.estado,
      items,
      creadoPor: snapshot.creadoPor,
      busquedaIniciadaPor: snapshot.busquedaIniciadaPor,
      busquedaIniciadaAt: snapshot.busquedaIniciadaAt,
      entregadoPor: snapshot.entregadoPor,
      entregadoAt: snapshot.entregadoAt,
      receptorEntrega: snapshot.receptorEntrega,
      createdAt: snapshot.createdAt,
      updatedAt: snapshot.updatedAt,
    });
  }

  // ── Commands ─────────────────────────────────────────────────────────────────

  /**
   * REQ-VA-004: RECIBIDA → EN_BUSQUEDA
   * Registra el inicio de la búsqueda de los expedientes.
   */
  iniciarBusqueda(actorId: string, occurredAt: Date): void {
    if (this.state.estado !== 'RECIBIDA') {
      throw new InvalidStateTransitionError(this.state.estado, 'EN_BUSQUEDA');
    }

    this.state.estado = 'EN_BUSQUEDA';
    this.state.busquedaIniciadaPor = actorId;
    this.state.busquedaIniciadaAt = occurredAt;
    this.state.updatedAt = occurredAt;
  }

  /**
   * REQ-VA-005: Actualiza el resultado de búsqueda de un ítem.
   * Si todos los ítems quedan resueltos, transiciona el vale automáticamente:
   *   todos LOCALIZADO   → COMPLETA
   *   todos NO_LOCALIZADO → NO_LOCALIZADA
   *   mezcla             → PARCIAL
   *
   * PRECONDICIÓN: estado === EN_BUSQUEDA
   */
  registrarLocalizacion(
    itemId: string,
    estadoBusqueda: 'LOCALIZADO' | 'NO_LOCALIZADO',
    ubicacionEncontrada: string | null,
    observaciones: string | null,
    occurredAt: Date,
  ): void {
    if (this.state.estado !== 'EN_BUSQUEDA') {
      throw new InvalidStateTransitionError(this.state.estado, estadoBusqueda);
    }

    const item = this.state.items.find((i) => i.id === itemId);
    if (!item) {
      throw new ValeArchivoItemNotFoundError(itemId);
    }

    item.registrarLocalizacion(estadoBusqueda, ubicacionEncontrada, observaciones);
    this.state.updatedAt = occurredAt;

    this.evaluarTransicionAutomatica(occurredAt);
  }

  /**
   * REQ-VA-006: COMPLETA|PARCIAL → ENTREGADA
   * Registra la entrega de los expedientes al receptor final.
   */
  registrarEntrega(
    actorId: string,
    receptorEntrega: string,
    itemsEntregados: readonly string[],
    entregadoAt: Date,
  ): void {
    if (this.state.estado !== 'COMPLETA' && this.state.estado !== 'PARCIAL') {
      throw new InvalidStateTransitionError(this.state.estado, 'ENTREGADA');
    }

    if (!receptorEntrega.trim()) {
      throw new DomainError(
        'RECEPTOR_ENTREGA_INVALIDO',
        'El nombre del receptor de entrega no puede estar vacío.',
      );
    }

    this.state.estado = 'ENTREGADA';
    this.state.entregadoPor = actorId;
    this.state.receptorEntrega = receptorEntrega.trim();
    this.state.entregadoAt = entregadoAt;
    this.state.updatedAt = entregadoAt;

    // itemsEntregados se registra en snapshot; la entidad no tiene un flag "entregado"
    // ya que la entrega se gestiona a nivel del vale completo en v0.1.
    void itemsEntregados;
  }

  /**
   * REQ-VA-007: NO_LOCALIZADA → CERRADA
   * Cierre administrativo para vales sin expedientes localizados.
   */
  cerrarAdministrativamente(actorId: string, motivo: string | null, occurredAt: Date): void {
    if (this.state.estado !== 'NO_LOCALIZADA') {
      throw new InvalidStateTransitionError(this.state.estado, 'CERRADA');
    }

    // motivo se registra en el audit por el use case; el aggregate solo transiciona.
    void motivo;
    void actorId;

    this.state.estado = 'CERRADA';
    this.state.updatedAt = occurredAt;
  }

  // ── Lógica interna ───────────────────────────────────────────────────────────

  /**
   * Evalúa si todos los ítems están resueltos y transiciona el vale automáticamente.
   * Se invoca al final de registrarLocalizacion.
   *
   * Fuente: design.md §6.4, REQ-VA-005.4, REQ-VA-005.5, REQ-VA-005.6
   */
  private evaluarTransicionAutomatica(occurredAt: Date): void {
    const todosResueltos = this.state.items.every((i) => i.estaResuelto);
    if (!todosResueltos) return;

    const todoLocalizado = this.state.items.every((i) => i.estadoBusqueda === 'LOCALIZADO');
    const ninguno = this.state.items.every((i) => i.estadoBusqueda === 'NO_LOCALIZADO');

    if (todoLocalizado) {
      this.state.estado = 'COMPLETA';
    } else if (ninguno) {
      this.state.estado = 'NO_LOCALIZADA';
    } else {
      this.state.estado = 'PARCIAL';
    }

    this.state.updatedAt = occurredAt;
  }
}
