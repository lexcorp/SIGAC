import type { ExpedienteCapability } from '../types/expediente.types';

const COMMAND_LABELS: Record<ExpedienteCapability, string> = {
  SOLICITAR: 'Solicitar',
  INICIAR_BUSQUEDA: 'Iniciar búsqueda',
  MARCAR_LOCALIZADO: 'Marcar localizado',
  MARCAR_NO_LOCALIZADO: 'Marcar no localizado',
  DISPATCH: 'Despachar',
  ACCEPT_CUSTODY: 'Aceptar custodia',
  ABRIR_PRESTAMO: 'Abrir préstamo',
  RENOVAR_PRESTAMO: 'Renovar préstamo',
  RECIBIR_DEVOLUCION: 'Recibir devolución',
  CONFIRMAR_REARCHIVO: 'Confirmar rearchivo',
  REPORTAR_INCIDENCIA: 'Reportar incidencia',
};

export interface CommandBarProps {
  readonly capabilities: readonly ExpedienteCapability[];
  readonly pendingCapability?: ExpedienteCapability | null;
  readonly onCommand: (capability: ExpedienteCapability) => void;
}

export function CommandBar({ capabilities, pendingCapability = null, onCommand }: CommandBarProps) {
  if (capabilities.length === 0) return null;
  return (
    <nav className="command-bar" aria-label="Acciones disponibles">
      {capabilities.map((capability) => (
        <button
          key={capability}
          type="button"
          disabled={pendingCapability !== null}
          aria-busy={pendingCapability === capability}
          onClick={() => onCommand(capability)}
        >
          {COMMAND_LABELS[capability]}
        </button>
      ))}
    </nav>
  );
}
