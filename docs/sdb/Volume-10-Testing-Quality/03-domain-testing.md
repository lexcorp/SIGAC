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
- Dispatch exige intendedCustodianRef string no vacío; Custodia en tránsito conserva
  custodianReference obligatorio y no lo deriva de destination.
- `EN_TRASLADO` sin `AcceptCustody` → `custodiaActual.acceptedAt = null`.
- `AcceptCustody` produce `EstadoOperativo = EN_CONSULTA` y establece `acceptedAt`.
- Despacho sin aceptación no equivale a custodia formal.

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
