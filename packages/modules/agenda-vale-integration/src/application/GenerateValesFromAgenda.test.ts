/**
 * T-02 — GenerateValesFromAgenda unit tests.
 *
 * Covers: 0/1/N groups; stable keys; replay (ALREADY_GENERATED);
 * tenant propagation; no partial batches; same-group dedup; cross-group
 * conflict; unresolved / SERVICE_NOT_RESOLVED; stale source version;
 * permission denied; zero eligible items.
 *
 * All data is synthetic. No real SIMEF or patient data.
 */

import { describe, expect, it, vi, type Mock } from 'vitest';
import type { RequestContext, TenantContext } from '@sigac/tenant';
import type {
  AgendaPreparationProjection,
  AgendaAgendaItem,
  ValeGroupKey,
  ValeGenerationBatchResult,
} from '../contracts/index.js';
import type {
  AgendaPreparationReadPort,
  GenerationSnapshotHasherPort,
  ValeGenerationPort,
} from '../ports/index.js';
import { GenerateValesFromAgenda } from './GenerateValesFromAgenda.js';
import { AgendaValeIntegrationError } from './errors.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TENANT: TenantContext = {
  tenantId: 'tenant-t02',
  slug: 'hospital-t02',
  hospitalId: 'hosp-t02',
  databaseName: 'sigac_t02',
  timezone: 'America/Mexico_City',
};

function makeContext(perms: string[] = ['AGENDA_VIEW', 'REQUEST_CREATE']): RequestContext {
  return {
    actor: { actorId: 'actor-t02', roles: new Set(), permissions: new Set(perms), tenantIds: new Set([TENANT.tenantId]) },
    tenant: TENANT,
    requestId: 'req-t02',
    correlationId: 'corr-t02',
    source: 'WEB',
  };
}

function makeItem(overrides: Partial<AgendaAgendaItem> = {}): AgendaAgendaItem {
  return {
    folio: 'FOLIO-T02-001',
    agendaDate: '2026-08-29',
    appointmentTime: '08:00',
    tipoConsulta: 'FIRST_TIME',
    tipoDerechohabiente: 'ACTIVO',
    pacienteNombre: 'PACIENTE SINT T02',
    expedienteReference: 'EXP-T02-001',
    medico: { numeroEmpleado: '000123', nombre: 'DR SINTETICO T02' },
    servicio: { codigo: 'CARD', nombre: 'CARDIOLOGÍA' },
    ...overrides,
  };
}

function makeProjection(items: AgendaAgendaItem[]): AgendaPreparationProjection {
  return {
    agendaDate: '2026-08-29',
    sourceImportacionId: 'import-t02',
    sourceVersion: 'version-opaque-t02',
    items,
  };
}

const HEADER = {
  fechaSolicitud: '2026-08-29',
  fechaRecepcion: '2026-08-29',
  unidadSolicitante: 'DIRECCIÓN MÉDICA SINT',
  solicitante: { nombre: 'DR SINT SOLICITANTE', cargo: 'Director' },
  autorizador: { nombre: 'DRA SINT AUTORIZADOR', cargo: 'Subdirectora' },
};

// ── Fake port factories ───────────────────────────────────────────────────────

function makeReadPort(
  projection: AgendaPreparationProjection | null = makeProjection([makeItem()]),
  isCurrent = true,
): AgendaPreparationReadPort {
  return {
    findPreparedAgenda: vi.fn().mockResolvedValue(projection),
    isCurrentVersion:   vi.fn().mockResolvedValue(isCurrent),
  };
}

function makeHasher(hash = 'hash-t02'): GenerationSnapshotHasherPort {
  return { compute: vi.fn().mockResolvedValue(hash) };
}

function makeValePort(
  result: ValeGenerationBatchResult = {
    generatedVales: [{
      valeId: 'vale-t02-001',
      numeroVale: 'VA-20260829-001',
      group: { agendaDate: '2026-08-29', servicioCodigo: 'CARD', medicoNumeroEmpleado: '000123' },
      outcome: 'GENERATED',
    }],
  },
): ValeGenerationPort {
  return { generateBatch: vi.fn().mockResolvedValue(result) };
}

