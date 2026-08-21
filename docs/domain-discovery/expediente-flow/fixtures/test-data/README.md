# Fixtures desidentificados de discovery

`agenda-import-scenarios.json` es un dataset sintético conceptual, no un contrato de API, parser o schema. Ningún nombre, teléfono, correo, folio o identificador procede de los archivos reales.

| Escenario | Característica preservada |
|---|---|
| `valid` | Agenda mínima clasificable. |
| `duplicate-import` | Mismo contenido físico/lógico repetido. |
| `reconciled` | Segunda revisión por FOLIO con ADD, UPDATE y `RETIRADA_DE_AGENDA`. |
| `appointment-modified` | UPDATE de campos permitidos conservando FOLIO. |
| `appointment-withdrawn-from-agenda` | Retiro de preparación, historia preservada y sin cancelación clínica inferida. |
| `withdrawn-appointment-reappears` | RESTORE conceptual de la misma identidad. |
| `mixed-reconciliation` | ADD, UPDATE, UNCHANGED y retiro en una ejecución. |
| `invalid-layout` | Encabezado requerido ausente. |
| `multiple-spaces-doctor` | Diferencia interna de espacios que causó omisiones. |
| `doctor-not-found` | Cero candidatos. |
| `doctor-without-shift` | Médico resuelto sin asignación operacional. |
| `multiple-doctor-candidates` | Fallback ambiguo. |
| `weekend-shift` | Turno distinto de matutino/vespertino. |
| `empty-minimal` | Agenda compatible sin citas. |

El Golden Dataset real sólo sirve como baseline estructural y métrico. No se incorpora como fixture. La futura suite debe comprobar conservación de cardinalidad: cada entrada sintética termina con resultado explícito.
