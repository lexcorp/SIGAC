/**
 * RegistrarVale — use case VA-001
 *
 * Orquesta: validar permiso → construir Aggregate → persistir → auditar → retornar.
 *
 * Fuente: design.md §8.2, REQ-VA-001, INV-VA-001..INV-VA-002.
 *
 * Este use case:
 *   - NO contiene reglas de negocio: las delega al Aggregate ValeArchivo.
 *   - NO importa PDFKit, NestJS, Drizzle ni HTTP.
 *   - NO accede a Archive Operations ni a @sigac/agenda-preparation.
 */

import type { AuditWriter } from '@sigac/audit';
import type { RequestContext, TenantContext } from '@sigac/tenant';
import { ValeArchivo } from '../../domain/aggregates/ValeArchivo.js';
import { NumeroVale } from '../../domain/value-objects/NumeroVale.js';
import { parseSolicitanteReferencia } from '../../domain/value-objects/SolicitanteReferencia.js';
import type { ValeArchivoRepository } from '../ports/ValeArchivoRepository.js';
import { ApplicationError } from '../ApplicationError.js';

// ── Command ───────────────────────────────────────────────────────────────────

export interface RegistrarValeItemInput {
  readonly expedienteNumero: string;
  readonly pacienteNombre: string;
  readonly especialidad: string;
}

export interface RegistrarValeCommand {
  readonly numeroVale: string;
  readonly fechaSolicitud: string;       // YYYY-MM-DD
  readonly fechaRecepcion: string;       // YYYY-MM-DD
  readonly unidadSolicitante: string;
  readonly solicitanteNombre: string;
  readonly solicitanteCargo: string;
  readonly autorizadorNombre: string;
  readonly autorizadorCargo: string;
  readonly items: readonly RegistrarValeItemInput[];
  readonly context: RequestContext;
}

// ── Result ────────────────────────────────────────────────────────────────────

export interface RegistrarValeResult {
  readonly id: string;
  readonly numeroVale: string;
  readonly estado: 'RECIBIDA';
}

// ── Dependencies ──────────────────────────────────────────────────────────────

export interface RegistrarValeDeps {
  readonly repository: ValeArchivoRepository;
  readonly auditWriter: AuditWriter;
}

// ── Use Case ─────────────────────────────────────────────────────────────────

export class RegistrarVale {
  constructor(private readonly deps: RegistrarValeDeps) {}

  async execute(command: RegistrarValeCommand): Promise<RegistrarValeResult> {
    const { context } = command;

    // ── 1. Verificar permiso (ADR-0033) ────────────────────────────────────
    if (!context.actor.permissions.has('REQUEST_CREATE')) {
      await this.audit(null, 'denied', context);
      throw new ApplicationError(
        'PERMISSION_DENIED',
        'El actor no tiene el permiso REQUEST_CREATE.',
      );
    }

    // ── 2. Construir Value Objects — falla si inválidos (DomainError) ──────
    const numeroVale = NumeroVale.parse(command.numeroVale);
    const solicitante = parseSolicitanteReferencia(
      command.solicitanteNombre,
      command.solicitanteCargo,
    );
    const autorizador = parseSolicitanteReferencia(
      command.autorizadorNombre,
      command.autorizadorCargo,
    );

    // ── 3. Verificar unicidad de numero_vale dentro del tenant ────────────
    // Primera línea de defensa (la DB tiene UNIQUE como segunda línea).
    // No genera audit si el número ya existe — el vale nunca se crea.
    const yaExiste = await this.deps.repository.existsByNumeroVale(
      numeroVale.toString(),
      context.tenant,
    );
    if (yaExiste) {
      throw new ApplicationError(
        'VALE_NUMERO_DUPLICADO',
        `Ya existe un ValeArchivo con numero_vale "${numeroVale.toString()}" en este tenant.`,
      );
    }

    // ── 4. Crear el Aggregate — delega invariantes al domain ───────────────
    // ValeArchivo.create lanza ValeRequiereItemsError si items vacío (INV-VA-001)
    const now = new Date();
    const vale = ValeArchivo.create(
      {
        numeroVale,
        fechaSolicitud: new Date(command.fechaSolicitud),
        fechaRecepcion: new Date(command.fechaRecepcion),
        unidadSolicitante: command.unidadSolicitante,
        solicitante,
        autorizador,
        items: command.items,
        creadoPor: context.actor.actorId,
      },
      now,
    );

    // ── 5. Persistir (ADR-0034: tenant isolation via repository) ───────────
    await this.deps.repository.save(vale, context.tenant);

    // ── 6. Audit (INV-VA-006: toda operación genera audit entry) ───────────
    // changeSummary: sin PII de pacientes, solo contadores operativos
    await this.audit(vale.id.toString(), 'success', context, {
      itemCount: String(vale.items.length),
      unidadSolicitante: command.unidadSolicitante,
    });

    return {
      id: vale.id.toString(),
      numeroVale: vale.numeroVale.toString(),
      estado: 'RECIBIDA',
    };
  }

  private audit(
    resourceId: string | null,
    result: 'success' | 'denied',
    context: RequestContext,
    changeSummary?: Record<string, string>,
  ): Promise<void> {
    return this.deps.auditWriter.append(
      {
        action: 'VALE_CREADO',
        resourceType: 'VALE_ARCHIVO',
        resourceId: resourceId ?? 'UNKNOWN',
        result,
        changeSummary,
      },
      context,
    );
  }
}
