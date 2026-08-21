# Análisis de impacto futuro

## SDB (no modificado)

| Volumen/área | Impacto probable después de cerrar discovery |
|---|---|
| Business | Propósito de preparación, actores, fuente SIMEF y reglas confirmadas. |
| DDD | Contexto Agenda, lenguaje, agregados y boundary con Archive Operations. |
| Workflows | Importación, incidencia, reconciliación, reproceso y preparación. |
| Use Cases/SDD | UC-AGENDA candidatos tras aprobación. |
| Architecture | Anti-Corruption Layer, raw evidence y source of truth. |
| Security | Minimización, acceso a raw, tenant isolation y trazabilidad. |
| Data/API | Sólo después de decisiones de identidad/layout; no diseñadas aquí. |
| UI/UX | Lista de trabajo e incidencias después de definir outcomes. |
| Testing | Golden Dataset desidentificado, regresión e invariantes de no pérdida. |
| Operations | Versionado de layout, métricas, reproceso y soporte. |
| OpenSpec | Readiness, OQs y dependency graph de la futura spec. |

## Spec impact

`expediente-workspace v0.3.23` no requiere modificación con la evidencia actual. Agenda/preparación es capacidad nueva candidata a spec 002. Se reutilizan Expediente, tenant isolation y consultas existentes sin cambiar contratos.

`ATENCION_FUERA_DE_AGENDA`, Turno y consultorio/destino pertenecen a capacidad futura o discovery posterior y no amplían spec 002.

`SPEC-IMPACT-GAP`: ninguno detectado. Si la futura decisión intenta hacer único `ExpedienteNumero`, añadir estados de Agenda a `EstadoOperativo` o equiparar Cita con Solicitud SM1-14, sí existiría contradicción y deberá detenerse.
