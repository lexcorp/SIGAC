import { describe, expect, it } from 'vitest';
import type { GenerationSnapshotInput } from '../ports/GenerationSnapshotHasherPort.js';
import { AgendaSnapshotHasher } from './AgendaSnapshotHasher.js';

function input(): GenerationSnapshotInput {
  return {
    agendaDate: '2026-08-29',
    sourceImportacionId: 'importacion-hash',
    sourceVersion: 'a'.repeat(64),
    resolvedConflicts: [],
    groups: [{
      key: {
        agendaDate: '2026-08-29',
        servicioCodigo: 'CARD',
        medicoNumeroEmpleado: 'EMP-1',
      },
      servicioNombre: 'CARDIOLOGIA',
      medicoNombre: 'MEDICO UNO',
      items: [{
        expedienteReference: 'EXP-2',
        pacienteNombre: 'PACIENTE DOS',
        references: [{ folio: 'F-2', servicioCodigo: 'CARD', medicoNumeroEmpleado: 'EMP-1' }],
      }, {
        expedienteReference: 'EXP-1',
        pacienteNombre: 'PACIENTE UNO',
        references: [
          { folio: 'F-1B', servicioCodigo: 'CARD', medicoNumeroEmpleado: 'EMP-1' },
          { folio: 'F-1A', servicioCodigo: 'CARD', medicoNumeroEmpleado: 'EMP-1' },
        ],
      }],
    }],
  };
}

describe('AgendaSnapshotHasher', () => {
  it('returns deterministic SHA-256 lowercase hexadecimal', async () => {
    const hasher = new AgendaSnapshotHasher();
    const first = await hasher.compute(input());
    const second = await hasher.compute(input());

    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });

  it('is invariant to input ordering because ADR-0041 defines canonical array order', async () => {
    const hasher = new AgendaSnapshotHasher();
    const original = input();
    const group = original.groups[0]!;
    const reordered: GenerationSnapshotInput = {
      ...original,
      groups: [{
        ...group,
        items: [...group.items].reverse().map((item) => ({
          ...item,
          references: [...item.references].reverse(),
        })),
      }],
    };

    await expect(hasher.compute(reordered)).resolves.toBe(await hasher.compute(original));
  });

  it('changes when sourceVersion or a functional snapshot value changes', async () => {
    const hasher = new AgendaSnapshotHasher();
    const original = input();
    const base = await hasher.compute(original);
    const versionChanged = await hasher.compute({ ...original, sourceVersion: 'c'.repeat(64) });
    const group = original.groups[0]!;
    const valueChanged = await hasher.compute({
      ...original,
      groups: [{ ...group, medicoNombre: 'MEDICO CAMBIADO' }],
    });

    expect(versionChanged).not.toBe(base);
    expect(valueChanged).not.toBe(base);
  });

  it('includes human conflict resolution and is independent of evidence ordering', async () => {
    const hasher = new AgendaSnapshotHasher();
    const original = input();
    const card = { agendaDate: '2026-08-29', servicioCodigo: 'CARD', medicoNumeroEmpleado: 'EMP-1' };
    const cir = { agendaDate: '2026-08-29', servicioCodigo: 'CIR', medicoNumeroEmpleado: 'EMP-2' };
    const conflict = {
      expedienteReference: 'EXP-1',
      ownerGroup: card,
      alternatives: [
        { group: cir, references: [{ folio: 'F-2', servicioCodigo: 'CIR', medicoNumeroEmpleado: 'EMP-2' }] },
        { group: card, references: [
          { folio: 'F-1B', servicioCodigo: 'CARD', medicoNumeroEmpleado: 'EMP-1' },
          { folio: 'F-1A', servicioCodigo: 'CARD', medicoNumeroEmpleado: 'EMP-1' },
        ] },
      ],
    } as const;
    const withConflict = { ...original, resolvedConflicts: [conflict] };
    const reordered = {
      ...original,
      resolvedConflicts: [{
        ...conflict,
        alternatives: [...conflict.alternatives].reverse().map((alternative) => ({
          ...alternative,
          references: [...alternative.references].reverse(),
        })),
      }],
    };

    const resolvedHash = await hasher.compute(withConflict);
    await expect(hasher.compute(reordered)).resolves.toBe(resolvedHash);
    expect(resolvedHash).not.toBe(await hasher.compute(original));
    await expect(hasher.compute({
      ...withConflict,
      resolvedConflicts: [{ ...conflict, ownerGroup: cir }],
    })).resolves.not.toBe(resolvedHash);
  });
});
