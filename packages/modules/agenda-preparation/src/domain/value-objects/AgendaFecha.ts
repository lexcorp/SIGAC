import { DomainError } from '@sigac/domain-kernel';

const CANONICAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export class AgendaFecha {
  private constructor(readonly value: string) {}

  static parse(value: string): AgendaFecha {
    if (typeof value !== 'string') {
      throw invalidAgendaFecha();
    }

    const match = CANONICAL_DATE.exec(value);
    if (!match) {
      throw invalidAgendaFecha();
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
      throw invalidAgendaFecha();
    }

    return new AgendaFecha(value);
  }

  equals(other: AgendaFecha): boolean { return this.value === other.value; }
  toString(): string { return this.value; }
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return leap ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function invalidAgendaFecha(): DomainError {
  return new DomainError('AGENDA_FECHA_INVALID', 'La fecha de Agenda debe ser una fecha civil gregoriana válida en formato YYYY-MM-DD.');
}
