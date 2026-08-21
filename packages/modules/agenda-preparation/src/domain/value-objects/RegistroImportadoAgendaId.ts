import { DomainError } from '@sigac/domain-kernel';

export class RegistroImportadoAgendaId {
  private constructor(readonly value: string) {}

  static parse(value: string): RegistroImportadoAgendaId {
    if (typeof value !== 'string' || value.trim() === '') {
      throw new DomainError('REGISTRO_IMPORTADO_AGENDA_ID_INVALID', 'El identificador de registro importado es obligatorio.');
    }
    return new RegistroImportadoAgendaId(value.trim());
  }

  equals(other: RegistroImportadoAgendaId): boolean { return this.value === other.value; }
  toString(): string { return this.value; }
}
