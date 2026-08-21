import { DomainError } from '@sigac/domain-kernel';

export interface ServicioEspecialidadProps { readonly codigo: string; readonly nombre: string; }
export class ServicioEspecialidad {
  readonly codigo: string;
  readonly nombre: string;
  private constructor(props: ServicioEspecialidadProps) { this.codigo = props.codigo; this.nombre = props.nombre; }
  static create(props: ServicioEspecialidadProps): ServicioEspecialidad {
    if (
      typeof props?.codigo !== 'string' ||
      props.codigo.trim() === '' ||
      typeof props.nombre !== 'string' ||
      props.nombre.trim() === ''
    ) {
      throw new DomainError('SERVICIO_ESPECIALIDAD_INVALID', 'El código y el nombre de Servicio/Especialidad son obligatorios.');
    }
    return new ServicioEspecialidad({ codigo: props.codigo.trim(), nombre: props.nombre.trim() });
  }
  equals(other: ServicioEspecialidad): boolean { return this.codigo === other.codigo; }
}
