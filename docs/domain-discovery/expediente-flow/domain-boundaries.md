# Límites de dominio candidatos

## Convergencia con Expediente Workspace existente

Conceptos ya consolidados que este discovery debe reutilizar, no redefinir: `Expediente`, `ExpedienteNumero` no único, `EstadoOperativo`, `Ubicacion`, `Custodia`, `MovimientoExpediente`, `Solicitud`, `Prestamo`, `Incidencia`, capabilities server-side, tenant isolation y separación Movimiento/Audit.

La nueva evidencia profundiza el trabajo **antes** del despacho (Agenda, preparación, paquete) y el control físico **después** de consulta (recogida, verificación, rearchivo). No autoriza cambiar estados o invariantes ya aprobados.

## Bounded Contexts candidatos

| Contexto candidato | Responsabilidad | Relación |
|---|---|---|
| Archive Operations / Expediente | Estado, ubicación, custodia y movimientos del ejemplar físico | Ya existe; fuente de verdad de disponibilidad y tránsito. |
| Preparación de Agenda | Ingesta de evidencia SIMEF, reconciliación y trabajo de preparación para una jornada | Nuevo candidato; consumidor de referencias de Expediente, no propietario de datos clínicos. |
| Solicitudes y Préstamos | Demanda extraordinaria, autorización habilitante, plazo, renovación y retorno | Conceptos existentes, pero el detalle SM1-14 necesita discovery adicional. |
| SIMEF Anti-Corruption Layer | Traducir una exportación versionada sin filtrar su layout ni datos irrelevantes al dominio | Candidato de integración, no Aggregate. |

## Agregados candidatos (provisionales)

| Candidato | Invariantes posibles respaldadas | Incertidumbre |
|---|---|---|
| `AgendaImportada` o `PreparacionAgenda` | Una importación tenant+fecha reconcilia entradas por FOLIO, incluida retirada de preparación con historia y posterior restauración. | Elección entre ambos nombres y modelo definitivo se difieren a spec/diseño. |
| `PaqueteExpedientes` | Agrupa preparación para un destino operativo y permite faltantes explícitos. | Destino canónico, ciclo de vida y relación con Custodia no definidos. |
| `SolicitudExpediente` | Representa una demanda y su contexto habilitante. | Estados, duplicados, cancelación, prioridad y agenda vs vale pendientes. |
| `Prestamo` | Responsable, apertura, plazo, renovación y devolución. | Excepciones al plazo y vínculo exacto con SM1-14 pendientes. |
| `Expediente` | Disponibilidad, ubicación, custodia y transición física. | Ya implementado; no ampliar por esta discovery. |
| `MovimientoExpediente` | Registro operativo de cambios físicos. | Ya posee ownership en Archive Operations; no mezclar con Agenda ni Audit. |

`[OPEN QUESTION]` Si `PaqueteExpedientes` requiere consistencia transaccional propia o es sólo una proyección/lista de trabajo. `[OPEN QUESTION]` Si una entrada de Agenda origina una `SolicitudExpediente` o una unidad distinta de preparación; no se equiparan silenciosamente.

## Iteración 2

La evidencia del `.xlsm` fortalece un contexto separado **Agenda / Appointment Preparation** y expone `ImportacionAgenda`, `RegistroImportadoAgenda`, `IncidenciaImportacion` y `AsignacionMedicoServicioTurno` como candidatos adicionales. El análisis completo —sin decisión definitiva de Aggregate— está en `domain-model-analysis.md`.

Todos los candidatos son tenant-scoped. Los catálogos del libro no se convierten en configuración global ni se copian al dominio.
