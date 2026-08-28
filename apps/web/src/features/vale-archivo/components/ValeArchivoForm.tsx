/**
 * ValeArchivoForm — formulario de captura del SM 1-14.
 *
 * Regla: sin validación de reglas de negocio.
 * El frontend envía el payload y muestra el code RFC7807 del backend.
 * La validación de items.length >= 1 la hace el Aggregate.
 */
import { useState } from 'react';
import type { CreateValeInput, CreateValeItemInput, ValeArchivoProblem } from '../types/vale-archivo.types';
import { ValeArchivoApiError } from '../api/valeArchivoApi';

function blankItem(): CreateValeItemInput {
  return { expedienteNumero: '', pacienteNombre: '', especialidad: '' };
}

interface Props {
  readonly onSubmit: (input: CreateValeInput) => Promise<void>;
  readonly onCancel: () => void;
  readonly submitting: boolean;
  readonly error: ValeArchivoProblem | null;
}

export function ValeArchivoForm({ onSubmit, onCancel, submitting, error }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [numeroVale, setNumeroVale]             = useState('');
  const [fechaSolicitud, setFechaSolicitud]     = useState(today);
  const [fechaRecepcion, setFechaRecepcion]     = useState(today);
  const [unidadSolicitante, setUnidadSolicitante] = useState('');
  const [solicitanteNombre, setSolicitanteNombre] = useState('');
  const [solicitanteCargo, setSolicitanteCargo]   = useState('');
  const [autorizadorNombre, setAutorizadorNombre] = useState('');
  const [autorizadorCargo, setAutorizadorCargo]   = useState('');
  const [items, setItems]                         = useState<CreateValeItemInput[]>([blankItem()]);

  function addItem() { setItems([...items, blankItem()]); }
  function removeItem(idx: number) { setItems(items.filter((_, i) => i !== idx)); }
  function updateItem(idx: number, field: keyof CreateValeItemInput, value: string) {
    setItems(items.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSubmit({
      numeroVale, fechaSolicitud, fechaRecepcion, unidadSolicitante,
      solicitanteNombre, solicitanteCargo, autorizadorNombre, autorizadorCargo,
      items,
    });
  }

  // Map RFC7807 code → mensaje accesible
  function errorMessage(problem: ValeArchivoProblem): string {
    const map: Record<string, string> = {
      VALE_REQUIERE_ITEMS: 'Debes agregar al menos un expediente.',
      HTTP_VALIDATION_ERROR: `Campo inválido: ${problem.errors?.[0]?.field ?? ''}`,
      PERMISSION_DENIED: 'No tienes permiso para crear vales.',
      // T-BUG-VA-001: duplicate numero_vale
      VALE_NUMERO_DUPLICADO: 'Ya existe un vale con ese número en este tenant. Usa un número diferente.',
    };
    return map[problem.code] ?? problem.detail ?? 'No fue posible guardar el vale.';
  }

  return (
    <section className="vale-archivo-form" aria-label="Nuevo Vale SM 1-14">
      <h2>Nuevo Vale SM 1-14</h2>

      {error && (
        <p role="alert" className="problem-banner" aria-live="assertive">
          {errorMessage(error)}
        </p>
      )}

      <form onSubmit={(e) => { void handleSubmit(e); }}>
        {/* Identificación */}
        <fieldset>
          <legend>Identificación del vale</legend>
          <label htmlFor="numero-vale">Número de vale</label>
          <input id="numero-vale" type="text" value={numeroVale}
            onChange={(e) => setNumeroVale(e.target.value)} required />

          <label htmlFor="fecha-solicitud">Fecha de solicitud</label>
          <input id="fecha-solicitud" type="date" value={fechaSolicitud}
            onChange={(e) => setFechaSolicitud(e.target.value)} required />

          <label htmlFor="fecha-recepcion">Fecha de recepción</label>
          <input id="fecha-recepcion" type="date" value={fechaRecepcion}
            onChange={(e) => setFechaRecepcion(e.target.value)} required />

          <label htmlFor="unidad-solicitante">Unidad solicitante</label>
          <input id="unidad-solicitante" type="text" value={unidadSolicitante}
            onChange={(e) => setUnidadSolicitante(e.target.value)} required />
        </fieldset>

        {/* Solicitante */}
        <fieldset>
          <legend>Solicitante</legend>
          <label htmlFor="solicitante-nombre">Nombre</label>
          <input id="solicitante-nombre" type="text" value={solicitanteNombre}
            onChange={(e) => setSolicitanteNombre(e.target.value)} required />
          <label htmlFor="solicitante-cargo">Cargo</label>
          <input id="solicitante-cargo" type="text" value={solicitanteCargo}
            onChange={(e) => setSolicitanteCargo(e.target.value)} required />
        </fieldset>

        {/* Autorizador */}
        <fieldset>
          <legend>Autoriza</legend>
          <label htmlFor="autorizador-nombre">Nombre</label>
          <input id="autorizador-nombre" type="text" value={autorizadorNombre}
            onChange={(e) => setAutorizadorNombre(e.target.value)} required />
          <label htmlFor="autorizador-cargo">Cargo</label>
          <input id="autorizador-cargo" type="text" value={autorizadorCargo}
            onChange={(e) => setAutorizadorCargo(e.target.value)} required />
        </fieldset>

        {/* Expedientes */}
        <fieldset>
          <legend>Expedientes solicitados</legend>
          {items.map((item, idx) => (
            <div key={idx} className="item-row" role="group" aria-label={`Expediente ${idx + 1}`}>
              <label htmlFor={`exp-num-${idx}`}>Expediente</label>
              <input id={`exp-num-${idx}`} type="text" value={item.expedienteNumero}
                placeholder="Número de expediente"
                onChange={(e) => updateItem(idx, 'expedienteNumero', e.target.value)} />

              <label htmlFor={`exp-pac-${idx}`}>Paciente</label>
              <input id={`exp-pac-${idx}`} type="text" value={item.pacienteNombre}
                placeholder="Nombre del derechohabiente"
                onChange={(e) => updateItem(idx, 'pacienteNombre', e.target.value)} />

              <label htmlFor={`exp-esp-${idx}`}>Especialidad</label>
              <input id={`exp-esp-${idx}`} type="text" value={item.especialidad}
                placeholder="Especialidad médica"
                onChange={(e) => updateItem(idx, 'especialidad', e.target.value)} />

              {items.length > 1 && (
                <button type="button" onClick={() => removeItem(idx)}
                  aria-label={`Eliminar expediente ${idx + 1}`}>
                  Eliminar
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={addItem} aria-label="Agregar expediente">
            + Agregar expediente
          </button>
        </fieldset>

        <div className="form-actions">
          <button type="submit" disabled={submitting} aria-label="Guardar vale">
            {submitting ? 'Guardando…' : 'Guardar vale'}
          </button>
          <button type="button" onClick={onCancel} disabled={submitting}>
            Cancelar
          </button>
        </div>
      </form>
    </section>
  );
}
