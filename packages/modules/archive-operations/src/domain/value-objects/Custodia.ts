/**
 * Custodia — Value Object
 *
 * Expresa quién responde operativamente por el expediente y cuándo fue aceptada
 * formalmente la custodia en destino.
 *
 * Fuente: DDD-007 v0.2.0, DDD-018 v0.2.0, DECISION-REGISTER OQ-EW-006.
 *
 * REGLAS:
 * - Custodia != permiso de acceso != propiedad.
 * - acceptedAt es null cuando el expediente está EN_TRASLADO sin CustodyAccepted.
 * - acceptedAt tiene valor cuando CustodyAccepted ha sido registrado (EN_CONSULTA).
 * - La confirmación es una acción autenticada y auditable; no requiere firma criptográfica.
 */

export interface CustodiaProps {
  /** Tipo de custodio: ARCHIVO, SERVICIO, MENSAJERO, etc. */
  readonly custodianType: string;
  /** Referencia al custodio (ej. id del usuario o servicio). */
  readonly custodianReference: string;
  /** Servicio/área de destino, si aplica. */
  readonly service: string | null;
  /** Ubicación de custodia, si aplica. */
  readonly location: string | null;
  /**
   * Timestamp de aceptación formal de custodia (CustodyAccepted).
   * null cuando el expediente está EN_TRASLADO sin aceptación confirmada.
   */
  readonly acceptedAt: Date | null;
}

export class Custodia {
  readonly custodianType: string;
  readonly custodianReference: string;
  readonly service: string | null;
  readonly location: string | null;
  private readonly acceptedAtValue: Date | null;

  private constructor(props: CustodiaProps) {
    this.custodianType = props.custodianType;
    this.custodianReference = props.custodianReference;
    this.service = props.service;
    this.location = props.location;
    this.acceptedAtValue = props.acceptedAt ? new Date(props.acceptedAt.getTime()) : null;
  }

  /** Crea una Custodia en estado de traslado (custodia aún no aceptada en destino). */
  static enTraslado(props: Omit<CustodiaProps, 'acceptedAt'>): Custodia {
    return new Custodia({ ...props, acceptedAt: null });
  }

  /** Crea una Custodia con aceptación formal registrada (EN_CONSULTA). */
  static aceptada(props: Omit<CustodiaProps, 'acceptedAt'> & { acceptedAt: Date }): Custodia {
    return new Custodia(props);
  }

  /** Crea una Custodia desde props directas (para rehidratación desde persistencia). */
  static from(props: CustodiaProps): Custodia {
    return new Custodia(props);
  }

  /** Indica si la custodia ha sido aceptada formalmente en destino. */
  get estaAceptada(): boolean {
    return this.acceptedAtValue !== null;
  }

  get acceptedAt(): Date | null {
    return this.acceptedAtValue ? new Date(this.acceptedAtValue.getTime()) : null;
  }

  /** Igualdad por valor. */
  equals(other: Custodia): boolean {
    return (
      this.custodianType === other.custodianType &&
      this.custodianReference === other.custodianReference &&
      this.service === other.service &&
      this.location === other.location &&
      (this.acceptedAtValue?.getTime() ?? null) === (other.acceptedAtValue?.getTime() ?? null)
    );
  }
}
