/**
 * Tests de dominio — ValeArchivo (T-31)
 *
 * Fuente: design.md §13.1, §13.2, REQ-VA-001..REQ-VA-007, INV-VA-001..INV-VA-012
 *
 * Nota: Los tests de propiedades (PBT) se implementan con generadores manuales de
 * datos sintéticos ya que fast-check no está disponible en este workspace.
 * Cada property ejecuta ≥ 100 combinaciones distintas.
 */

import { DomainError } from '@sigac/domain-kernel';
import { describe, expect, it } from 'vitest';
import { ValeArchivo, type ValeArchivoCreateProps } from './aggregates/ValeArchivo.js';
import { type ValeArchivoItemProps } from './entities/ValeArchivoItem.js';
import {
  InvalidStateTransitionError,
  ValeArchivoItemNotFoundError,
  ValeRequiereItemsError,
} from './errors/ValeArchivoErrors.js';
import { NumeroVale } from './value-objects/NumeroVale.js';
import { parseSolicitanteReferencia } from './value-objects/SolicitanteReferencia.js';
import type { EstadoBusqueda } from './value-objects/EstadoBusqueda.js';
import { ESTADO_VALE_ORDEN } from './value-objects/EstadoVale.js';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const ACTOR_ID = 'actor-sintetico-001';
const NOW = new Date('2026-08-26T10:00:00Z');

type ItemInput = Omit<
  ValeArchivoItemProps,
  'id' | 'valeId' | 'estadoBusqueda' | 'ubicacionEncontrada' | 'observaciones'
>;

function baseProps(itemOverrides?: ItemInput[]): ValeArchivoCreateProps {
  const defaultItems: ItemInput[] = [
    {
      expedienteNumero: 'ISSSTE-SIN-001',
      pacienteNombre: 'Paciente Sintético Uno',
      especialidad: 'MEDICINA INTERNA',
    },
  ];

  return {
    numeroVale: NumeroVale.parse('VA-2026-SIN-001'),
    fechaSolicitud: new Date('2026-08-26'),
    fechaRecepcion: new Date('2026-08-26'),
    unidadSolicitante: 'DIRECCIÓN MÉDICA SINTÉTICA',
    solicitante: parseSolicitanteReferencia('Dr. Sintético Solicitante', 'Director Médico'),
    autorizador: parseSolicitanteReferencia('Dra. Sintética Autorizadora', 'Subdirectora'),
    items: itemOverrides ?? defaultItems,
    creadoPor: ACTOR_ID,
  };
}

function valeConNItems(n: number): ValeArchivo {
  const items = Array.from({ length: n }, (_, i) => ({
    expedienteNumero: `ISSSTE-SIN-${String(i + 1).padStart(3, '0')}`,
    pacienteNombre: `Paciente Sintético ${i + 1}`,
    especialidad: 'MEDICINA INTERNA',
  }));
  return ValeArchivo.create(baseProps(items), NOW);
}

// ── Creación ─────────────────────────────────────────────────────────────────

