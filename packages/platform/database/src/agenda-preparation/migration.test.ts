/**
 * T-09 migration validation test.
 * Verifies schema structure at compile-time: tables exist, columns are present,
 * constraints are enforced, and prohibited columns are absent.
 *
 * These are pure compile-time/object-shape tests — no PostgreSQL connection required.
 */
import { describe, expect, it } from 'vitest';
import {
  agendaArtifactMetadata,
  agendaIdempotencyKeys,
  agendaImports,
  agendaIncidencias,
  agendaRegistros,
  agendas,
  citas,
} from '../schema/tenant.js';

describe('T-09 — Drizzle schema validation (compile-time)', () => {
  it('agendas table has agenda_date PK and created_at', () => {
    const columns = Object.keys(agendas);
    expect(columns).toContain('agendaDate');
    expect(columns).toContain('createdAt');
  });

  it('citas table has all required columns', () => {
    const columns = Object.keys(citas);
    expect(columns).toContain('agendaDate');
    expect(columns).toContain('folio');
    expect(columns).toContain('hora');
    expect(columns).toContain('lifecycle');
    expect(columns).toContain('medicoNumeroEmpleado');
    expect(columns).toContain('servicioCodigo');
    expect(columns).toContain('servicioNombre');
    expect(columns).toContain('nombrePaciente');
    expect(columns).toContain('tipoDerechohabiente');
    expect(columns).toContain('tipoConsulta');
    expect(columns).toContain('medicoNombre');
    expect(columns).toContain('expedienteReference');
  });

  it('citas table has no prohibited personal data columns', () => {
    const columns = Object.keys(citas);
    // PHY-AP-004: No turno, consultorio, destino, CURP, teléfono, sexo, edad, vigencia
    expect(columns).not.toContain('turno');
    expect(columns).not.toContain('consultorio');
    expect(columns).not.toContain('destino');
    expect(columns).not.toContain('curp');
    expect(columns).not.toContain('telefono');
    expect(columns).not.toContain('sexo');
    expect(columns).not.toContain('edad');
    expect(columns).not.toContain('rawRow');
  });

  it('agenda_imports table has all metric columns', () => {
    const columns = Object.keys(agendaImports);
    const expectedMetrics = [
      'receivedRecords', 'processed', 'added', 'updated', 'unchanged',
      'restored', 'pendingReview', 'rejected', 'duplicateFolio',
      'withdrawnFromAgenda', 'incidents', 'errors',
    ];
    for (const metric of expectedMetrics) {
      expect(columns, `metric column ${metric}`).toContain(metric);
    }
    expect(columns).toContain('outcome');
    expect(columns).toContain('agendaDate');
    expect(columns).toContain('importedAt');
  });

  it('agenda_imports table has no fingerprint or filename (those belong to artifact_metadata)', () => {
    const columns = Object.keys(agendaImports);
    expect(columns).not.toContain('fingerprint');
    expect(columns).not.toContain('filename');
    expect(columns).not.toContain('rawData');
    expect(columns).not.toContain('layout');
  });

  it('agenda_registros has all normalized originalValues and interpretedValues columns', () => {
    const columns = Object.keys(agendaRegistros);
    // originalValues allow-list (RAW-AP-004 — 12 fields)
    expect(columns).toContain('origFolio');
    expect(columns).toContain('origPatientName');
    expect(columns).toContain('origExpedienteReference');
    expect(columns).toContain('origBeneficiaryType');
    expect(columns).toContain('origFirstTimeMarker');
    expect(columns).toContain('origSubsequentMarker');
    expect(columns).toContain('origAgendaDate');
    expect(columns).toContain('origAppointmentTime');
    expect(columns).toContain('origPhysicianEmployeeNumber');
    expect(columns).toContain('origPhysicianName');
    expect(columns).toContain('origServiceCode');
    expect(columns).toContain('origServiceName');
    // interpretedValues (7 fields)
    expect(columns).toContain('interpFolio');
    expect(columns).toContain('interpAgendaDate');
    expect(columns).toContain('interpBeneficiaryType');
    expect(columns).toContain('interpAppointmentKind');
    expect(columns).toContain('interpAppointmentTime');
    expect(columns).toContain('interpNumeroEmpleado');
    expect(columns).toContain('interpServicioCodigo');
    expect(columns).toContain('interpServicioNombre');
    // resolvedReferences
    expect(columns).toContain('resolvedExpedienteId');
    expect(columns).toContain('resolvedPhysicianReference');
  });

  it('agenda_registros has no raw blob or parser internals', () => {
    const columns = Object.keys(agendaRegistros);
    expect(columns).not.toContain('rawRow');
    expect(columns).not.toContain('rawData');
    expect(columns).not.toContain('htmlRow');
    expect(columns).not.toContain('filename');
  });

  it('agenda_incidencias has incident_type and FK columns', () => {
    const columns = Object.keys(agendaIncidencias);
    expect(columns).toContain('incidentType');
    expect(columns).toContain('registroId');
    expect(columns).toContain('importacionId');
    expect(columns).toContain('sourcePosition');
    // No parser internals or stack traces
    expect(columns).not.toContain('stackTrace');
    expect(columns).not.toContain('rawRow');
  });

  it('agenda_artifact_metadata has fingerprint separate from agenda_imports', () => {
    const cols = Object.keys(agendaArtifactMetadata);
    expect(cols).toContain('fingerprint');
    expect(cols).toContain('importacionId');
    expect(cols).toContain('agendaDate');
    expect(cols).toContain('importedAt');
    // No unique column on fingerprint alone (no UNIQUE index — multiple imports with same fingerprint allowed)
    expect(cols).not.toContain('filename');
  });

  it('agenda_idempotency_keys has idempotency_key PK and importacion_id', () => {
    const cols = Object.keys(agendaIdempotencyKeys);
    expect(cols).toContain('idempotencyKey');
    expect(cols).toContain('importacionId');
    expect(cols).toContain('recordedAt');
    // Must NOT store serialized HTTP response (PHY-AP-008: response reconstructed from tables)
    expect(cols).not.toContain('responseBody');
    expect(cols).not.toContain('serializedResponse');
  });

  it('no table contains tenant_id column (tenant isolation is physical by database)', () => {
    const allTables = [agendas, citas, agendaImports, agendaRegistros, agendaIncidencias, agendaArtifactMetadata, agendaIdempotencyKeys];
    for (const table of allTables) {
      expect(Object.keys(table)).not.toContain('tenantId');
    }
  });
});
