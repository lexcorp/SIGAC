# TQ-014 — Migration Testing

Migration versionada, empty DB, upgrade representativo, compatibilidad y estrategia forward/rollback.

Para Expediente Workspace v0.3.15 se verifica en PostgreSQL real:

- nombres `ubicaciones`, `expedientes`, `movimientos_expediente`;
- ausencia de UNIQUE en número y presencia del índice normalizado no unique;
- `row_version` BIGINT NOT NULL DEFAULT 0;
- CHECK exacto de los seis estados y de source `WEB|INTERNAL`;
- cuatro columnas NOT NULL de PacienteReferencia y cinco columnas nullable de Custodia;
- FKs aprobadas y ausencia de FKs especulativas;
- join de Ubicacion y rehidratación VO ↔ DB;
- `business_reference_id`/`correlation_id` como TEXT nullable;
- empty DB y upgrade desde el schema previo sin pérdida silenciosa.