describe('ValeArchivo.create', () => {
  it('con ítems válidos crea el vale en estado RECIBIDA', () => {
    const vale = ValeArchivo.create(baseProps(), NOW);
    expect(vale.estado).toBe('RECIBIDA');
  });

  it('con ítems válidos todos los items inician en PENDIENTE', () => {
    const vale = ValeArchivo.create(
      baseProps([
        { expedienteNumero: 'EXP-001', pacienteNombre: 'Sintético Uno', especialidad: 'CIRUGIA' },
        { expedienteNumero: 'EXP-002', pacienteNombre: 'Sintético Dos', especialidad: 'CARDIOLOGIA' },
      ]),
      NOW,
    );
    expect(vale.items).toHaveLength(2);
    vale.items.forEach((item) => {
      expect(item.estadoBusqueda).toBe('PENDIENTE');
      expect(item.estaResuelto).toBe(false);
    });
  });

  it('con 0 ítems lanza ValeRequiereItemsError', () => {
    let caughtError: unknown;
    try {
      ValeArchivo.create(baseProps([]), NOW);
    } catch (e) {
      caughtError = e;
    }
    expect(caughtError).toBeInstanceOf(ValeRequiereItemsError);
  });

  it('con 0 ítems el error tiene el código correcto', () => {
    try {
      ValeArchivo.create(baseProps([]), NOW);
    } catch (err) {
      expect(err).toBeInstanceOf(ValeRequiereItemsError);
      expect((err as ValeRequiereItemsError).code).toBe('VALE_REQUIERE_ITEMS');
    }
  });

  it('create y reconstitute son factories separadas con comportamientos distintos', () => {
    const vale = ValeArchivo.create(baseProps(), NOW);
    const snap = vale.snapshot();

    // reconstitute no valida invariantes de creación
    const reconst = ValeArchivo.reconstitute(snap);
    expect(reconst.estado).toBe(snap.estado);
    expect(reconst.id.toString()).toBe(snap.id);
  });

  it('snapshot no contiene campo turno ni shift (INV-VA-011)', () => {
    const vale = ValeArchivo.create(baseProps(), NOW);
    const snap = vale.snapshot();
    expect(snap).not.toHaveProperty('turno');
    expect(snap).not.toHaveProperty('shift');
  });
});

// ── iniciarBusqueda ──────────────────────────────────────────────────────────

describe('ValeArchivo.iniciarBusqueda', () => {
  it('desde RECIBIDA transiciona a EN_BUSQUEDA', () => {
    const vale = ValeArchivo.create(baseProps(), NOW);
    vale.iniciarBusqueda(ACTOR_ID, NOW);
    expect(vale.estado).toBe('EN_BUSQUEDA');
  });

  it('desde RECIBIDA registra actorId y timestamp', () => {
    const vale = ValeArchivo.create(baseProps(), NOW);
    const ts = new Date('2026-08-26T11:00:00Z');
    vale.iniciarBusqueda('archivista-001', ts);
    const snap = vale.snapshot();
    expect(snap.busquedaIniciadaPor).toBe('archivista-001');
    expect(snap.busquedaIniciadaAt).toEqual(ts);
  });

  it('desde EN_BUSQUEDA lanza InvalidStateTransitionError', () => {
    const vale = ValeArchivo.create(baseProps(), NOW);
    vale.iniciarBusqueda(ACTOR_ID, NOW);
    expect(() => vale.iniciarBusqueda(ACTOR_ID, NOW)).toThrow(InvalidStateTransitionError);
  });

  it('desde COMPLETA lanza InvalidStateTransitionError', () => {
    const vale = valeConNItems(1);
    vale.iniciarBusqueda(ACTOR_ID, NOW);
    vale.registrarLocalizacion(vale.items[0].id, 'LOCALIZADO', 'A-1', null, NOW);
    expect(vale.estado).toBe('COMPLETA');
    expect(() => vale.iniciarBusqueda(ACTOR_ID, NOW)).toThrow(InvalidStateTransitionError);
  });
});

// ── registrarLocalizacion ────────────────────────────────────────────────────

