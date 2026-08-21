# Domain Value Objects Decision — Agenda Preparation

**Estado:** APPROVED

**Fecha:** 2026-08-20

**Scope:** cierre del bloqueo documental de T-01 en `agenda-preparation v0.1.2`

## VO-AP-001 — AgendaFecha

`AgendaFecha` representa una fecha civil de Agenda, no un instante.

- Forma canónica `YYYY-MM-DD`.
- Debe representar una fecha gregoriana válida.
- No contiene hora, timezone ni offset y no se convierte a UTC.
- Igualdad por fecha canónica.
- Interpretar formatos externos como `DD/MM/YYYY` pertenece al parser/Adapter futuro.

## VO-AP-002 — FolioCita

- String obligatorio; aplica exclusivamente trim de whitespace exterior.
- Vacío después de trim es inválido.
- No impone regex derivada de fixtures ni cambia case.
- Conserva `/`, `-`, ceros, whitespace interno y otros caracteres sin reinterpretarlos.
- Identidad e igualdad por valor resultante exacto.
- Nunca se convierte a número.

## VO-AP-003 — NumeroEmpleado

- String obligatorio; aplica exclusivamente trim exterior.
- Vacío después de trim es inválido.
- Conserva ceros iniciales y nunca se convierte a número.
- No impone longitud ni patrón exclusivamente numérico sin evidencia autoritativa.
- Igualdad por valor resultante exacto.

## VO-AP-004 — ServicioEspecialidad

```ts
interface ServicioEspecialidadValue {
  readonly codigo: string;
  readonly nombre: string;
}
```

Para un servicio resuelto, ambos campos son obligatorios y no vacíos después de trim
exterior. No se altera case, acentos ni contenido interno. Identidad e igualdad de
negocio se determinan exclusivamente por `codigo` normalizado; `nombre` es descriptivo
y no redefine identidad. No introduce Turno, Consultorio o Destino.

## VO-AP-005 — PosicionRegistroOrigen

- Entero positivo base 1.
- Representa el ordinal lógico del registro/Cita entre los registros interpretables del
  artefacto; `1` es el primero.
- Rechaza `0`, negativos, decimales, `NaN` e infinito.
- No representa fila Excel/HTML, byte offset, página o posición física.
- Igualdad por entero.

## VO-AP-006 — Provenance

Los VOs contienen sólo el valor semántico/canónico usado por Domain; no almacenan a la
vez `original` y `normalized`. La evidencia original allow-listed pertenece a la futura
entidad `RegistroImportadoAgenda`, conforme RAW-AP-001..012:

```text
RegistroImportadoAgenda
  originalValues
  interpretedValues
  processingResult
  incidents
```

Esta shape es conceptual y no se implementa en T-01.

## VO-AP-007 — Parsing boundary

`parsing != normalization`. El parser/Adapter futuro convierte representaciones
específicas de SIMEF al input canónico. Los VOs validan y conservan su semántica Domain;
no conocen HTML, `.xls`, encoding, encabezados ni coordenadas físicas.

## VO-AP-008 — Catálogos inalterados

Esta decisión no modifica ImportOutcome, RecordProcessingResult, ImportIncident,
AuditResult, permissions ni audit actions. Tampoco introduce Aggregate, Entity, evento,
persistence, API o parser.

## Readiness

- Bloqueo documental T-01: RESOLVED.
- Nuevos gaps bloqueantes: ninguno.
- T-01 puede iniciar en una ejecución posterior.
- T-01 implementada: NO.
