/**
 * Ubicacion — Value Object
 *
 * Expresa dónde está registrado el expediente físicamente.
 * Puede ser anaquel, zona temporal, carrito, consultorio, servicio u otra
 * ubicación institucional. La codificación física es configurable por Archivo Clínico.
 *
 * Fuente: DDD-007 v0.2.0, DDD-019.
 * OQ-EW-008 abierta: codificación exacta de ubicaciones temporales pendiente de
 * confirmación por Archivo Clínico — usar categoría genérica hasta resolución.
 */

export interface UbicacionProps {
  readonly id: string;
  readonly codigo: string;
  readonly descripcion: string;
}

export class Ubicacion {
  readonly id: string;
  readonly codigo: string;
  readonly descripcion: string;

  private constructor(props: UbicacionProps) {
    this.id = props.id;
    this.codigo = props.codigo;
    this.descripcion = props.descripcion;
  }

  /** Crea una Ubicacion con los datos definidos por el catálogo institucional. */
  static create(props: UbicacionProps): Ubicacion {
    return new Ubicacion(props);
  }

  /** Rehidrata una Ubicacion desde persistencia sin re-validar. */
  static rehydrate(props: UbicacionProps): Ubicacion {
    return new Ubicacion(props);
  }

  /** Igualdad por todos los componentes del valor. */
  equals(other: Ubicacion): boolean {
    return (
      this.id === other.id &&
      this.codigo === other.codigo &&
      this.descripcion === other.descripcion
    );
  }

  toString(): string {
    return `${this.codigo} — ${this.descripcion}`;
  }
}