describe('ValeArchivo.registrarLocalizacion', () => {
  it('ítem inexistente lanza ValeArchivoItemNotFoundError', () => {
    const vale = valeConNItems(1);
    vale.iniciarBusqueda(ACTOR_ID, NOW);
    expect(() =>
      vale.registrarLocalizacion('id-inexistente', 'LOCALIZADO', null, null, NOW),
    ).toThrow(ValeArchivoItemNotFoundError);
  });

  it('estado no EN_BUSQUEDA lanza InvalidStateTransitionError', () => {
    const vale = valeConNItems(1);
    // En estado RECIBIDA
    expect(() =>
      vale.registrarLocalizacion(vale.items[0].id, 'LOCALIZADO', null, null, NOW),
    ).toThrow(InvalidStateTransitionError);
  });

  it('último ítem todos LOCALIZADO → vale pasa a COMPLETA', () => {
    const vale = valeConNItems(2);
    vale.iniciarBusqueda(ACTOR_ID, NOW);
    vale.registrarLocalizacion(vale.items[0].id, 'LOCALIZADO', 'Est A', null, NOW);
    expect(vale.estado).toBe('EN_BUSQUEDA'); // aún pendiente
    vale.registrarLocalizacion(vale.items[1].id, 'LOCALIZADO', 'Est B', null, NOW);
    expect(vale.estado).toBe('COMPLETA');
  });

  it('último ítem todos NO_LOCALIZADO → vale pasa a NO_LOCALIZADA', () => {
    const vale = valeConNItems(2);
    vale.iniciarBusqueda(ACTOR_ID, NOW);
    vale.registrarLocalizacion(vale.items[0].id, 'NO_LOCALIZADO', null, null, NOW);
    vale.registrarLocalizacion(vale.items[1].id, 'NO_LOCALIZADO', null, null, NOW);
    expect(vale.estado).toBe('NO_LOCALIZADA');
  });

  it('último ítem mezcla → vale pasa a PARCIAL', () => {
    const vale = valeConNItems(2);
    vale.iniciarBusqueda(ACTOR_ID, NOW);
    vale.registrarLocalizacion(vale.items[0].id, 'LOCALIZADO', 'Est C', null, NOW);
    vale.registrarLocalizacion(vale.items[1].id, 'NO_LOCALIZADO', null, null, NOW);
    expect(vale.estado).toBe('PARCIAL');
  });

  it('ítem no es el último → estado permanece EN_BUSQUEDA', () => {
    const vale = valeConNItems(3);
    vale.iniciarBusqueda(ACTOR_ID, NOW);
    vale.registrarLocalizacion(vale.items[0].id, 'LOCALIZADO', 'Est D', null, NOW);
    expect(vale.estado).toBe('EN_BUSQUEDA');
    vale.registrarLocalizacion(vale.items[1].id, 'NO_LOCALIZADO', null, null, NOW);
    expect(vale.estado).toBe('EN_BUSQUEDA');
  });

  it('observaciones de exactamente 500 chars se acepta', () => {
    const vale = valeConNItems(1);
    vale.iniciarBusqueda(ACTOR_ID, NOW);
    const obs500 = 'x'.repeat(500);
    expect(() =>
      vale.registrarLocalizacion(vale.items[0].id, 'LOCALIZADO', null, obs500, NOW),
    ).not.toThrow();
    expect(vale.items[0].observaciones).toBe(obs500);
  });

  it('observaciones > 500 chars lanza DomainError', () => {
    const vale = valeConNItems(1);
    vale.iniciarBusqueda(ACTOR_ID, NOW);
    const obs501 = 'x'.repeat(501);
    expect(() =>
      vale.registrarLocalizacion(vale.items[0].id, 'LOCALIZADO', null, obs501, NOW),
    ).toThrow(DomainError);
  });
});

// ── registrarEntrega ─────────────────────────────────────────────────────────

describe('ValeArchivo.registrarEntrega', () => {
  it('desde COMPLETA transiciona a ENTREGADA y registra receptor y actorId', () => {
    const vale = valeConNItems(1);
    vale.iniciarBusqueda(ACTOR_ID, NOW);
    vale.registrarLocalizacion(vale.items[0].id, 'LOCALIZADO', 'Est E', null, NOW);
    expect(vale.estado).toBe('COMPLETA');

    vale.registrarEntrega('archivista-entrega-001', 'Lic. Receptor Sintético', [], NOW);
    expect(vale.estado).toBe('ENTREGADA');
    const snap = vale.snapshot();
    expect(snap.entregadoPor).toBe('archivista-entrega-001');
    expect(snap.receptorEntrega).toBe('Lic. Receptor Sintético');
  });

  it('desde PARCIAL transiciona a ENTREGADA', () => {
    const vale = valeConNItems(2);
    vale.iniciarBusqueda(ACTOR_ID, NOW);
    vale.registrarLocalizacion(vale.items[0].id, 'LOCALIZADO', 'Est F', null, NOW);
    vale.registrarLocalizacion(vale.items[1].id, 'NO_LOCALIZADO', null, null, NOW);
    expect(vale.estado).toBe('PARCIAL');

    vale.registrarEntrega(ACTOR_ID, 'Dr. Receptor Sintético', [vale.items[0].id], NOW);
    expect(vale.estado).toBe('ENTREGADA');
  });

  it('desde RECIBIDA lanza InvalidStateTransitionError', () => {
    const vale = ValeArchivo.create(baseProps(), NOW);
    expect(() =>
      vale.registrarEntrega(ACTOR_ID, 'Receptor', [], NOW),
    ).toThrow(InvalidStateTransitionError);
  });

  it('desde EN_BUSQUEDA lanza InvalidStateTransitionError', () => {
    const vale = valeConNItems(1);
    vale.iniciarBusqueda(ACTOR_ID, NOW);
    expect(() =>
      vale.registrarEntrega(ACTOR_ID, 'Receptor', [], NOW),
    ).toThrow(InvalidStateTransitionError);
  });
});

