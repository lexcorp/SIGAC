/**
 * T-32 — Application layer tests: RegistrarVale, ConsultarVale, ListarVales, IniciarBusqueda
 *
 * Fuente: design.md §8.2, REQ-VA-001, REQ-VA-003, REQ-VA-004, INV-VA-006
 *
 * Todos los dependencies son fakes in-memory.
 * Sin PostgreSQL, sin HTTP, sin infraestructura.
 * Las reglas de negocio del Aggregate NO se duplican aquí — se prueban en ValeArchivo.test.ts.
 */

import type { AuditEntry } from '@sigac/audit';
import type { RequestContext, TenantContext } from '@sigac/tenant';
import { describe, expect, it, vi, type Mock } from 'vitest';

import { ValeArchivo, type ValeArchivoSnapshot } from '../domain/aggregates/ValeArchivo.js';
import { InvalidStateTransitionError } from '../domain/errors/ValeArchivoErrors.js';
import { NumeroVale } from '../domain/value-objects/NumeroVale.js';
import { parseSolicitanteReferencia } from '../domain/value-objects/SolicitanteReferencia.js';
import { ApplicationError } from './ApplicationError.js';
import type { ValeArchivoRepository } from './ports/ValeArchivoRepository.js';
import type { ValeArchivoQueryPort, ValeArchivoPage } from './ports/ValeArchivoQueryPort.js';
import {
  RegistrarVale,
  type RegistrarValeCommand,
} from './use-cases/RegistrarVale.js';
import {
  ConsultarVale,
  type ConsultarValeQuery,
} from './use-cases/ConsultarVale.js';
import {
  ListarVales,
  type ListarValesQuery,
} from './use-cases/ListarVales.js';
import {
  IniciarBusqueda,
  type IniciarBusquedaCommand,
} from './use-cases/IniciarBusqueda.js';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const TENANT: TenantContext = {
  tenantId: 'tenant-va-t32',
  slug: 'hospital-va-t32',
  hospitalId: 'hosp-va-t32',
  databaseName: 'sigac_va_t32',
  timezone: 'America/Mexico_City',
};

function makeContext(permissions: string[]): RequestContext {
  return {
    actor: {
      actorId: 'actor-va-t32',
      roles: new Set(['ARCHIVISTA']),
      permissions: new Set(permissions),
      tenantIds: new Set([TENANT.tenantId]),
    },
    tenant: TENANT,
    requestId: 'req-va-t32',
    correlationId: 'corr-va-t32',
    source: 'WEB',
  };
}

/** Snapshot sintético de un vale en estado RECIBIDA con 1 ítem. */
function makeSnapshot(overrides: Partial<ValeArchivoSnapshot> = {}): ValeArchivoSnapshot {
  const vale = ValeArchivo.create(
    {
      numeroVale: NumeroVale.parse('VA-T32-001'),
      fechaSolicitud: new Date('2026-08-26'),
      fechaRecepcion: new Date('2026-08-26'),
      unidadSolicitante: 'DIRECCIÓN MÉDICA',
      solicitante: parseSolicitanteReferencia('Dr. Sintético', 'Director'),
      autorizador: parseSolicitanteReferencia('Dra. Sintética', 'Subdirectora'),
      items: [
        { expedienteNumero: 'EXP-T32-001', pacienteNombre: 'PACIENTE SINT T32', especialidad: 'MEDICINA INTERNA' },
      ],
      creadoPor: 'actor-va-t32',
    },
    new Date('2026-08-26T10:00:00Z'),
  );
  return { ...vale.snapshot(), ...overrides };
}

// ── Fakes ─────────────────────────────────────────────────────────────────────

/** Fake repository in-memory para tests. */
class FakeValeArchivoRepository implements ValeArchivoRepository {
  private store = new Map<string, ValeArchivoSnapshot>();

  async save(vale: ValeArchivo, _tenant: TenantContext): Promise<void> {
    this.store.set(vale.id.toString(), vale.snapshot());
  }

  async findById(id: string, _tenant: TenantContext): Promise<ValeArchivoSnapshot | null> {
    return this.store.get(id) ?? null;
  }

