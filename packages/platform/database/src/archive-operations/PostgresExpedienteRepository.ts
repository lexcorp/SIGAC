import {
  ApplicationError,
  Custodia,
  Expediente,
  ExpedienteId,
  ExpedienteNumero,
  Ubicacion,
  type ExpedienteRepository,
} from '@sigac/archive-operations';
import type { TenantContext } from '@sigac/tenant';
import type { TenantDatabaseRouter, TenantDatabaseSession } from '../TenantDatabaseRouter.js';
import { TenantSessionExecutor } from '../internal/TenantSessionExecutor.js';

interface ExpedienteRow {
  id: string;
  expediente_numero: string;
  paciente_id_institucional: string;
  paciente_curp: string;
  paciente_nombre_operativo: string;
  paciente_numero_issste: string;
  estado_operativo: string;
  ubicacion_id: string | null;
  ubicacion_codigo: string | null;
  ubicacion_descripcion: string | null;
  custodio_tipo: string | null;
  custodio_ref: string | null;
  custodio_servicio: string | null;
  custodio_location: string | null;
  custodio_accepted_at: Date | null;
  row_version: string;
}

const SELECT_EXPEDIENTE = `SELECT
  e.id, e.expediente_numero,
  e.paciente_id_institucional, e.paciente_curp,
  e.paciente_nombre_operativo, e.paciente_numero_issste,
  e.estado_operativo,
  u.id AS ubicacion_id, u.codigo AS ubicacion_codigo, u.descripcion AS ubicacion_descripcion,
  e.custodio_tipo, e.custodio_ref, e.custodio_servicio,
  e.custodio_location, e.custodio_accepted_at, e.row_version
FROM expedientes e
LEFT JOIN ubicaciones u ON u.id = e.ubicacion_actual_id`;

export class PostgresExpedienteRepository implements ExpedienteRepository {
  private readonly executor: TenantSessionExecutor;

  constructor(router: TenantDatabaseRouter, session?: TenantDatabaseSession) {
    this.executor = new TenantSessionExecutor(router, session);
  }

  async findById(id: ExpedienteId, tenant: TenantContext): Promise<Expediente | null> {
    return this.executor.execute(tenant, async ({ client }) => {
      const result = await client.query<ExpedienteRow>(`${SELECT_EXPEDIENTE} WHERE e.id = $1`, [
        id.value,
      ]);
      return result.rows[0] ? this.toDomain(result.rows[0], tenant) : null;
    });
  }

  async findByNumero(
    numero: ExpedienteNumero,
    tenant: TenantContext,
  ): Promise<readonly Expediente[]> {
    return this.executor.execute(tenant, async ({ client }) => {
      const result = await client.query<ExpedienteRow>(
        `${SELECT_EXPEDIENTE} WHERE e.expediente_numero_normalizado = $1 ORDER BY e.id`,
        [numero.toNormalized()],
      );
      return result.rows.map((row) => this.toDomain(row, tenant));
    });
  }

  async save(expediente: Expediente, tenant: TenantContext): Promise<void> {
    const snapshot = expediente.snapshot();
    const previousRowVersion = snapshot.rowVersion - 1n;
    await this.executor.execute(tenant, async ({ client }) => {
      const result = await client.query(
        `UPDATE expedientes SET
          expediente_numero = $2, expediente_numero_normalizado = $3,
          paciente_id_institucional = $4, paciente_curp = $5,
          paciente_nombre_operativo = $6, paciente_numero_issste = $7,
          estado_operativo = $8, ubicacion_actual_id = $9,
          custodio_tipo = $10, custodio_ref = $11, custodio_servicio = $12,
          custodio_location = $13, custodio_accepted_at = $14,
          row_version = $15, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND row_version = $16`,
        [
          snapshot.id.value,
          snapshot.expedienteNumero.toDisplay(),
          snapshot.expedienteNumero.toNormalized(),
          snapshot.pacienteReferencia.idInstitucional,
          snapshot.pacienteReferencia.curp,
          snapshot.pacienteReferencia.nombreOperativo,
          snapshot.pacienteReferencia.numeroIssste,
          snapshot.estadoOperativo,
          snapshot.ubicacionActual?.id ?? null,
          snapshot.custodiaActual?.custodianType ?? null,
          snapshot.custodiaActual?.custodianReference ?? null,
          snapshot.custodiaActual?.service ?? null,
          snapshot.custodiaActual?.location ?? null,
          snapshot.custodiaActual?.acceptedAt ?? null,
          snapshot.rowVersion.toString(),
          previousRowVersion.toString(),
        ],
      );
      if (result.rowCount !== 1) {
        throw new ApplicationError(
          'OPTIMISTIC_LOCK_CONFLICT',
          'El Expediente fue modificado por otra operación.',
        );
      }
    });
  }

  private toDomain(row: ExpedienteRow, tenant: TenantContext): Expediente {
    const ubicacionActual = row.ubicacion_id
      ? Ubicacion.rehydrate({
          id: row.ubicacion_id,
          codigo: row.ubicacion_codigo as string,
          descripcion: row.ubicacion_descripcion as string,
        })
      : null;
    const custodiaActual =
      row.custodio_tipo !== null && row.custodio_ref !== null
        ? Custodia.from({
            custodianType: row.custodio_tipo,
            custodianReference: row.custodio_ref,
            service: row.custodio_servicio,
            location: row.custodio_location,
            acceptedAt: row.custodio_accepted_at,
          })
        : null;

    return Expediente.rehydrate({
      id: ExpedienteId.parse(row.id),
      expedienteNumero: ExpedienteNumero.parse(row.expediente_numero),
      pacienteReferencia: {
        idInstitucional: row.paciente_id_institucional,
        curp: row.paciente_curp,
        nombreOperativo: row.paciente_nombre_operativo,
        numeroIssste: row.paciente_numero_issste,
      },
      hospitalId: tenant.hospitalId,
      estadoOperativo: row.estado_operativo as ReturnType<Expediente['snapshot']>['estadoOperativo'],
      ubicacionActual,
      custodiaActual,
      rowVersion: BigInt(row.row_version),
    });
  }
}