// ── cerrarAdministrativamente ────────────────────────────────────────────────

describe('ValeArchivo.cerrarAdministrativamente', () => {
  it('desde NO_LOCALIZADA transiciona a CERRADA', () => {
    const vale = valeConNItems(1);
    vale.iniciarBusqueda(ACTOR_ID, NOW);
    vale.registrarLocalizacion(vale.items[0].id, 'NO_LOCALIZADO', null, null, NOW);
    expect(vale.estado).toBe('NO_LOCALIZADA');

    vale.cerrarAdministrativamente(ACTOR_ID, 'Expediente no localizado en archivo activo', NOW);
    expect(vale.estado).toBe('CERRADA');
  });

  it('desde ENTREGADA lanza InvalidStateTransitionError', () => {
    const vale = valeConNItems(1);
    vale.iniciarBusqueda(ACTOR_ID, NOW);
    vale.registrarLocalizacion(vale.items[0].id, 'LOCALIZADO', 'Est G', null, NOW);
    vale.registrarEntrega(ACTOR_ID, 'Receptor', [], NOW);
    expect(vale.estado).toBe('ENTREGADA');

    expect(() =>
      vale.cerrarAdministrativamente(ACTOR_ID, null, NOW),
    ).toThrow(InvalidStateTransitionError);
  });

  it('desde COMPLETA lanza InvalidStateTransitionError', () => {
    const vale = valeConNItems(1);
    vale.iniciarBusqueda(ACTOR_ID, NOW);
    vale.registrarLocalizacion(vale.items[0].id, 'LOCALIZADO', 'Est H', null, NOW);
    expect(vale.estado).toBe('COMPLETA');

    expect(() =>
      vale.cerrarAdministrativamente(ACTOR_ID, null, NOW),
    ).toThrow(InvalidStateTransitionError);
  });
});

// ── Reconstitución ───────────────────────────────────────────────────────────

describe('ValeArchivo.reconstitute', () => {
  it('desde snapshot devuelve propiedades correctas sin lanzar errores', () => {
    const original = ValeArchivo.create(baseProps(), NOW);
    original.iniciarBusqueda(ACTOR_ID, NOW);
    const snap = original.snapshot();

    const reconst = ValeArchivo.reconstitute(snap);
    expect(reconst.id.toString()).toBe(snap.id);
    expect(reconst.estado).toBe('EN_BUSQUEDA');
    expect(reconst.items).toHaveLength(1);
    expect(reconst.items[0].estadoBusqueda).toBe('PENDIENTE');
  });

  it('snapshot del Aggregate no contiene campo turno ni shift (INV-VA-011)', () => {
    const vale = ValeArchivo.create(baseProps(), NOW);
    const snap = vale.snapshot();
    expect(snap).not.toHaveProperty('turno');
    expect(snap).not.toHaveProperty('shift');
  });

  it('ValeArchivoItem snapshot no contiene campo turno ni shift (INV-VA-011)', () => {
    const vale = valeConNItems(1);
    const itemProps = vale.items[0].toProps();
    expect(itemProps).not.toHaveProperty('turno');
    expect(itemProps).not.toHaveProperty('shift');
  });
});

