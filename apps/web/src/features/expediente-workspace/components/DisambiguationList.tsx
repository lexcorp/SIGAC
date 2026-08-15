import type { ExpedienteSearchItem } from '../types/expediente.types';

export interface DisambiguationListProps {
  readonly items: readonly ExpedienteSearchItem[];
  readonly onSelect: (expedienteId: string) => void;
}

export function DisambiguationList({ items, onSelect }: DisambiguationListProps) {
  if (items.length < 2) return null;
  return (
    <section aria-labelledby="disambiguation-title">
      <h2 id="disambiguation-title">Selecciona el expediente correcto</h2>
      <p>Se encontraron varias coincidencias. La selección debe ser manual.</p>
      <ul className="disambiguation-list">
        {items.map((item) => (
          <li key={item.expedienteId}>
            <button type="button" onClick={() => onSelect(item.expedienteId)}>
              <strong>{item.expedienteNumero}</strong>
              <span>{item.paciente.nombreOperativo}</span>
              <span>CURP: {item.paciente.curp}</span>
              <span>Número ISSSTE: {item.paciente.numeroIssste}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
