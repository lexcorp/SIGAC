import { useId, useRef, useState } from 'react';
import type { AgendaImportResponse, AgendaProblemDetails } from '../types/agenda.types';
import { AgendaMetrics } from './AgendaMetrics';
import { generateKey } from '../utils/generateKey';

type WizardStep = 'select' | 'submitting' | 'result' | 'error';

interface Props {
  readonly onImport: (file: File, idempotencyKey: string) => Promise<AgendaImportResponse>;
  readonly onClose: () => void;
  readonly onViewResults?: (importacionId: string) => void;
}

const SUPPORTED_EXTENSION = /\.xls$/i;

const STEP_LABELS: readonly ('select' | 'submitting' | 'result')[] = ['select', 'submitting', 'result'];
const STEP_NAMES: Record<'select' | 'submitting' | 'result', string> = {
  select: 'Seleccionar',
  submitting: 'Procesar',
  result: 'Resultado',
};

export function ImportAgendaWizard({ onImport, onClose, onViewResults }: Props) {
  const fileInputId = useId();
  const [step, setStep] = useState<WizardStep>('select');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [result, setResult] = useState<AgendaImportResponse | null>(null);
  const [problemCode, setProblemCode] = useState<string | null>(null);
  const idempotencyKeyRef = useRef<string>(generateKey());

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setFileError(null);
    if (!file) {
      setSelectedFile(null);
      return;
    }
    if (!SUPPORTED_EXTENSION.test(file.name)) {
      setFileError('El archivo debe tener extensión .xls (Agenda SIMEF).');
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile) {
      setFileError('Debes seleccionar un archivo .xls.');
      return;
    }
    setStep('submitting');
    try {
      const res = await onImport(selectedFile, idempotencyKeyRef.current);
      setResult(res);
      setStep('result');
    } catch (err: unknown) {
      const problem =
        err instanceof Error && 'problem' in err
          ? (err as { problem: AgendaProblemDetails | null }).problem
          : null;
      setProblemCode(problem?.code ?? null);
      setStep('error');
    }
  }

  function handleRetry() {
    setStep('select');
    setSelectedFile(null);
    setFileError(null);
    setProblemCode(null);
    idempotencyKeyRef.current = generateKey();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-wizard-title"
      className="import-wizard"
    >
      <h2 id="import-wizard-title">Importar / actualizar Agenda</h2>

      {/* Stepper */}
      <nav aria-label="Pasos del asistente">
        <ol className="wizard-stepper">
          {STEP_LABELS.map((s) => {
            const idx = STEP_LABELS.indexOf(s);
            const currentIdx =
              step === 'error'
                ? STEP_LABELS.indexOf('submitting')
                : STEP_LABELS.indexOf(step as 'select' | 'submitting' | 'result');
            const status =
              idx < currentIdx ? 'completed' : idx === currentIdx ? 'current' : 'upcoming';
            return (
              <li
                key={s}
                aria-current={status === 'current' ? 'step' : undefined}
                className={`wizard-step wizard-step--${status}`}
              >
                {STEP_NAMES[s]}
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Step: Select */}
      {step === 'select' && (
        <form onSubmit={(e) => { void handleSubmit(e); }} noValidate>
          <p>Agenda de Archivo Clínico exportada por SIMEF</p>
          <div className="file-dropzone">
            <label htmlFor={fileInputId}>
              {selectedFile
                ? `Seleccionado: ${selectedFile.name}`
                : 'Arrastre un archivo .xls aquí o haga clic para seleccionar'}
            </label>
            <input
              id={fileInputId}
              type="file"
              accept=".xls"
              aria-describedby={fileError ? 'file-error' : undefined}
              aria-invalid={fileError !== null}
              onChange={handleFileChange}
            />
            {selectedFile && (
              <button
                type="button"
                onClick={() => {
                  setSelectedFile(null);
                  setFileError(null);
                }}
              >
                Reemplazar
              </button>
            )}
          </div>
          {fileError && (
            <p id="file-error" role="alert" className="field-error">
              {fileError}
            </p>
          )}
          <div className="wizard-actions">
            <button type="button" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" disabled={!selectedFile}>
              Continuar
            </button>
          </div>
        </form>
      )}

      {/* Step: Submitting */}
      {step === 'submitting' && (
        <div aria-live="polite" aria-busy="true" className="wizard-processing">
          <div className="indeterminate-loader" aria-hidden="true" />
          <p>Procesando la Agenda…</p>
          <p className="caution-text">Espere a que finalice. No repita la operación.</p>
        </div>
      )}

      {/* Step: Result */}
      {step === 'result' && result && (
        <div aria-live="polite" className="wizard-result">
          <AgendaMetrics outcome={result.outcome} metrics={result.metrics} />
          <div className="wizard-actions">
            {onViewResults && (
              <button
                type="button"
                onClick={() => onViewResults(result.importacionId)}
              >
                Ver resultados
              </button>
            )}
            <button type="button" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Step: Error */}
      {step === 'error' && (
        <div role="alert" aria-live="assertive" className="wizard-error">
          <p className="problem-banner">{safeImportError(problemCode)}</p>
          {isRetryable(problemCode) && (
            <button type="button" onClick={handleRetry}>
              Volver a seleccionar
            </button>
          )}
          <button type="button" onClick={onClose}>
            Cerrar
          </button>
        </div>
      )}
    </div>
  );
}

function safeImportError(code: string | null): string {
  switch (code) {
    case 'PERMISSION_DENIED':
      return 'No tienes permiso para importar Agenda.';
    case 'AGENDA_UPLOAD_TOO_LARGE':
      return 'El archivo excede el límite de tamaño permitido.';
    case 'AGENDA_ARTIFACT_UNSUPPORTED':
      return 'El formato del archivo no es compatible.';
    case 'AGENDA_LAYOUT_REJECTED':
      return 'El archivo no coincide con el layout de Agenda SIMEF.';
    case 'IDEMPOTENCY_KEY_REUSED':
      return 'Esta clave ya fue utilizada con un archivo diferente.';
    case 'AGENDA_IMPORT_TIMEOUT':
      return 'La operación tardó demasiado. Revisa el estado actual de la Agenda.';
    case 'AUTHENTICATION_REQUIRED':
      return 'Tu sesión no está disponible.';
    default:
      return 'No fue posible completar la importación. Inténtalo de nuevo más tarde.';
  }
}

function isRetryable(code: string | null): boolean {
  return code !== 'PERMISSION_DENIED' && code !== 'AUTHENTICATION_REQUIRED';
}