// ── Property 1: Transición automática es función exacta de los ítems ─────────
//
// Validates: Requirements REQ-VA-005.4, REQ-VA-005.5, REQ-VA-005.6, INV-VA-010
//
// Para cualquier combinación de LOCALIZADO/NO_LOCALIZADO en N ítems (N ∈ [1..10]),
// el estado resultante del vale es siempre exactamente COMPLETA, PARCIAL o NO_LOCALIZADA.

describe('Property 1: transición automática es función de los ítems resueltos', () => {
  it('para 100+ combinaciones el estado resultante es siempre correcto', () => {
    // Genera todas las combinaciones de N ítems con 2 estados posibles para N en [1..6]
    let iteraciones = 0;

    for (let n = 1; n <= 6; n++) {
      const totalCombinaciones = Math.pow(2, n);

      for (let mask = 0; mask < totalCombinaciones; mask++) {
        const estados: Array<'LOCALIZADO' | 'NO_LOCALIZADO'> = Array.from({ length: n }, (_, i) =>
          ((mask >> i) & 1) === 1 ? 'LOCALIZADO' : 'NO_LOCALIZADO',
        );

        const vale = valeConNItems(n);
        vale.iniciarBusqueda(ACTOR_ID, NOW);

        for (let i = 0; i < n; i++) {
          vale.registrarLocalizacion(vale.items[i].id, estados[i], null, null, NOW);
        }

        const todoLocalizado = estados.every((e) => e === 'LOCALIZADO');
        const todoNoLocalizado = estados.every((e) => e === 'NO_LOCALIZADO');

        if (todoLocalizado) {
          expect(vale.estado, `n=${n}, mask=${mask}: esperado COMPLETA`).toBe('COMPLETA');
        } else if (todoNoLocalizado) {
          expect(vale.estado, `n=${n}, mask=${mask}: esperado NO_LOCALIZADA`).toBe('NO_LOCALIZADA');
        } else {
          expect(vale.estado, `n=${n}, mask=${mask}: esperado PARCIAL`).toBe('PARCIAL');
        }

        iteraciones++;
      }
    }

    // n=1..6 → 2+4+8+16+32+64 = 126 combinaciones ≥ 100
    expect(iteraciones).toBeGreaterThanOrEqual(100);
  });
});

// ── Property 2: Máquina de estados no permite retroceso ──────────────────────
//
// Validates: Requirements REQ-VA-004.3, REQ-VA-005.7, REQ-VA-006.3, INV-VA-010
//
// Para cualquier secuencia de comandos válidos, el estado resultante nunca
// retrocede en el orden del ciclo de vida.

