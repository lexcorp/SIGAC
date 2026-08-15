import type { ExpedienteReadModel, ExpedienteSearchItem } from './types/expediente.types';

export function readModel(overrides: Partial<ExpedienteReadModel> = {}): ExpedienteReadModel {
  return {
    id: '9b2d3958-f383-4c53-9041-09172fdd408f',
    expedienteNumero: 'PERR810604/10',
    pacienteRef: { id: 'patient-1', displayLabel: 'Paciente Operativo' },
    estadoOperativo: 'DISPONIBLE',
    ubicacionActual: { id: 'location-1', codigo: 'ARCH-1', descripcion: 'Archivo central' },
    custodiaActual: null,
    prestamoActivo: null,
    solicitudActiva: null,
    incidenciasAbiertas: [],
    capabilities: [],
    rowVersion: '9007199254740993',
    ...overrides,
  };
}

export function searchItem(id: string): ExpedienteSearchItem {
  return {
    expedienteId: id,
    expedienteNumero: 'PERR810604/10',
    paciente: {
      idInstitucional: `patient-${id}`,
      curp: `CURP-${id}`,
      nombreOperativo: `Paciente ${id}`,
      numeroIssste: `ISSSTE-${id}`,
    },
    estadoOperativo: 'DISPONIBLE',
    ubicacion: null,
  };
}
