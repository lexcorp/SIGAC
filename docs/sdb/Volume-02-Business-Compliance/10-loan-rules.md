---
project: SIGAC
sdb_volume: 02-Business-Compliance
version: 0.2.0
status: Draft
amended: "2026-08-14 — OQ-EW-005 RESOLVED"
---
# BIZ-010 — Loan Rules

## Procedimiento general
Solicitante responsable; devolución íntegra en plazo; si requiere más tiempo se gestiona
renovación o nuevo formato según la fuente habilitante.

## Fuente Habilitante de Salida (`FuenteHabilitanteSalida`) — OQ-EW-005 RESOLVED

La apertura de un préstamo o la habilitación de una salida requiere una fuente habilitante
válida. Las fuentes reconocidas son:

### `CONSULTA_PROGRAMADA`
- La programación de citas en agenda habilita la preparación y la salida del expediente.
- Archivo Clínico realiza la saca, preparación y entrega sin autorización individual
  adicional de Director/Subdirector/Coordinación para cada expediente.
- Es la fuente habilitante del flujo normal diario.

### `VALE_ARCHIVO_SM_1_14`
- Aplica a solicitudes extraordinarias fuera de programación.
- Formato utilizado: SM 1-14 "Vale al archivo".
- Actores facultados para emitirlo: Director de la unidad, Subdirector, Coordinación Médica.
- Plazo máximo: 24 horas.
- Si la necesidad continúa al vencer el plazo, debe generarse un nuevo formato/préstamo.

### `ORDEN_SUPERIOR`
- Fuente habilitante válida y reconocida operativamente.
- Sus detalles específicos (formato, actores exactos, plazo) están fuera de este slice
  y se modelarán cuando el proceso correspondiente sea especificado.

## Regla de autorización
La autorización para `OpenLoan` / salida considera:
`actor + tenant + recurso + contexto de negocio + FuenteHabilitanteSalida`

No se aplica ninguna regla universal del tipo "cualquier médico puede solicitar".

## Plazo
El plazo de 24 horas es la política aplicable observada para `VALE_ARCHIVO_SM_1_14`,
no una constante universal. Se modelará como `LoanDeadlinePolicy` configurable.

## TO-BE
Registrar: solicitante, custodio, finalidad, salida, límite, renovaciones, vencimiento e historial.
Fuente: SRC-GUIA, SRC-INT-002, DECISION-REGISTER OQ-EW-005.