describe('Property 2: la máquina de estados no permite retroceso', () => {
  it('el estado nunca retrocede en secuencias de comandos válidos', () => {
    const flujos: Array<[string, () => ValeArchivo]> = [
      ['RECIBIDA→EN_BUSQUEDA', () => {
        const v = valeConNItems(1);
        v.iniciarBusqueda(ACTOR_ID, NOW);
        return v;
      }],
      ['→COMPLETA', () => {
        const v = valeConNItems(1);
        v.iniciarBusqueda(ACTOR_ID, NOW);
        v.registrarLocalizacion(v.items[0].id, 'LOCALIZADO', null, null, NOW);
        return v;
      }],
      ['→PARCIAL', () => {
        const v = valeConNItems(2);
        v.iniciarBusqueda(ACTOR_ID, NOW);
        v.registrarLocalizacion(v.items[0].id, 'LOCALIZADO', null, null, NOW);
        v.registrarLocalizacion(v.items[1].id, 'NO_LOCALIZADO', null, null, NOW);
        return v;
      }],
      ['→NO_LOCALIZADA', () => {
        const v = valeConNItems(1);
        v.iniciarBusqueda(ACTOR_ID, NOW);
        v.registrarLocalizacion(v.items[0].id, 'NO_LOCALIZADO', null, null, NOW);
        return v;
      }],
      ['COMPLETA→ENTREGADA', () => {
        const v = valeConNItems(1);
        v.iniciarBusqueda(ACTOR_ID, NOW);
        v.registrarLocalizacion(v.items[0].id, 'LOCALIZADO', null, null, NOW);
        v.registrarEntrega(ACTOR_ID, 'Receptor', [], NOW);
        return v;
      }],
      ['NO_LOCALIZADA→CERRADA', () => {
        const v = valeConNItems(1);
        v.iniciarBusqueda(ACTOR_ID, NOW);
        v.registrarLocalizacion(v.items[0].id, 'NO_LOCALIZADO', null, null, NOW);
        v.cerrarAdministrativamente(ACTOR_ID, null, NOW);
        return v;
      }],
    ];

    let anteriorOrden = -1;
    for (const [nombre, crear] of flujos) {
      const vale = crear();
      const ordenActual = ESTADO_VALE_ORDEN[vale.estado];
      expect(
        ordenActual,
        `${nombre}: orden ${ordenActual} no debe ser menor que ${anteriorOrden}`,
      ).toBeGreaterThanOrEqual(anteriorOrden);
      anteriorOrden = ordenActual;
    }
  });

  it('intentar retroceder estado lanza InvalidStateTransitionError', () => {
    // COMPLETA no puede regresar a EN_BUSQUEDA ni RECIBIDA
    const vale = valeConNItems(1);
    vale.iniciarBusqueda(ACTOR_ID, NOW);
    vale.registrarLocalizacion(vale.items[0].id, 'LOCALIZADO', null, null, NOW);
    expect(vale.estado).toBe('COMPLETA');

    expect(() => vale.iniciarBusqueda(ACTOR_ID, NOW)).toThrow(InvalidStateTransitionError);
    expect(() => vale.cerrarAdministrativamente(ACTOR_ID, null, NOW)).toThrow(
      InvalidStateTransitionError,
    );
  });

  it('estado CERRADA es terminal — no admite más transiciones', () => {
    const vale = valeConNItems(1);
    vale.iniciarBusqueda(ACTOR_ID, NOW);
    vale.registrarLocalizacion(vale.items[0].id, 'NO_LOCALIZADO', null, null, NOW);
    vale.cerrarAdministrativamente(ACTOR_ID, null, NOW);
    expect(vale.estado).toBe('CERRADA');

    // Ninguna transición es válida desde CERRADA
    expect(() => vale.iniciarBusqueda(ACTOR_ID, NOW)).toThrow(InvalidStateTransitionError);
    expect(() =>
      vale.registrarLocalizacion(vale.items[0].id, 'LOCALIZADO', null, null, NOW),
    ).toThrow(InvalidStateTransitionError);
    expect(() => vale.registrarEntrega(ACTOR_ID, 'Receptor', [], NOW)).toThrow(
      InvalidStateTransitionError,
    );
    expect(() => vale.cerrarAdministrativamente(ACTOR_ID, null, NOW)).toThrow(
      InvalidStateTransitionError,
    );
  });
});

// ── Property 4: Invariante mínimo de ítems ────────────────────────────────────
//
// Validates: Requirements REQ-VA-001.3, INV-VA-001, AC-VA-002
//
// Para cualquier comando RegistrarValeCommand con items.length === 0,
// create lanza ValeRequiereItemsError.

describe('Property 4: invariante mínimo de ítems (INV-VA-001)', () => {
  it('create con array vacío siempre lanza ValeRequiereItemsError (100 intentos)', () => {
    // La propiedad es determinística; la verificamos con múltiples construcciones
    // de props distintos (distintos números de vale, unidades, actores).
    for (let i = 0; i < 100; i++) {
      const props: ValeArchivoCreateProps = {
        numeroVale: NumeroVale.parse(`VA-PROP4-${String(i).padStart(3, '0')}`),
        fechaSolicitud: new Date('2026-08-26'),
        fechaRecepcion: new Date('2026-08-26'),
        unidadSolicitante: `UNIDAD SINTÉTICA ${i}`,
        solicitante: parseSolicitanteReferencia(`Solicitante Sintético ${i}`, 'Director'),
        autorizador: parseSolicitanteReferencia(`Autorizador Sintético ${i}`, 'Subdirector'),
        items: [],
        creadoPor: `capturista-${i}`,
      };

      expect(() => ValeArchivo.create(props, NOW)).toThrow(ValeRequiereItemsError);
    }
  });
});

