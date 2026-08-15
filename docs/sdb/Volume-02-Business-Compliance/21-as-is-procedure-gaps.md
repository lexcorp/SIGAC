---
project: SIGAC
sdb_volume: 02-Business-Compliance
version: 0.2.0
status: Draft
amended: "2026-08-14 — OQ-EW-001, OQ-EW-006 RESOLVED"
---
# BIZ-021 — AS-IS vs Procedure Gaps

Gaps de diseño identificados; no son conclusiones de incumplimiento.

- Agenda vs citas abiertas.
- Vale formal vs salidas sin registro.
- Custodia esperada vs falta de trazabilidad.
- Devolución vs retenciones.
- Ubicación esperada vs mal archivo.
- Verificación de integridad vs límites funcionales.

## Evidencia AS-IS validada — traslado y custodia (OQ-EW-006, 2026-08-14)

Operación observada y confirmada en entrevistas (SRC-INT-002, SRC-INT-003):

1. El archivista/mensajero prepara los expedientes de la jornada y los transporta al
   área o consultorio junto con la **hoja diaria**.
2. El receptor en destino puede ser **Enfermería** o el **médico/solicitante autorizado**.
3. Al retorno, el mensajero regresa únicamente los expedientes que Enfermería le entrega.
4. La hoja diaria se **descarga/raya manualmente** al retorno como control AS-IS.

Gap TO-BE: esta descarga manual se reemplazará por los eventos digitales
`ExpedienteDispatched` (salida de Archivo) y `CustodyAccepted` (confirmación del receptor).

## Evidencia AS-IS validada — identificador de expediente (OQ-EW-001, 2026-08-14)

Formato observado en el hospital: `<RFC_BASE_10><SEPARADOR><COD_DERECHOHABIENTE_2>`
(ejemplo anonimizado: `PERR810604/10`).
Separadores observados: `/` (preferente), `-`, y ausencia de separador.
El mismo valor se utiliza en SIMEF y el personal lo denomina "número de expediente".
Ver SRC-INT-002, SRC-INT-003.
