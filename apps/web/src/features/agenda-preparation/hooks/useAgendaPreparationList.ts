/**
 * useAgendaPreparationList — hook de paginación server-side para la lista de preparación.
 *
 * T-P1: de useInfiniteQuery (acumulativo + "Cargar más") a useQuery
 * con cursor explícito y tamaño de página configurable (50 / 100 / 200).
 *
 * Cada clic en Siguiente / Anterior hace un request independiente al backend.
 * No acumula registros en memoria; la tabla siempre muestra exactamente una página.
 */
import { useQuery } from '@tanstack/react-query';
import type { AgendaPreparationPage, PreparationOrder } from '../types/agenda.types';
import { agendaApi, type AgendaApi } from '../api/agendaApi';

export type PageSize = 50 | 100 | 200;
export const PAGE_SIZE_OPTIONS: readonly PageSize[] = [50, 100, 200] as const;

export function useAgendaPreparationList(
  date: string | null,
  order: PreparationOrder,
  limit: PageSize = 50,
  cursor: string | undefined = undefined,
  api: AgendaApi = agendaApi,
) {
  return useQuery<AgendaPreparationPage>({
    queryKey: ['agenda-preparation-list', date, order, limit, cursor],
    queryFn: () => api.getPreparationList(date!, order, limit, cursor),
    enabled: date !== null && date.length > 0,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
}

/** Print hook — unchanged (Paquetes tab uses this for the services list) */
export function useAgendaPreparationPrint(
  date: string | null,
  order: PreparationOrder,
  enabled = false,
  api: AgendaApi = agendaApi,
) {
  return useQuery({
    queryKey: ['agenda-preparation-print', date, order],
    queryFn: () => api.printPreparationList(date!, order),
    enabled: enabled && date !== null && date.length > 0,
  });
}