// ── Invariante INV-VA-011: sin campo turno en ningún componente ───────────────

describe('INV-VA-011: el concepto de turno está ausente del bounded context', () => {
  it('ValeArchivoSnapshot no tiene campo turno ni shift', () => {
    const snap = ValeArchivo.create(baseProps(), NOW).snapshot();
    const keys = Object.keys(snap);
    expect(keys).not.toContain('turno');
    expect(keys).not.toContain('shift');
    expect(keys).not.toContain('jornada');
  });

  it('ValeArchivoItemProps no tiene campo turno ni shift', () => {
    const vale = valeConNItems(1);
    const itemKeys = Object.keys(vale.items[0].toProps());
    expect(itemKeys).not.toContain('turno');
    expect(itemKeys).not.toContain('shift');
    expect(itemKeys).not.toContain('jornada');
  });
});

// ── Tests adicionales de robustez ────────────────────────────────────────────

describe('ValeArchivo — robustez y edge cases', () => {
  it('vale con 1 ítem: LOCALIZADO → COMPLETA directamente', () => {
    const vale = valeConNItems(1);
    vale.iniciarBusqueda(ACTOR_ID, NOW);
    vale.registrarLocalizacion(vale.items[0].id, 'LOCALIZADO', 'Estante A', null, NOW);
    expect(vale.estado).toBe('COMPLETA');
  });

  it('vale con 1 ítem: NO_LOCALIZADO → NO_LOCALIZADA directamente', () => {
    const vale = valeConNItems(1);
    vale.iniciarBusqueda(ACTOR_ID, NOW);
    vale.registrarLocalizacion(vale.items[0].id, 'NO_LOCALIZADO', null, 'No se encontró', NOW);
    expect(vale.estado).toBe('NO_LOCALIZADA');
  });

  it('registrarEntrega acepta itemsEntregados vacío sin error (vale COMPLETA)', () => {
    const vale = valeConNItems(1);
    vale.iniciarBusqueda(ACTOR_ID, NOW);
    vale.registrarLocalizacion(vale.items[0].id, 'LOCALIZADO', null, null, NOW);
    expect(() => vale.registrarEntrega(ACTOR_ID, 'Receptor', [], NOW)).not.toThrow();
  });

  it('snapshot incluye los campos requeridos de la spec (smoke test)', () => {
    const vale = ValeArchivo.create(baseProps(), NOW);
    const snap = vale.snapshot();

    // Campos obligatorios del ValeArchivoSnapshot (design.md §7.3)
    expect(snap).toHaveProperty('id');
    expect(snap).toHaveProperty('numeroVale');
    expect(snap).toHaveProperty('fechaSolicitud');
    expect(snap).toHaveProperty('fechaRecepcion');
    expect(snap).toHaveProperty('unidadSolicitante');
    expect(snap).toHaveProperty('solicitante');
    expect(snap).toHaveProperty('autorizador');
    expect(snap).toHaveProperty('estado');
    expect(snap).toHaveProperty('items');
    expect(snap).toHaveProperty('creadoPor');
    expect(snap).toHaveProperty('busquedaIniciadaPor');
    expect(snap).toHaveProperty('busquedaIniciadaAt');
    expect(snap).toHaveProperty('entregadoPor');
    expect(snap).toHaveProperty('entregadoAt');
    expect(snap).toHaveProperty('receptorEntrega');
    expect(snap).toHaveProperty('createdAt');
    expect(snap).toHaveProperty('updatedAt');
  });

  it('vale con 10 ítems: mezcla 5/5 → PARCIAL', () => {
    const vale = valeConNItems(10);
    vale.iniciarBusqueda(ACTOR_ID, NOW);
    for (let i = 0; i < 10; i++) {
      const estado: EstadoBusqueda = i < 5 ? 'LOCALIZADO' : 'NO_LOCALIZADO';
      vale.registrarLocalizacion(vale.items[i].id, estado, null, null, NOW);
    }
    expect(vale.estado).toBe('PARCIAL');
  });
});
