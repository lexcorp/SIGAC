import type { TenantContext } from '@sigac/tenant';
import type { Agenda } from '../../domain/aggregates/Agenda.js';
import type { ImportacionAgenda } from '../../domain/aggregates/ImportacionAgenda.js';
import type { AgendaFecha, ImportacionAgendaId } from '../../domain/value-objects/index.js';
import type { ImportFingerprint } from './AgendaFileInterpreterPort.js';

// PORT-AP-006 — Repository ports Domain

export interface ImportacionAgendaRepository {
  save(
    importacion: ImportacionAgenda,
    tenant: TenantContext,
  ): Promise<void>;
}

export interface AgendaRepository {
  findByFecha(
    fecha: AgendaFecha,
    tenant: TenantContext,
  ): Promise<Agenda | null>;

  save(
    agenda: Agenda,
    tenant: TenantContext,
  ): Promise<void>;
}

// PORT-AP-007 — Metadata técnica separada

export interface ImportEquivalentReference {
  readonly importacionId: ImportacionAgendaId;
  readonly importedAt: Date;
}

export interface ImportArtifactMetadataRepository {
  findEquivalent(
    input: {
      readonly agendaDate: AgendaFecha;
      readonly fingerprint: ImportFingerprint;
    },
    tenant: TenantContext,
  ): Promise<ImportEquivalentReference | null>;

  associateConfirmedImport(
    input: {
      readonly importacionId: ImportacionAgendaId;
      readonly agendaDate: AgendaFecha;
      readonly fingerprint: ImportFingerprint;
    },
    tenant: TenantContext,
  ): Promise<void>;
}
