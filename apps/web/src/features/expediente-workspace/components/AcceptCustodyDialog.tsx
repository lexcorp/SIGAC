import { useState, type FormEvent } from 'react';
import type { AcceptCustodyRequest, UbicacionOption } from '../types/expediente.types';

export function AcceptCustodyDialog(props: {
  readonly locations: readonly UbicacionOption[];
  readonly rowVersion: string;
  readonly pending?: boolean;
  readonly onClose: () => void;
  readonly onSubmit: (input: Omit<AcceptCustodyRequest, 'expectedRowVersion'>) => Promise<void>;
}) {
  const [error, setError] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(false);
    const data = new FormData(event.currentTarget);
    const ubicacionDestino = props.locations.find((item) => item.id === data.get('destination'))!;
    try {
      await props.onSubmit({ receptor: { type: String(data.get('receptorType')), reference: String(data.get('receptorReference')), service: String(data.get('service') ?? '') || null }, ubicacionDestino, businessReference: { type: String(data.get('businessType')), id: String(data.get('businessId') ?? '') || null } });
      props.onClose();
    } catch { setError(true); }
  }
  return <section role="dialog" aria-modal="true" aria-labelledby="custody-title">
    <h2 id="custody-title">Aceptar custodia</h2>
    <form onSubmit={(event) => { void submit(event); }}>
      <label>Receptor tipo<input name="receptorType" required /></label>
      <label>Receptor referencia<input name="receptorReference" required /></label>
      <label>Servicio<input name="service" /></label>
      <label>Ubicación destino<select name="destination" required defaultValue=""><option value="" disabled>Selecciona ubicación</option>{props.locations.map((u) => <option key={u.id} value={u.id}>{u.codigo} — {u.descripcion}</option>)}</select></label>
      <label>Tipo de referencia de negocio<input name="businessType" required /></label>
      <label>ID de referencia de negocio<input name="businessId" /></label>
      <input type="hidden" name="expectedRowVersion" value={props.rowVersion} readOnly />
      {error ? <p role="alert">No fue posible completar la operación.</p> : null}
      <button type="button" onClick={props.onClose}>Cancelar</button><button disabled={props.pending}>Confirmar recepción</button>
    </form>
  </section>;
}
