# TQ-003 — Domain Testing

Probar invariantes, value objects, state transitions y policies.

## Casos existentes
- NoLocalizado != Extraviado (INV-INC-002).
- Préstamo Cerrado no vuelve a Activo (INV-LOAN-002).
- Devolución != Rearchivo (BR-005).

## Casos añadidos (2026-08-14)

### Formato ExpedienteNumero (OQ-EW-001 RESOLVED)
- `PERR810604/10` es válido; normaliza a `PERR81060410`.
- `PERR810604-10` es válido; normaliza a `PERR81060410`.
- `PERR81060410` (sin separador) es válido; igual resultado normalizado.
- RFC con menos de 10 caracteres → inválido.
- Código de derechohabiente no en catálogo (10,20,30,40,50,60,70,80,90) → inválido.

### EstadoOperativo (DEC-EW-STATE-001)
- Expediente acepta exactamente: DISPONIBLE, APARTADO, EN_TRASLADO, EN_CONSULTA,
  NO_LOCALIZADO, EXTRAVIADO.
- `EN_BUSQUEDA` no es valor válido de `EstadoOperativo` → rechazado.
- `PRESTADO` no es valor válido de `EstadoOperativo` → rechazado.
- Transición DISPONIBLE → APARTADO → EN_TRASLADO → EN_CONSULTA → EN_TRASLADO → DISPONIBLE.
- NO_LOCALIZADO no transiciona automáticamente a EXTRAVIADO.

### Despacho / Custodia (OQ-EW-006 RESOLVED)
- `DispatchExpediente` produce `EstadoOperativo = EN_TRASLADO`.
- Dispatch parte sólo de APARTADO, deriva origin/custodian previos, establece destination
  y Custodia acceptedAt null, y produce el payload mínimo ExpedienteDispatched.
- Dispatch exige intendedCustodian type/reference no vacíos; Custodia en tránsito los
  conserva como custodianType/custodianReference, deja service/location/acceptedAt null
  y no deriva ningún campo de destination.
- Dispatch usa el occurredAt recibido; no genera timestamps. El Domain Event conserva
  exactamente el instante proporcionado por el test.
- `EN_TRASLADO` sin `AcceptCustody` → `custodiaActual.acceptedAt = null`.
- `AcceptCustody` produce `EstadoOperativo = EN_CONSULTA` y establece `acceptedAt`.
- Despacho sin aceptación no equivale a custodia formal.
- AcceptCustody exige EN_TRASLADO, custodia previa no aceptada y ubicación coincidente;
  materializa receptor efectivo y emite payload con custodio previsto/aceptado.

### Desambiguación (OQ-EW-007 RESOLVED)
- Búsqueda con N > 1 coincidencias → sistema no abre automáticamente ninguna.
- Búsqueda con N = 0 → estado vacío; no error 404.
- Búsqueda con N = 1 → apertura directa permitida.

### Autorización por fuente habilitante (OQ-EW-005 RESOLVED)
- `CONSULTA_PROGRAMADA` + Archivista → préstamo permitido.
- `VALE_ARCHIVO_SM_1_14` no validada + Archivista → rechazado.
- `VALE_ARCHIVO_SM_1_14` validada + Archivista/Jefatura con `LOAN_OPEN` → permitido.
- `DIRECCION`/`COORDINACION_MEDICA` emisor sin `LOAN_OPEN` → no ejecuta OpenLoan.
- `ORDEN_SUPERIOR` → no habilita OpenLoan en este slice.
- Ausencia de fuente habilitante → `OpenLoan` rechazado.

## Agenda Preparation — RESULT-AP-001..014

- Cada fila recibida termina con exactamente un `RecordProcessingResult`.
- Todas las ocurrencias de un FOLIO repetido son `DUPLICATE_FOLIO`; no existe ganador.
- Duplicados no reconcilian Cita para ese FOLIO.
- ADD/UPDATE/UNCHANGED/RESTORE producen ADDED/UPDATED/UNCHANGED/RESTORED.
- `RETIRADA_DE_AGENDA` es efecto sobre el snapshot previo y no cuenta como fila recibida.
- Las ecuaciones de métricas cerradas se verifican como invariantes.
- Layout rechazado no crea resultados de fila ni Domain Events.
- Primera vez/subsecuente sólo acepta una marca inequívoca; ambas o ninguna generan
  incidencia de fila, nunca un tercer estado.

## Agenda Preparation — Value Objects T-01

- AgendaFecha acepta sólo fecha civil gregoriana canónica y prueba igualdad sin UTC.
- FolioCita/NumeroEmpleado prueban trim exterior, vacío inválido, case/contenido interno
  preservados, igualdad exacta y ausencia de conversión numérica.
- NumeroEmpleado conserva ceros iniciales.
- ServicioEspecialidad exige código/nombre y compara identidad sólo por código.
- PosicionRegistroOrigen acepta enteros positivos base 1 y rechaza 0, negativos,
  decimales, NaN e infinito.
- Ningún VO ejecuta parsing SIMEF ni almacena simultáneamente original/normalized.
- Cada rechazo verifica el DomainError.code exacto de VO-AP-009; no se esperan errores
  nativos, códigos genéricos ni messages como contrato.

## Agenda Preparation — Aggregate T-02

IMP-AP-001..014 exige pruebas de creación/IDs, resultado único y rechazo de segunda
finalización, registros múltiples, incidencias 0..N, duplicados por identidad, métricas
derivadas/ecuationes, retiradas separadas, outcome final único, inmutabilidad posterior y
ausencia de raw/fingerprint/filename. Layout fail-closed se prueba en Application/parser,
antes de construir el Aggregate, no en los unit tests puros de T-02.

## Agenda Preparation — Aggregate T-03

AGD-AP-001..009 exige pruebas de creación vacía/con Citas iniciales; FOLIO único y fecha
compatible; HoraCita estricta; MedicoReferencia/ExpedienteReferencia; comparación de los
campos funcionales exactos; ADD/UPDATE/UNCHANGED/RESTORE/WITHDRAW; snapshot vacío;
rechazo atómico de duplicados/fecha incompatible; conservación de identidad/contenido al
retirar/restaurar; ausencia de campos excluidos/timestamps y ausencia de Domain Events.