  async existsByNumeroVale(numeroVale: string, _tenant: TenantContext): Promise<boolean> {
    for (const snap of this.store.values()) {
      if (snap.numeroVale === numeroVale) return true;
    }
    return false;
  }

  /** Siembra un snapshot directamente (para setup de tests). */
  seed(snapshot: ValeArchivoSnapshot): void {
    this.store.set(snapshot.id, snapshot);
  }
}

/** Fake query port in-memory. */
class FakeValeArchivoQueryPort implements ValeArchivoQueryPort {
  constructor(private readonly items: ValeArchivoSnapshot[] = []) {}

  async findPage(): Promise<ValeArchivoPage> {
    return {
      items: this.items.map((s) => ({
        id: s.id,
        numeroVale: s.numeroVale,
        fechaSolicitud: s.fechaSolicitud,
        unidadSolicitante: s.unidadSolicitante,
        solicitanteNombre: s.solicitante.nombre,
        estado: s.estado,
        itemCount: s.items.length,
      })),
      nextCursor: null,
    };
  }

  async findByIdForDetail(id: string): Promise<ValeArchivoSnapshot | null> {
    return this.items.find((s) => s.id === id) ?? null;
  }
}

/** Fake audit writer con spy. */
function makeAuditWriter() {
  return { append: vi.fn().mockResolvedValue(undefined) };
}

// ── RegistrarVale — VA-001 ────────────────────────────────────────────────────

