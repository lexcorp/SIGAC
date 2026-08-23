import type { ImportacionAgenda, ImportacionAgendaRepository } from '@sigac/agenda-preparation';
import type { TenantContext } from '@sigac/tenant';
import type { TenantDatabaseRouter, TenantDatabaseSession } from '../TenantDatabaseRouter.js';
import { TenantSessionExecutor } from '../internal/TenantSessionExecutor.js';

export class PostgresImportacionAgendaRepository implements ImportacionAgendaRepository {
  private readonly executor: TenantSessionExecutor;

  constructor(router: TenantDatabaseRouter, session?: TenantDatabaseSession) {
    this.executor = new TenantSessionExecutor(router, session);
  }

  async save(importacion: ImportacionAgenda, tenant: TenantContext): Promise<void> {
    if (importacion.outcome === null || importacion.metrics === null) {
      throw new Error('ImportacionAgenda debe estar finalizada antes de persistir.');
    }
    const metrics = importacion.metrics;
    await this.executor.execute(tenant, async ({ client }) => {
      await client.query(
        `INSERT INTO agenda_imports (
          id, agenda_date, imported_at, outcome,
          received_records, processed, added, updated, unchanged, restored,
          pending_review, rejected, duplicate_folio, withdrawn_from_agenda,
          incidents, errors
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
        [
          importacion.id.value,
          importacion.agendaFecha.value,
          importacion.importedAt,
          importacion.outcome,
          metrics.receivedRecords,
          metrics.processed,
          metrics.added,
          metrics.updated,
          metrics.unchanged,
          metrics.restored,
          metrics.pendingReview,
          metrics.rejected,
          metrics.duplicateFolio,
          metrics.withdrawnFromAgenda,
          metrics.incidents,
          metrics.errors,
        ],
      );

      for (const registro of importacion.registros) {
        const iv = registro.interpretedValues;
        const ov = registro.originalValues;
        const rr = registro.resolvedReferences;
        await client.query(
          `INSERT INTO agenda_registros (
            id, importacion_id, source_position, processing_result,
            orig_folio, orig_patient_name, orig_expediente_reference,
            orig_beneficiary_type, orig_first_time_marker, orig_subsequent_marker,
            orig_agenda_date, orig_appointment_time,
            orig_physician_employee_number, orig_physician_name,
            orig_service_code, orig_service_name,
            interp_folio, interp_agenda_date, interp_beneficiary_type,
            interp_appointment_kind, interp_appointment_time,
            interp_numero_empleado, interp_servicio_codigo, interp_servicio_nombre,
            resolved_expediente_id, resolved_physician_reference
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
            $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
            $21,$22,$23,$24,$25,$26
          )`,
          [
            registro.id.value,
            importacion.id.value,
            registro.sourcePosition.value,
            registro.processingResult,
            ov.folio, ov.patientName, ov.expedienteReference,
            ov.beneficiaryType, ov.firstTimeMarker, ov.subsequentMarker,
            ov.agendaDate, ov.appointmentTime,
            ov.physicianEmployeeNumber, ov.physicianName,
            ov.serviceCode, ov.serviceName,
            iv.folio?.value ?? null,
            iv.agendaFecha?.value ?? null,
            iv.beneficiaryType,
            iv.appointmentKind,
            iv.appointmentTime,
            iv.numeroEmpleado?.value ?? null,
            iv.servicioEspecialidad?.codigo ?? null,
            iv.servicioEspecialidad?.nombre ?? null,
            rr.expedienteId,
            rr.physicianReference,
          ],
        );
      }

      for (const incidencia of importacion.incidencias) {
        await client.query(
          `INSERT INTO agenda_incidencias (id, importacion_id, registro_id, source_position, incident_type)
           VALUES ($1,$2,$3,$4,$5)`,
          [
            incidencia.id.value,
            importacion.id.value,
            incidencia.registroId.value,
            incidencia.sourcePosition.value,
            incidencia.type,
          ],
        );
      }
    });
  }
}