function makeSvc(overrides: {
  readPort?: AgendaPreparationReadPort;
  hasher?: GenerationSnapshotHasherPort;
  valePort?: ValeGenerationPort;
} = {}) {
  const readPort = overrides.readPort ?? makeReadPort();
  const hasher   = overrides.hasher   ?? makeHasher();
  const valePort = overrides.valePort ?? makeValePort();
  const svc = new GenerateValesFromAgenda({ agendaReadPort: readPort, hasherPort: hasher, valeGenPort: valePort });
  return { svc, readPort, hasher, valePort };
}

// ── T-02 tests ────────────────────────────────────────────────────────────────

describe('GenerateValesFromAgenda — T-02', () => {

  // ── Authorization ──────────────────────────────────────────────────────────

  it('PERMISSION_DENIED when AGENDA_VIEW is missing', async () => {
    const { svc } = makeSvc();
    await expect(svc.execute({ agendaDate: '2026-08-29', header: HEADER, context: makeContext(['REQUEST_CREATE']) }))
      .rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  });

  it('PERMISSION_DENIED when REQUEST_CREATE is missing', async () => {
    const { svc } = makeSvc();
    await expect(svc.execute({ agendaDate: '2026-08-29', header: HEADER, context: makeContext(['AGENDA_VIEW']) }))
      .rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  });

  it('PERMISSION_DENIED — source port NOT called before authorization check', async () => {
    const { svc, readPort } = makeSvc();
    await svc.execute({ agendaDate: '2026-08-29', header: HEADER, context: makeContext([]) }).catch(() => undefined);
    expect((readPort.findPreparedAgenda as Mock)).not.toHaveBeenCalled();
  });

  // ── AGENDA_NOT_FOUND ───────────────────────────────────────────────────────

  it('AGENDA_NOT_FOUND when agenda does not exist', async () => {
    const { svc } = makeSvc({ readPort: makeReadPort(null) });
    await expect(svc.execute({ agendaDate: '2026-08-29', header: HEADER, context: makeContext() }))
      .rejects.toMatchObject({ code: 'AGENDA_NOT_FOUND' });
  });

  // ── SOURCE_VERSION_STALE ───────────────────────────────────────────────────

  it('SOURCE_VERSION_STALE when agenda was reconciled during generation', async () => {
    const { svc } = makeSvc({ readPort: makeReadPort(makeProjection([makeItem()]), false) });
    await expect(svc.execute({ agendaDate: '2026-08-29', header: HEADER, context: makeContext() }))
      .rejects.toMatchObject({ code: 'SOURCE_VERSION_STALE' });
  });

  it('stale source — target port NOT called', async () => {
    const { svc, valePort } = makeSvc({ readPort: makeReadPort(makeProjection([makeItem()]), false) });
    await svc.execute({ agendaDate: '2026-08-29', header: HEADER, context: makeContext() }).catch(() => undefined);
    expect((valePort.generateBatch as Mock)).not.toHaveBeenCalled();
  });

  // ── 0 eligible items ───────────────────────────────────────────────────────

  it('0 items: returns empty arrays without calling target', async () => {
    const { svc, valePort } = makeSvc({ readPort: makeReadPort(makeProjection([])) });
    const result = await svc.execute({ agendaDate: '2026-08-29', header: HEADER, context: makeContext() });
    expect(result.generatedVales).toHaveLength(0);
    expect(result.conflicts).toHaveLength(0);
    expect(result.unresolvedItems).toHaveLength(0);
    expect((valePort.generateBatch as Mock)).not.toHaveBeenCalled();
  });

  // ── 1 group / 1 item ──────────────────────────────────────────────────────

  it('1 group 1 item: generates one Vale and returns it', async () => {
    const { svc } = makeSvc();
    const result = await svc.execute({ agendaDate: '2026-08-29', header: HEADER, context: makeContext() });
    expect(result.generatedVales).toHaveLength(1);
    expect(result.generatedVales[0]!.outcome).toBe('GENERATED');
    expect(result.conflicts).toHaveLength(0);
    expect(result.unresolvedItems).toHaveLength(0);
  });

  it('1 group 1 item: target receives correct group key', async () => {
    const { svc, valePort } = makeSvc();
    await svc.execute({ agendaDate: '2026-08-29', header: HEADER, context: makeContext() });
    const cmd = (valePort.generateBatch as Mock).mock.calls[0]![0];
    expect(cmd.groups).toHaveLength(1);
    expect(cmd.groups[0].key).toEqual({ agendaDate: '2026-08-29', servicioCodigo: 'CARD', medicoNumeroEmpleado: '000123' });
  });

  // ── N groups ──────────────────────────────────────────────────────────────

  it('N groups: each distinct (servicio,medico) pair produces a separate group', async () => {
    const items = [
      makeItem({ folio: 'F1', expedienteReference: 'E1', servicio: { codigo: 'CARD', nombre: 'CARDIOLOGÍA' }, medico: { numeroEmpleado: 'EMP1', nombre: 'DR A' } }),
      makeItem({ folio: 'F2', expedienteReference: 'E2', servicio: { codigo: 'CIR', nombre: 'CIRUGÍA' },     medico: { numeroEmpleado: 'EMP2', nombre: 'DR B' } }),
      makeItem({ folio: 'F3', expedienteReference: 'E3', servicio: { codigo: 'CARD', nombre: 'CARDIOLOGÍA' }, medico: { numeroEmpleado: 'EMP1', nombre: 'DR A' } }),
    ];
    const valePort = makeValePort({ generatedVales: [
      { valeId: 'v1', numeroVale: 'VA-1', group: { agendaDate: '2026-08-29', servicioCodigo: 'CARD', medicoNumeroEmpleado: 'EMP1' }, outcome: 'GENERATED' },
      { valeId: 'v2', numeroVale: 'VA-2', group: { agendaDate: '2026-08-29', servicioCodigo: 'CIR',  medicoNumeroEmpleado: 'EMP2' }, outcome: 'GENERATED' },
    ]});
    const { svc } = makeSvc({ readPort: makeReadPort(makeProjection(items)), valePort });
    const result = await svc.execute({ agendaDate: '2026-08-29', header: HEADER, context: makeContext() });
    const cmd = (valePort.generateBatch as Mock).mock.calls[0]![0];
    expect(cmd.groups).toHaveLength(2);
    expect(result.generatedVales).toHaveLength(2);
  });

  // ── Same-group deduplication ───────────────────────────────────────────────

  it('same-group dedup: two folios with same expedienteReference → one PhysicalDemand with two references', async () => {
    const items = [
      makeItem({ folio: 'F-DUP-1', expedienteReference: 'EXP-DUP' }),
      makeItem({ folio: 'F-DUP-2', expedienteReference: 'EXP-DUP' }), // same expediente, same group
    ];
    const { svc, valePort } = makeSvc({ readPort: makeReadPort(makeProjection(items)) });
    await svc.execute({ agendaDate: '2026-08-29', header: HEADER, context: makeContext() });
    const cmd = (valePort.generateBatch as Mock).mock.calls[0]![0];
    expect(cmd.groups).toHaveLength(1);
    const group = cmd.groups[0];
    expect(group.items).toHaveLength(1); // one physical demand
    expect(group.items[0].references).toHaveLength(2); // two FOLIO references
    expect(group.items[0].references.map((r: { folio: string }) => r.folio).sort()).toEqual(['F-DUP-1', 'F-DUP-2']);
  });

  // ── Cross-group conflict ───────────────────────────────────────────────────

  it('cross-group conflict without resolution: demand excluded from all groups, reported in conflicts', async () => {
    const items = [
      makeItem({ folio: 'F-CONF-1', expedienteReference: 'EXP-CONF', servicio: { codigo: 'CARD', nombre: 'CARDIOLOGÍA' }, medico: { numeroEmpleado: 'EMP1', nombre: 'DR A' } }),
      makeItem({ folio: 'F-CONF-2', expedienteReference: 'EXP-CONF', servicio: { codigo: 'CIR',  nombre: 'CIRUGÍA' },     medico: { numeroEmpleado: 'EMP2', nombre: 'DR B' } }),
    ];
    const valePort = makeValePort({ generatedVales: [] });
    const { svc } = makeSvc({ readPort: makeReadPort(makeProjection(items)), valePort });
    const result = await svc.execute({ agendaDate: '2026-08-29', header: HEADER, context: makeContext() });
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]!.expedienteReference).toBe('EXP-CONF');
    expect(result.conflicts[0]!.candidateGroups).toHaveLength(2);
    // Groups sent to target should have NO items (conflict removed from all)
    const cmd = (valePort.generateBatch as Mock).mock.calls[0]?.[0];
    if (cmd) {
      // Every group's items should not contain EXP-CONF
      for (const g of cmd.groups) {
        for (const it of g.items) {
          expect(it.expedienteReference).not.toBe('EXP-CONF');
        }
      }
    }
  });

  it('cross-group conflict WITH resolution: demand goes only to ownerGroup', async () => {
    const ownerKey: ValeGroupKey = { agendaDate: '2026-08-29', servicioCodigo: 'CARD', medicoNumeroEmpleado: 'EMP1' };
    const items = [
      makeItem({ folio: 'F-RES-1', expedienteReference: 'EXP-RES', servicio: { codigo: 'CARD', nombre: 'CARDIOLOGÍA' }, medico: { numeroEmpleado: 'EMP1', nombre: 'DR A' } }),
      makeItem({ folio: 'F-RES-2', expedienteReference: 'EXP-RES', servicio: { codigo: 'CIR',  nombre: 'CIRUGÍA' },     medico: { numeroEmpleado: 'EMP2', nombre: 'DR B' } }),
    ];
    const { svc, valePort } = makeSvc({ readPort: makeReadPort(makeProjection(items)) });
    const result = await svc.execute({
      agendaDate: '2026-08-29',
      header: HEADER,
      context: makeContext(),
      conflictResolutions: [{ expedienteReference: 'EXP-RES', ownerGroup: ownerKey }],
    });
    expect(result.conflicts).toHaveLength(0);
    const cmd = (valePort.generateBatch as Mock).mock.calls[0]![0];
    const cardGroup = cmd.groups.find((g: { key: ValeGroupKey }) => g.key.servicioCodigo === 'CARD');
    const cirGroup  = cmd.groups.find((g: { key: ValeGroupKey }) => g.key.servicioCodigo === 'CIR');
    // EXP-RES is in CARD (owner), not in CIR
    expect(cardGroup?.items.some((i: { expedienteReference: string }) => i.expedienteReference === 'EXP-RES')).toBe(true);
    if (cirGroup) {
      expect(cirGroup.items.some((i: { expedienteReference: string }) => i.expedienteReference === 'EXP-RES')).toBe(false);
    }
  });

  // ── Unresolved items ──────────────────────────────────────────────────────

  it('EXPEDIENT_NOT_RESOLVED: item with null expedienteReference appears in unresolvedItems', async () => {
    const items = [makeItem({ folio: 'F-NOEXP', expedienteReference: null })];
    const valePort = makeValePort({ generatedVales: [] });
    const { svc } = makeSvc({ readPort: makeReadPort(makeProjection(items)), valePort });
    const result = await svc.execute({ agendaDate: '2026-08-29', header: HEADER, context: makeContext() });
    expect(result.unresolvedItems).toHaveLength(1);
    expect(result.unresolvedItems[0]!.reason).toBe('EXPEDIENT_NOT_RESOLVED');
    expect(result.unresolvedItems[0]!.folio).toBe('F-NOEXP');
  });

  it('SERVICE_NOT_RESOLVED: item with null servicio.codigo appears in unresolvedItems', async () => {
    const items = [makeItem({ folio: 'F-NOSVC', servicio: { codigo: null, nombre: null } })];
    const valePort = makeValePort({ generatedVales: [] });
    const { svc } = makeSvc({ readPort: makeReadPort(makeProjection(items)), valePort });
    const result = await svc.execute({ agendaDate: '2026-08-29', header: HEADER, context: makeContext() });
    expect(result.unresolvedItems).toHaveLength(1);
    expect(result.unresolvedItems[0]!.reason).toBe('SERVICE_NOT_RESOLVED');
  });

  it('mixed: valid items generate Vale; unresolved items do not block valid groups', async () => {
    const items = [
      makeItem({ folio: 'F-VALID', expedienteReference: 'EXP-VALID' }),
      makeItem({ folio: 'F-NULL', expedienteReference: null }),
    ];
    const { svc } = makeSvc({ readPort: makeReadPort(makeProjection(items)) });
    const result = await svc.execute({ agendaDate: '2026-08-29', header: HEADER, context: makeContext() });
    expect(result.generatedVales).toHaveLength(1);
    expect(result.unresolvedItems).toHaveLength(1);
  });

  // ── Replay / ALREADY_GENERATED ────────────────────────────────────────────

  it('replay: target returns ALREADY_GENERATED, service propagates it without error', async () => {
    const valePort = makeValePort({
      generatedVales: [{
        valeId: 'vale-existing',
        numeroVale: 'VA-20260829-001',
        group: { agendaDate: '2026-08-29', servicioCodigo: 'CARD', medicoNumeroEmpleado: '000123' },
        outcome: 'ALREADY_GENERATED',
      }],
    });
    const { svc } = makeSvc({ valePort });
    const result = await svc.execute({ agendaDate: '2026-08-29', header: HEADER, context: makeContext() });
    expect(result.generatedVales[0]!.outcome).toBe('ALREADY_GENERATED');
    expect(result.generatedVales[0]!.valeId).toBe('vale-existing');
  });

  // ── Tenant propagation ────────────────────────────────────────────────────

  it('tenant propagation: source port receives context.tenant, not a derived value', async () => {
    const { svc, readPort } = makeSvc();
    await svc.execute({ agendaDate: '2026-08-29', header: HEADER, context: makeContext() });
    const [, tenantArg] = (readPort.findPreparedAgenda as Mock).mock.calls[0]! as [string, TenantContext];
    expect(tenantArg).toStrictEqual(TENANT);
  });

  it('tenant propagation: target port receives full RequestContext', async () => {
    const { svc, valePort } = makeSvc();
    const ctx = makeContext();
    await svc.execute({ agendaDate: '2026-08-29', header: HEADER, context: ctx });
    const [, ctxArg] = (valePort.generateBatch as Mock).mock.calls[0]! as [unknown, RequestContext];
    expect(ctxArg.tenant).toStrictEqual(TENANT);
    expect(ctxArg.actor.actorId).toBe('actor-t02');
  });

  // ── Deterministic group ordering (stable keys) ────────────────────────────

  it('groups sent to target are sorted deterministically (service ASC, medico ASC)', async () => {
    const items = [
      makeItem({ folio: 'F-Z', expedienteReference: 'E-Z', servicio: { codigo: 'ZZZ', nombre: 'ZZZ' }, medico: { numeroEmpleado: 'ZZZ', nombre: 'DR Z' } }),
      makeItem({ folio: 'F-A', expedienteReference: 'E-A', servicio: { codigo: 'AAA', nombre: 'AAA' }, medico: { numeroEmpleado: 'AAA', nombre: 'DR A' } }),
    ];
    const valePort = makeValePort({ generatedVales: [] });
    const { svc } = makeSvc({ readPort: makeReadPort(makeProjection(items)), valePort });
    await svc.execute({ agendaDate: '2026-08-29', header: HEADER, context: makeContext() });
    const cmd = (valePort.generateBatch as Mock).mock.calls[0]![0];
    expect(cmd.groups[0].key.servicioCodigo).toBe('AAA');
    expect(cmd.groups[1].key.servicioCodigo).toBe('ZZZ');
  });

  // ── No partial batches ────────────────────────────────────────────────────

  it('no partial batches: all-or-nothing is target responsibility; service sends complete batch', async () => {
    // Service always sends complete groups array to target — no partial sends
    const items = [
      makeItem({ folio: 'F1', expedienteReference: 'E1', servicio: { codigo: 'CARD', nombre: 'CARD' }, medico: { numeroEmpleado: 'EMP1', nombre: 'DR A' } }),
      makeItem({ folio: 'F2', expedienteReference: 'E2', servicio: { codigo: 'CIR',  nombre: 'CIR'  }, medico: { numeroEmpleado: 'EMP2', nombre: 'DR B' } }),
    ];
    const valePort = makeValePort({ generatedVales: [] });
    const { svc } = makeSvc({ readPort: makeReadPort(makeProjection(items)), valePort });
    await svc.execute({ agendaDate: '2026-08-29', header: HEADER, context: makeContext() });
    // generateBatch is called exactly once with all groups
    expect((valePort.generateBatch as Mock).mock.calls).toHaveLength(1);
    const cmd = (valePort.generateBatch as Mock).mock.calls[0]![0];
    expect(cmd.groups).toHaveLength(2);
  });
});
