import {
  Agenda,
  AgendaFecha,
  Cita,
  ExpedienteReferencia,
  FolioCita,
  HoraCita,
  MedicoReferencia,
  NumeroEmpleado,
  ServicioEspecialidad,
  type AgendaRepository,
  type CitaSnapshot,
} from '@sigac/agenda-preparation';
import type { TenantContext } from '@sigac/tenant';
import type { TenantDatabaseRouter, TenantDatabaseSession } from '../TenantDatabaseRouter.js';
import { TenantSessionExecutor } from '../internal/TenantSessionExecutor.js';

interface CitaRow {
  folio: string;
  hora: string;
  expediente_reference: string | null;
  nombre_paciente: string;
  tipo_derechohabiente: string;
  tipo_consulta: string;
  medico_numero_empleado: string;
  medico_nombre: string;
  servicio_codigo: string;
  servicio_nombre: string;
  lifecycle: string;
}

export class PostgresAgendaRepository implements AgendaRepository {
  private readonly executor: TenantSessionExecutor;

  constructor(router: TenantDatabaseRouter, session?: TenantDatabaseSession) {
    this.executor = new TenantSessionExecutor(router, session);
  }

  async findByFecha(fecha: AgendaFecha, tenant: TenantContext): Promise<Agenda | null> {
    return this.executor.execute(tenant, async ({ client }) => {
      const agendaResult = await client.query<{ agenda_date: string }>(
        `SELECT agenda_date FROM agendas WHERE agenda_date = $1`,
        [fecha.value],
      );
      if (agendaResult.rows.length === 0) return null;

      const citasResult = await client.query<CitaRow>(
        `SELECT folio, hora, expediente_reference, nombre_paciente,
                tipo_derechohabiente, tipo_consulta,
                medico_numero_empleado, medico_nombre,
                servicio_codigo, servicio_nombre, lifecycle
         FROM citas WHERE agenda_date = $1`,
        [fecha.value],
      );

      // Build all snapshots (we need to track stored lifecycle separately)
      const rows = citasResult.rows;
      const allSnapshots: (CitaSnapshot & { readonly storedLifecycle: string })[] = rows.map(
        (row) => ({
          folio: FolioCita.parse(row.folio),
          agendaFecha: fecha,
          hora: HoraCita.parse(row.hora),
          expedienteReference: row.expediente_reference
            ? ExpedienteReferencia.parse(row.expediente_reference)
            : null,
          nombrePaciente: row.nombre_paciente,
          tipoDerechohabiente: row.tipo_derechohabiente,
          tipoConsulta: row.tipo_consulta as 'FIRST_TIME' | 'SUBSEQUENT',
          medico: MedicoReferencia.create({
            numeroEmpleado: NumeroEmpleado.parse(row.medico_numero_empleado),
            nombre: row.medico_nombre,
          }),
          servicioEspecialidad: ServicioEspecialidad.create({
            codigo: row.servicio_codigo,
            nombre: row.servicio_nombre,
          }),
          storedLifecycle: row.lifecycle,
        }),
      );

      // Step 1: Create Agenda with all citas (all start as ACTIVA per Cita.create contract)
      const citasIniciales = allSnapshots.map((s) => Cita.create(s));
      const agenda = Agenda.create({ fecha, citasIniciales });

      // Step 2: If there are RETIRADA citas, apply reconcile with only ACTIVA snapshots
      // so the domain naturally withdraws the ones not present in the incoming set
      const hasRetiradas = allSnapshots.some((s) => s.storedLifecycle === 'RETIRADA_DE_AGENDA');
      if (hasRetiradas) {
        const activaSnapshots: CitaSnapshot[] = allSnapshots
          .filter((s) => s.storedLifecycle === 'ACTIVA')
          .map((s): CitaSnapshot => ({
            folio: s.folio,
            agendaFecha: s.agendaFecha,
            hora: s.hora,
            expedienteReference: s.expedienteReference,
            nombrePaciente: s.nombrePaciente,
            tipoDerechohabiente: s.tipoDerechohabiente,
            tipoConsulta: s.tipoConsulta,
            medico: s.medico,
            servicioEspecialidad: s.servicioEspecialidad,
          }));
        agenda.reconcile({ incoming: activaSnapshots });
      }

      return agenda;
    });
  }

  async save(agenda: Agenda, tenant: TenantContext): Promise<void> {
    await this.executor.execute(tenant, async ({ client }) => {
      // Upsert the agenda row (idempotent — only creates if not exists)
      await client.query(
        `INSERT INTO agendas (agenda_date) VALUES ($1)
         ON CONFLICT (agenda_date) DO NOTHING`,
        [agenda.fecha.value],
      );

      for (const cita of agenda.citas) {
        await client.query(
          `INSERT INTO citas (
            agenda_date, folio, hora, expediente_reference,
            nombre_paciente, tipo_derechohabiente, tipo_consulta,
            medico_numero_empleado, medico_nombre,
            servicio_codigo, servicio_nombre, lifecycle
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
          ON CONFLICT (agenda_date, folio) DO UPDATE SET
            hora = EXCLUDED.hora,
            expediente_reference = EXCLUDED.expediente_reference,
            nombre_paciente = EXCLUDED.nombre_paciente,
            tipo_derechohabiente = EXCLUDED.tipo_derechohabiente,
            tipo_consulta = EXCLUDED.tipo_consulta,
            medico_numero_empleado = EXCLUDED.medico_numero_empleado,
            medico_nombre = EXCLUDED.medico_nombre,
            servicio_codigo = EXCLUDED.servicio_codigo,
            servicio_nombre = EXCLUDED.servicio_nombre,
            lifecycle = EXCLUDED.lifecycle`,
          [
            cita.agendaFecha.value,
            cita.folio.value,
            cita.hora.value,
            cita.expedienteReference?.value ?? null,
            cita.nombrePaciente,
            cita.tipoDerechohabiente,
            cita.tipoConsulta,
            cita.medico.numeroEmpleado.value,
            cita.medico.nombre,
            cita.servicioEspecialidad.codigo,
            cita.servicioEspecialidad.nombre,
            cita.lifecycle,
          ],
        );
      }
    });
  }
}
