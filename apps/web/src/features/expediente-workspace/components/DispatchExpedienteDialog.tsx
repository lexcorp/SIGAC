import { useState, type FormEvent } from 'react';
import type { DispatchRequest, UbicacionOption } from '../types/expediente.types';

export function DispatchExpedienteDialog(props: {
  readonly locations: readonly UbicacionOption[];
  readonly rowVersion: string;
  readonly pending?: boolean;
  readonly onClose: () => void;
  readonly onSubmit: (input: Omit<DispatchRequest, 'expectedRowVersion'>) => Promise<void>;
}) {
  const [error, setError] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(false);
    const data = new FormData(event.currentTarget);
    const destination = props.locations.find((item) => item.id === data.get('destination'))!;
    try {
      await props.onSubmit({ destination, intendedCustodian: { type: String(data.get('custodianType')), reference: String(data.get('custodianReference')) }, businessReference: { type: String(data.get('businessType')), id: String(data.get('businessId') ?? '') || null } });
      props.onClose();
    } catch { setError(true); }
  }
  return <section role="dialog" aria-modal="true" aria-labelledby="dispatch-title">
    <h2 id="dispatch-title">Despachar expediente</h2>
    <form onSubmit={(event) => { void submit(event); }}>
      <label>Destino<select name="destination" required defaultValue=""><option value="" disabled>Selecciona ubicación</option>{props.locations.map((u) => <option key={u.id} value={u.id}>{u.codigo} — {u.descripcion}</option>)}</select></label>
      <label>Tipo de custodio previsto<input name="custodianType" required /></label>
      <label>Referencia de custodio previsto<input name="custodianReference" required /></label>
      <label>Tipo de referencia de negocio<input name="businessType" required /></label>
      <label>ID de referencia de negocio<input name="businessId" /></label>
      <input type="hidden" name="expectedRowVersion" value={props.rowVersion} readOnly />
      {error ? <p role="alert">No fue posible completar la operación.</p> : null}
      <button type="button" onClick={props.onClose}>Cancelar</button><button disabled={props.pending}>Confirmar despacho</button>
    </form>
  </section>;
}
