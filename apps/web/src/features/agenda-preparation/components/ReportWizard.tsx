/**
 * ReportWizard — T-24 preparation-reports REQ-PR-002
 *
 * Lets the user select which services to include in the PDF preparation report,
 * then triggers the server-side PDF generation and downloads the result.
 *
 * Design decisions (ADR-0030, ADR-0031):
 * - The PDF is generated server-side by PDFKitPreparationReportGenerator.
 * - Turno (MATUTINO/VESPERTINO) appears in the PDF but is NOT a filter here —
 *   it is derived automatically from appointmentTime (ADR-0031).
 * - The "Generar PDF" button is only enabled when permissions.has('AGENDA_PRINT').
 *   Authorization is always re-verified server-side.
 * - No window.print() anywhere.
 */

import { useState } from 'react';
import { agendaApi } from '../api/agendaApi';
import { AgendaApiError } from '../api/agendaApi';
import type { PreparationItem, PreparationOrder } from '../types/agenda.types';

interface Props {
  readonly date: string;
  readonly items: readonly PreparationItem[];       // loaded from the lista tab
  readonly order: PreparationOrder;
  readonly canPrint: boolean;                       // server-derived: permissions.has('AGENDA_PRINT')
}

type WizardState = 'idle' | 'generating' | 'done' | 'error';

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function safeErrorMessage(err: unknown): string {
  if (err instanceof AgendaApiError) {
    switch (err.problem?.code) {
      case 'NO_ACTIVE_APPOINTMENTS':
        return 'No hay citas activas para los servicios seleccionados en esta fecha.';
      case 'PERMISSION_DENIED':
        return 'No tienes permiso para generar reportes PDF.';
      case 'AUTHENTICATION_REQUIRED':
        return 'Tu sesión no está disponible. Vuelve a iniciar sesión.';
      default:
        return 'No fue posible generar el PDF. Inténtalo de nuevo más tarde.';
    }
  }
  return 'No fue posible generar el PDF. Inténtalo de nuevo más tarde.';
}

export function ReportWizard({ date, items, order, canPrint }: Props) {
  // Derive available services from currently loaded items
  const availableServices = [...new Map(
    items.map((i) => [i.servicioEspecialidad.codigo, i.servicioEspecialidad]),
  ).values()].sort((a, b) => a.nombre.localeCompare(b.nombre));

  const [selectedServices, setSelectedServices] = useState<ReadonlySet<string>>(
    new Set(),  // empty = "all services"
  );
  const [wizardState, setWizardState] = useState<WizardState>('idle');
  const [errorMsg, setErrorMsg]       = useState<string | null>(null);

  function toggleService(codigo: string): void {
    setSelectedServices((prev) => {
      const next = new Set(prev);
      if (next.has(codigo)) next.delete(codigo); else next.add(codigo);
      return next;
    });
  }

  function selectAll(): void    { setSelectedServices(new Set()); }
  function deselectAll(): void  { setSelectedServices(new Set(availableServices.map((s) => s.codigo))); }

  const servicesForRequest =
    selectedServices.size === 0
      ? null           // null → all services
      : [...selectedServices];

  // Preview: how many citas will be included
  const previewCount =
    selectedServices.size === 0
      ? items.length
      : items.filter((i) => selectedServices.has(i.servicioEspecialidad.codigo)).length;

  async function handleGenerate(): Promise<void> {
    if (!canPrint) return;
    setWizardState('generating');
    setErrorMsg(null);
    try {
      const { blob, filename } = await agendaApi.generatePreparationReport(date, {
        services: servicesForRequest,
        order,
      });
      triggerDownload(blob, filename);
      setWizardState('done');
    } catch (err: unknown) {
      setErrorMsg(safeErrorMessage(err));
      setWizardState('error');
    }
  }

  const displayDate = new Date(date + 'T12:00:00').toLocaleDateString('es-MX', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  return (
    <section className="report-wizard" aria-label="Generar paquetes PDF">
      <h2>Generar paquetes PDF</h2>

      <div className="report-wizard-date">
        <strong>Fecha de consulta:</strong> {displayDate}
      </div>

      {/* ── Service selection ────────────────────────────────────────────── */}
      <fieldset className="report-wizard-services">
        <legend>Servicios a incluir</legend>
        <div className="report-wizard-service-actions">
          <button type="button" onClick={selectAll} aria-label="Incluir todos los servicios">
            Todos
          </button>
          <button type="button" onClick={deselectAll} aria-label="Deseleccionar todos los servicios">
            Ninguno
          </button>
        </div>
        {availableServices.length === 0 ? (
          <p className="empty-state">No hay servicios disponibles para esta fecha.</p>
        ) : (
          <ul className="report-wizard-service-list" role="list">
            {availableServices.map((s) => {
              const id = `service-${s.codigo}`;
              const checked = selectedServices.size === 0 || selectedServices.has(s.codigo);
              const citaCount = items.filter((i) => i.servicioEspecialidad.codigo === s.codigo).length;
              return (
                <li key={s.codigo}>
                  <label htmlFor={id} className="report-wizard-service-item">
                    <input
                      id={id}
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleService(s.codigo)}
                      aria-label={`Incluir ${s.nombre} (${citaCount} citas)`}
                    />
                    <span className="service-nombre">{s.nombre}</span>
                    <span className="service-codigo">({s.codigo})</span>
                    <span className="service-count">{citaCount} cita{citaCount !== 1 ? 's' : ''}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </fieldset>

      {/* ── Summary ──────────────────────────────────────────────────────── */}
      <p className="report-wizard-summary" aria-live="polite">
        El PDF incluirá <strong>{previewCount}</strong> cita{previewCount !== 1 ? 's' : ''}, agrupadas por
        servicio y médico con turno (MATUTINO/VESPERTINO) en cada encabezado.
      </p>

      {/* ── Actions ──────────────────────────────────────────────────────── */}
      {!canPrint ? (
        <p role="alert" className="problem-banner">
          No tienes permiso para generar reportes PDF.
        </p>
      ) : (
        <button
          type="button"
          onClick={() => { void handleGenerate(); }}
          disabled={wizardState === 'generating' || previewCount === 0}
          aria-busy={wizardState === 'generating'}
          aria-label="Generar y descargar PDF de preparación"
          className="report-wizard-generate-btn"
        >
          {wizardState === 'generating' ? 'Generando PDF…' : 'Generar PDF'}
        </button>
      )}

      {wizardState === 'done' && (
        <p role="status" className="report-wizard-success" aria-live="polite">
          PDF descargado correctamente.
        </p>
      )}
      {wizardState === 'error' && errorMsg && (
        <p role="alert" className="problem-banner" aria-live="assertive">
          {errorMsg}
        </p>
      )}
    </section>
  );
}