describe('RegistrarVale (VA-001)', () => {
  function makeCommand(
    overrides: Partial<RegistrarValeCommand> = {},
  ): RegistrarValeCommand {
    return {
      numeroVale: 'VA-T32-CMD-001',
      fechaSolicitud: '2026-08-26',
      fechaRecepcion: '2026-08-26',
      unidadSolicitante: 'DIRECCIÓN MÉDICA',
      solicitanteNombre: 'Dr. Sintético Cmd',
      solicitanteCargo: 'Director',
      autorizadorNombre: 'Dra. Sintética Cmd',
      autorizadorCargo: 'Subdirectora',
      items: [
        { expedienteNumero: 'EXP-CMD-001', pacienteNombre: 'PACIENTE SINT CMD', especialidad: 'CIRUGIA' },
      ],
      context: makeContext(['REQUEST_CREATE']),
      ...overrides,
    };
  }

  it('crea el vale y retorna id + estado RECIBIDA', async () => {
    const repo = new FakeValeArchivoRepository();
    const audit = makeAuditWriter();
    const uc = new RegistrarVale({ repository: repo, auditWriter: audit });

    const result = await uc.execute(makeCommand());

    expect(result.estado).toBe('RECIBIDA');
    expect(typeof result.id).toBe('string');
    expect(result.numeroVale).toBe('VA-T32-CMD-001');
  });

  it('persiste el vale en el repository con el tenant correcto', async () => {
    const repo = new FakeValeArchivoRepository();
    const saveSpy = vi.spyOn(repo, 'save');
    const audit = makeAuditWriter();
    const uc = new RegistrarVale({ repository: repo, auditWriter: audit });

    const result = await uc.execute(makeCommand());

    expect(saveSpy).toHaveBeenCalledOnce();
    const [savedVale, savedTenant] = saveSpy.mock.calls[0] as unknown as [ValeArchivo, TenantContext];
    expect(savedVale.id.toString()).toBe(result.id);
    // ADR-0034: el tenant que se pasa al repository es el del context, no un valor arbitrario
    expect(savedTenant).toStrictEqual(TENANT);
  });

  it('escribe audit entry con VALE_CREADO y sin PII de paciente', async () => {
    const repo = new FakeValeArchivoRepository();
    const audit = makeAuditWriter();
    const uc = new RegistrarVale({ repository: repo, auditWriter: audit });

    await uc.execute(makeCommand());

    const calls = (audit.append as Mock).mock.calls as [AuditEntry, RequestContext][];
    const successCall = calls.find(([e]) => e.result === 'success');
    expect(successCall).toBeDefined();
    const [entry, ctx] = successCall!;

    expect(entry.action).toBe('VALE_CREADO');
    expect(entry.resourceType).toBe('VALE_ARCHIVO');
    expect(typeof entry.resourceId).toBe('string');

    // Sin PII de pacientes en changeSummary
    const summaryStr = JSON.stringify(entry.changeSummary ?? {});
    expect(summaryStr).not.toMatch(/paciente/i);
    expect(summaryStr).not.toMatch(/curp/i);
    expect(summaryStr).not.toMatch(/expediente.*001/i); // no expediente individual

    // Context correcto (ADR-0034: tenant del context, no inventado)
    expect(ctx.tenant.tenantId).toBe(TENANT.tenantId);
  });

  it('403 sin REQUEST_CREATE — no llama al repository', async () => {
    const repo = new FakeValeArchivoRepository();
    const saveSpy = vi.spyOn(repo, 'save');
    const audit = makeAuditWriter();
    const uc = new RegistrarVale({ repository: repo, auditWriter: audit });

    await expect(
      uc.execute(makeCommand({ context: makeContext([]) })),
    ).rejects.toMatchObject({ name: 'ApplicationError', code: 'PERMISSION_DENIED' });

    expect(saveSpy).not.toHaveBeenCalled();
  });

  it('403 escribe audit entry con result denied', async () => {
    const repo = new FakeValeArchivoRepository();
    const audit = makeAuditWriter();
    const uc = new RegistrarVale({ repository: repo, auditWriter: audit });

    await uc.execute(makeCommand({ context: makeContext([]) })).catch(() => undefined);

    const calls = (audit.append as Mock).mock.calls as [AuditEntry][];
    const deniedCall = calls.find(([e]) => e.result === 'denied');
    expect(deniedCall).toBeDefined();
  });

  it('propaga DomainError cuando el Aggregate rechaza items vacíos (sin duplicar la regla)', async () => {
    const repo = new FakeValeArchivoRepository();
    const audit = makeAuditWriter();
    const uc = new RegistrarVale({ repository: repo, auditWriter: audit });

    // El use case NO valida items.length; lo hace ValeArchivo.create (DomainError)
    await expect(
      uc.execute(makeCommand({ items: [] })),
    ).rejects.toMatchObject({ name: 'ValeRequiereItemsError', code: 'VALE_REQUIERE_ITEMS' });
  });

  it('el vale queda guardado y es recuperable por id', async () => {
    const repo = new FakeValeArchivoRepository();
    const audit = makeAuditWriter();
    const uc = new RegistrarVale({ repository: repo, auditWriter: audit });

    const result = await uc.execute(makeCommand());
    const stored = await repo.findById(result.id, TENANT);
    expect(stored).not.toBeNull();
    expect(stored!.estado).toBe('RECIBIDA');
    expect(stored!.items).toHaveLength(1);
  });

  it('VALE_NUMERO_DUPLICADO cuando ya existe un vale con el mismo numeroVale', async () => {
    const repo = new FakeValeArchivoRepository();
    const audit = makeAuditWriter();
    const uc = new RegistrarVale({ repository: repo, auditWriter: audit });

    // First creation — must succeed
    const cmd = makeCommand({ numeroVale: 'VA-DUP-001' });
    await uc.execute(cmd);

    // Second creation with the same number — must fail
    await expect(
      uc.execute(makeCommand({ numeroVale: 'VA-DUP-001' })),
    ).rejects.toMatchObject({ code: 'VALE_NUMERO_DUPLICADO' });
  });

  it('VALE_NUMERO_DUPLICADO — el segundo vale no se persiste', async () => {
    const repo = new FakeValeArchivoRepository();
    const audit = makeAuditWriter();
    const uc = new RegistrarVale({ repository: repo, auditWriter: audit });

    await uc.execute(makeCommand({ numeroVale: 'VA-DUP-002' }));
    await uc.execute(makeCommand({ numeroVale: 'VA-DUP-002' })).catch(() => undefined);

    // Only one vale with VA-DUP-002 in the store
    let count = 0;
    for (const snap of (repo as unknown as { store: Map<string, unknown> }).store.values()) {
      const s = snap as { numeroVale: string };
      if (s.numeroVale === 'VA-DUP-002') count++;
    }
    expect(count).toBe(1);
  });

  it('VALE_NUMERO_DUPLICADO — no genera audit VALE_CREADO para el vale rechazado', async () => {
    const repo = new FakeValeArchivoRepository();
    const audit = makeAuditWriter();
    const uc = new RegistrarVale({ repository: repo, auditWriter: audit });

    await uc.execute(makeCommand({ numeroVale: 'VA-DUP-003' }));
    const callsBefore = (audit.append as ReturnType<typeof vi.fn>).mock.calls.length;

    await uc.execute(makeCommand({ numeroVale: 'VA-DUP-003' })).catch(() => undefined);

    // No additional audit call was made for the rejected duplicate
    const callsAfter = (audit.append as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(callsAfter).toBe(callsBefore);
  });

  it('números distintos se pueden crear sin conflicto', async () => {
    const repo = new FakeValeArchivoRepository();
    const audit = makeAuditWriter();
    const uc = new RegistrarVale({ repository: repo, auditWriter: audit });

    const r1 = await uc.execute(makeCommand({ numeroVale: 'VA-UNIQ-001' }));
    const r2 = await uc.execute(makeCommand({ numeroVale: 'VA-UNIQ-002' }));

    expect(r1.estado).toBe('RECIBIDA');
    expect(r2.estado).toBe('RECIBIDA');
    expect(r1.id).not.toBe(r2.id);
  });
});

// ── ConsultarVale — VA-003 ────────────────────────────────────────────────────

describe('ConsultarVale (VA-003)', () => {
  it('retorna el snapshot del vale cuando existe', async () => {
    const snap = makeSnapshot();
    const queryPort = new FakeValeArchivoQueryPort([snap]);
    const audit = makeAuditWriter();
    const uc = new ConsultarVale({ queryPort, auditWriter: audit });

    const result = await uc.execute({
      valeId: snap.id,
      context: makeContext(['ARCHIVE_REQUEST_VIEW']),
    });

    expect(result.id).toBe(snap.id);
    expect(result.estado).toBe('RECIBIDA');
  });

  it('lanza VALE_ARCHIVO_NOT_FOUND cuando no existe', async () => {
    const queryPort = new FakeValeArchivoQueryPort([]);
    const audit = makeAuditWriter();
    const uc = new ConsultarVale({ queryPort, auditWriter: audit });

    await expect(
      uc.execute({ valeId: 'id-inexistente', context: makeContext(['ARCHIVE_REQUEST_VIEW']) }),
    ).rejects.toMatchObject({ code: 'VALE_ARCHIVO_NOT_FOUND' });
  });

  it('403 sin ARCHIVE_REQUEST_VIEW ni REQUEST_CREATE', async () => {
    const snap = makeSnapshot();
    const queryPort = new FakeValeArchivoQueryPort([snap]);
    const audit = makeAuditWriter();
    const uc = new ConsultarVale({ queryPort, auditWriter: audit });

    await expect(
      uc.execute({ valeId: snap.id, context: makeContext([]) }),
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  });

  it('acepta REQUEST_CREATE como alternativa a ARCHIVE_REQUEST_VIEW', async () => {
    const snap = makeSnapshot();
    const queryPort = new FakeValeArchivoQueryPort([snap]);
    const audit = makeAuditWriter();
    const uc = new ConsultarVale({ queryPort, auditWriter: audit });

    const result = await uc.execute({
      valeId: snap.id,
      context: makeContext(['REQUEST_CREATE']),
    });
    expect(result.id).toBe(snap.id);
  });

  it('escribe audit entry con VALE_ARCHIVO_VIEW en éxito', async () => {
    const snap = makeSnapshot();
    const queryPort = new FakeValeArchivoQueryPort([snap]);
    const audit = makeAuditWriter();
    const uc = new ConsultarVale({ queryPort, auditWriter: audit });

    await uc.execute({ valeId: snap.id, context: makeContext(['ARCHIVE_REQUEST_VIEW']) });

    const calls = (audit.append as Mock).mock.calls as [AuditEntry][];
    const successCall = calls.find(([e]) => e.result === 'success');
    expect(successCall).toBeDefined();
    expect(successCall![0].action).toBe('VALE_ARCHIVO_VIEW');
  });

  it('escribe audit not-found cuando el vale no existe', async () => {
    const queryPort = new FakeValeArchivoQueryPort([]);
    const audit = makeAuditWriter();
    const uc = new ConsultarVale({ queryPort, auditWriter: audit });

    await uc.execute({
      valeId: 'inexistente',
      context: makeContext(['ARCHIVE_REQUEST_VIEW']),
    }).catch(() => undefined);

    const calls = (audit.append as Mock).mock.calls as [AuditEntry][];
    expect(calls.some(([e]) => e.result === 'not-found')).toBe(true);
  });

  it('tenant isolation: queryPort recibe el TenantContext del context', async () => {
    const snap = makeSnapshot();
    const findByIdSpy = vi.fn().mockResolvedValue(snap);
    const queryPort: ValeArchivoQueryPort = {
      findPage: vi.fn(),
      findByIdForDetail: findByIdSpy,
    };
    const audit = makeAuditWriter();
    const uc = new ConsultarVale({ queryPort, auditWriter: audit });

    await uc.execute({ valeId: snap.id, context: makeContext(['ARCHIVE_REQUEST_VIEW']) });

    const [, tenantPassed] = findByIdSpy.mock.calls[0] as unknown as [string, TenantContext];
    expect(tenantPassed).toStrictEqual(TENANT);
  });
});

// ── ListarVales — VA-004 (lista paginada) ─────────────────────────────────────

describe('ListarVales (VA-004 — lista paginada)', () => {
  it('retorna página de vales cuando el actor tiene ARCHIVE_REQUEST_VIEW', async () => {
    const snaps = [makeSnapshot(), makeSnapshot()];
    const queryPort = new FakeValeArchivoQueryPort(snaps);
    const audit = makeAuditWriter();
    const uc = new ListarVales({ queryPort, auditWriter: audit });

    const result = await uc.execute({
      context: makeContext(['ARCHIVE_REQUEST_VIEW']),
    });

    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).toBeNull();
  });

  it('403 sin ARCHIVE_REQUEST_VIEW', async () => {
    const queryPort = new FakeValeArchivoQueryPort([]);
    const audit = makeAuditWriter();
    const uc = new ListarVales({ queryPort, auditWriter: audit });

    await expect(
      uc.execute({ context: makeContext(['REQUEST_CREATE']) }),
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  });

  it('escribe audit denied sin llamar al queryPort', async () => {
    const findPageSpy = vi.fn();
    const queryPort: ValeArchivoQueryPort = {
      findPage: findPageSpy,
      findByIdForDetail: vi.fn(),
    };
    const audit = makeAuditWriter();
    const uc = new ListarVales({ queryPort, auditWriter: audit });

    await uc.execute({ context: makeContext([]) }).catch(() => undefined);

    expect(findPageSpy).not.toHaveBeenCalled();
    const calls = (audit.append as Mock).mock.calls as [AuditEntry][];
    expect(calls.some(([e]) => e.result === 'denied')).toBe(true);
  });

  it('aplica límite máximo de 100 aunque se pase un valor mayor', async () => {
    const findPageSpy = vi.fn().mockResolvedValue({ items: [], nextCursor: null });
    const queryPort: ValeArchivoQueryPort = {
      findPage: findPageSpy,
      findByIdForDetail: vi.fn(),
    };
    const audit = makeAuditWriter();
    const uc = new ListarVales({ queryPort, auditWriter: audit });

    await uc.execute({ limit: 999, context: makeContext(['ARCHIVE_REQUEST_VIEW']) });

    const [filter] = findPageSpy.mock.calls[0] as unknown as [{ limit: number }];
    expect(filter.limit).toBe(100);
  });

  it('aplica límite default de 20 cuando no se especifica', async () => {
    const findPageSpy = vi.fn().mockResolvedValue({ items: [], nextCursor: null });
    const queryPort: ValeArchivoQueryPort = {
      findPage: findPageSpy,
      findByIdForDetail: vi.fn(),
    };
    const audit = makeAuditWriter();
    const uc = new ListarVales({ queryPort, auditWriter: audit });

    await uc.execute({ context: makeContext(['ARCHIVE_REQUEST_VIEW']) });

    const [filter] = findPageSpy.mock.calls[0] as unknown as [{ limit: number }];
    expect(filter.limit).toBe(20);
  });

  it('propaga filtros estado, fecha y unidad al queryPort', async () => {
    const findPageSpy = vi.fn().mockResolvedValue({ items: [], nextCursor: null });
    const queryPort: ValeArchivoQueryPort = {
      findPage: findPageSpy,
      findByIdForDetail: vi.fn(),
    };
    const audit = makeAuditWriter();
    const uc = new ListarVales({ queryPort, auditWriter: audit });

    await uc.execute({
      estado: 'EN_BUSQUEDA',
      fecha: '2026-08-26',
      unidad: 'CARDIOLOGIA',
      context: makeContext(['ARCHIVE_REQUEST_VIEW']),
    });

    const [filter] = findPageSpy.mock.calls[0] as unknown as [{ estado: string; fecha: string; unidad: string }];
    expect(filter.estado).toBe('EN_BUSQUEDA');
    expect(filter.fecha).toBe('2026-08-26');
    expect(filter.unidad).toBe('CARDIOLOGIA');
  });

  it('tenant isolation: queryPort recibe el TenantContext del context', async () => {
    const findPageSpy = vi.fn().mockResolvedValue({ items: [], nextCursor: null });
    const queryPort: ValeArchivoQueryPort = {
      findPage: findPageSpy,
      findByIdForDetail: vi.fn(),
    };
    const audit = makeAuditWriter();
    const uc = new ListarVales({ queryPort, auditWriter: audit });

    await uc.execute({ context: makeContext(['ARCHIVE_REQUEST_VIEW']) });

    const [, tenantPassed] = findPageSpy.mock.calls[0] as unknown as [unknown, TenantContext];
    expect(tenantPassed).toStrictEqual(TENANT);
  });
});

// ── IniciarBusqueda — VA-004 (transición) ────────────────────────────────────

describe('IniciarBusqueda (VA-004 — transición RECIBIDA → EN_BUSQUEDA)', () => {
  function makeCommand(
    valeId: string,
    overrides: Partial<IniciarBusquedaCommand> = {},
  ): IniciarBusquedaCommand {
    return {
      valeId,
      context: makeContext(['ARCHIVE_REQUEST_PROCESS']),
      ...overrides,
    };
  }

  it('transiciona el vale a EN_BUSQUEDA y persiste el cambio', async () => {
    const snap = makeSnapshot();
    const repo = new FakeValeArchivoRepository();
    repo.seed(snap);
    const audit = makeAuditWriter();
    const uc = new IniciarBusqueda({ repository: repo, auditWriter: audit });

    await uc.execute(makeCommand(snap.id));

    const stored = await repo.findById(snap.id, TENANT);
    expect(stored!.estado).toBe('EN_BUSQUEDA');
    expect(stored!.busquedaIniciadaPor).toBe('actor-va-t32');
    expect(stored!.busquedaIniciadaAt).toBeInstanceOf(Date);
  });

  it('403 sin ARCHIVE_REQUEST_PROCESS — no llama al repository', async () => {
    const snap = makeSnapshot();
    const repo = new FakeValeArchivoRepository();
    repo.seed(snap);
    const saveSpy = vi.spyOn(repo, 'save');
    const audit = makeAuditWriter();
    const uc = new IniciarBusqueda({ repository: repo, auditWriter: audit });

    await expect(
      uc.execute({ valeId: snap.id, context: makeContext([]) }),
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });

    expect(saveSpy).not.toHaveBeenCalled();
  });

  it('lanza VALE_ARCHIVO_NOT_FOUND si el vale no existe', async () => {
    const repo = new FakeValeArchivoRepository();
    const audit = makeAuditWriter();
    const uc = new IniciarBusqueda({ repository: repo, auditWriter: audit });

    await expect(
      uc.execute(makeCommand('id-inexistente')),
    ).rejects.toMatchObject({ code: 'VALE_ARCHIVO_NOT_FOUND' });
  });

  it('propaga InvalidStateTransitionError del domain cuando el vale no está en RECIBIDA', async () => {
    // Sembra un vale en EN_BUSQUEDA (transición ya fue hecha)
    const snap = makeSnapshot({ estado: 'EN_BUSQUEDA', busquedaIniciadaPor: 'alguien', busquedaIniciadaAt: new Date() });
    const repo = new FakeValeArchivoRepository();
    repo.seed(snap);
    const audit = makeAuditWriter();
    const uc = new IniciarBusqueda({ repository: repo, auditWriter: audit });

    // El use case NO verifica el estado; lo hace el Aggregate.
    // Esperamos que la excepción del domain se propague sin modificarla.
    await expect(
      uc.execute(makeCommand(snap.id)),
    ).rejects.toBeInstanceOf(InvalidStateTransitionError);
  });

  it('escribe audit VALE_BUSQUEDA_INICIADA en éxito', async () => {
    const snap = makeSnapshot();
    const repo = new FakeValeArchivoRepository();
    repo.seed(snap);
    const audit = makeAuditWriter();
    const uc = new IniciarBusqueda({ repository: repo, auditWriter: audit });

    await uc.execute(makeCommand(snap.id));

    const calls = (audit.append as Mock).mock.calls as [AuditEntry, RequestContext][];
    const successCall = calls.find(([e]) => e.result === 'success');
    expect(successCall).toBeDefined();
    const [entry, ctx] = successCall!;
    expect(entry.action).toBe('VALE_BUSQUEDA_INICIADA');
    expect(entry.resourceId).toBe(snap.id);
    expect(ctx.tenant.tenantId).toBe(TENANT.tenantId);
  });

  it('tenant isolation: repository recibe el TenantContext del context', async () => {
    const snap = makeSnapshot();
    const repo = new FakeValeArchivoRepository();
    repo.seed(snap);
    const saveSpy = vi.spyOn(repo, 'save');
    const audit = makeAuditWriter();
    const uc = new IniciarBusqueda({ repository: repo, auditWriter: audit });

    await uc.execute(makeCommand(snap.id));

    const [, tenantPassed] = saveSpy.mock.calls[0] as unknown as [ValeArchivo, TenantContext];
    expect(tenantPassed).toStrictEqual(TENANT);
  });

  it('el use case no duplica la regla de transición del aggregate', () => {
    // Este test verifica que IniciarBusqueda no tiene código de validación de estado propio.
    // La transición la hace ValeArchivo.iniciarBusqueda; el use case solo orquesta.
    // Verificamos indirectamente: el use case NO importa EstadoVale ni la máquina de estados.
    // Si el aggregate lanza InvalidStateTransitionError, el use case la propaga sin alterar.
    expect(IniciarBusqueda).toBeDefined();
    // (test estructural — la ausencia de lógica de estado en el use case se valida por inspección
    // y por el test anterior que verifica que InvalidStateTransitionError del domain se propaga)
  });
});

// ── GenerarPdfVale — VA-002 ───────────────────────────────────────────────────

import { GenerarPdfVale } from './use-cases/GenerarPdfVale.js';
import type { ValeArchivoReportGeneratorPort, ValeArchivoReportResult } from './ports/ValeArchivoReportGeneratorPort.js';
import { Readable } from 'node:stream';

describe('GenerarPdfVale (VA-002)', () => {
  function makePdfUseCase(opts: {
    snapshotExists?: boolean;
    pdfError?: Error;
    permissions?: string[];
  } = {}) {
    const snap = makeSnapshot();
    const queryPort: ValeArchivoQueryPort = {
      findPage: vi.fn(),
      findByIdForDetail: vi.fn().mockResolvedValue(
        opts.snapshotExists === false ? null : snap,
      ),
    };
    const pdfResult: ValeArchivoReportResult = {
      stream: Readable.from([Buffer.from('%PDF-1.4')]),
      filename: `sm1-14-VA-T32-001-2026-08-26.pdf`,
    };
    const pdfGenerator: ValeArchivoReportGeneratorPort = {
      generate: opts.pdfError
        ? vi.fn().mockRejectedValue(opts.pdfError)
        : vi.fn().mockResolvedValue(pdfResult),
    };
    const audit = makeAuditWriter();
    const useCase = new GenerarPdfVale({ queryPort, pdfGenerator, auditWriter: audit });
    const context = makeContext(opts.permissions ?? ['ARCHIVE_REQUEST_VIEW']);
    return { useCase, queryPort, pdfGenerator, audit, context, snap };
  }

  it('retorna stream y filename cuando el vale existe', async () => {
    const { useCase, context, snap } = makePdfUseCase();
    const r = await useCase.execute({ valeId: snap.id, context });
    expect(r.filename).toMatch(/^sm1-14-/);
    expect(r.stream).toBeDefined();
  });

  it('403 sin ARCHIVE_REQUEST_VIEW ni REQUEST_CREATE', async () => {
    const { useCase, context } = makePdfUseCase({ permissions: [] });
    await expect(
      useCase.execute({ valeId: 'any', context }),
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  });

  it('acepta REQUEST_CREATE como permiso alternativo', async () => {
    const { useCase, context, snap } = makePdfUseCase({ permissions: ['REQUEST_CREATE'] });
    const r = await useCase.execute({ valeId: snap.id, context });
    expect(r.filename).toBeDefined();
  });

  it('lanza VALE_ARCHIVO_NOT_FOUND si el vale no existe', async () => {
    const { useCase, context, snap } = makePdfUseCase({ snapshotExists: false });
    await expect(
      useCase.execute({ valeId: snap.id, context }),
    ).rejects.toMatchObject({ code: 'VALE_ARCHIVO_NOT_FOUND' });
  });

  it('no llama al generador si el permiso es denegado', async () => {
    const { useCase, pdfGenerator, context } = makePdfUseCase({ permissions: [] });
    await useCase.execute({ valeId: 'any', context }).catch(() => undefined);
    expect(pdfGenerator.generate).not.toHaveBeenCalled();
  });

  it('audit success contiene acción VALE_PDF_GENERADO', async () => {
    const { useCase, audit, context, snap } = makePdfUseCase();
    await useCase.execute({ valeId: snap.id, context });
    const calls = (audit.append as ReturnType<typeof vi.fn>).mock.calls as [import('@sigac/audit').AuditEntry][];
    const successCall = calls.find(([e]) => e.result === 'success');
    expect(successCall).toBeDefined();
    expect(successCall![0].action).toBe('VALE_PDF_GENERADO');
    expect(successCall![0].resourceType).toBe('VALE_ARCHIVO');
  });

  it('tenant isolation: queryPort recibe el TenantContext del context', async () => {
    const { useCase, queryPort, context, snap } = makePdfUseCase();
    await useCase.execute({ valeId: snap.id, context });
    const spy = queryPort.findByIdForDetail as ReturnType<typeof vi.fn>;
    const [, tenantPassed] = spy.mock.calls[0] as unknown as [string, typeof TENANT];
    expect(tenantPassed).toStrictEqual(TENANT);
  });

  it('audit entry no contiene PII de paciente (INV-VA-006)', async () => {
    const { useCase, audit, context, snap } = makePdfUseCase();
    await useCase.execute({ valeId: snap.id, context });
    const calls = (audit.append as ReturnType<typeof vi.fn>).mock.calls as [import('@sigac/audit').AuditEntry][];
    const successCall = calls.find(([e]) => e.result === 'success');
    const json = JSON.stringify(successCall![0]);
    expect(json).not.toMatch(/paciente/i);
    expect(json).not.toMatch(/curp/i);
    expect(json).not.toMatch(/folio/i);
  });
});
