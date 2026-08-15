# Decision Register — Expediente Workspace

## OQ-EW-001 — Identificador del expediente
**Estado:** RESOLVED

### Evidencia documental
La Guía, Anexo 3 / SM 1-1-2-N-1, describe el número de expediente como RFC más un dígito de tipo de derechohabiente.

### Evidencia operativa validada
En el hospital se utiliza:

`<RFC_BASE_10><SEPARADOR><CODIGO_DERECHOHABIENTE_2>`

Ejemplo anonimizado: `PERR810604/10`.

- RFC base: 10 caracteres, sin homoclave.
- Separador preferente: `/`.
- Variantes observadas: `-` o ausencia de separador.
- El mismo valor se utiliza en SIMEF.
- El personal lo denomina “número de expediente”.

Catálogo operativo confirmado:
- 10 Trabajador
- 20 Trabajadora
- 30 Esposa
- 40 Concubina
- 50 Padre o Abuelo
- 60 Madre o Abuela
- 70 Hijo
- 80 Hija
- 90 Pensionado

### Decisión SIGAC
- Conservar el identificador institucional; SIGAC no genera un sustituto funcional.
- `ExpedienteNumero` debe aceptar las variantes operativas de separador.
- La representación preferente de presentación es con `/`.
- No definir `UNIQUE(expediente_numero)` hasta validar los datos reales de SIMEF.
- SIGAC tendrá UUID interno independiente del identificador institucional.

---

## OQ-EW-005 — Autorización para apertura de préstamo/salida
**Estado:** RESOLVED

### Consulta programada
La programación de citas habilita la preparación y salida. Archivo Clínico realiza saca, preparación y entrega sin autorización individual adicional para cada expediente.

### Solicitud extraordinaria/fuera de programación
Se utiliza SM 1-14 “Vale al archivo”. Los actores facultados confirmados son Director de la unidad, Subdirector y Coordinación Médica. El préstamo es por máximo 24 horas; si continúa la necesidad se genera un nuevo formato/préstamo.

### Orden Superior
Se reconoce como fuente habilitante válida. Sus detalles específicos permanecen fuera de este slice hasta que se modele el proceso correspondiente.

### Decisión SIGAC
Modelar `FuenteHabilitanteSalida` al menos con:
- `CONSULTA_PROGRAMADA`
- `VALE_ARCHIVO_SM_1_14`
- `ORDEN_SUPERIOR`

La autorización de `OpenLoan`/salida debe considerar actor + tenant + recurso + contexto + fuente habilitante. No usar una regla universal “cualquier médico puede solicitar”.

---

## OQ-EW-006 — Inicio de custodia externa
**Estado:** RESOLVED

### Operación validada
El archivista/mensajero transporta los expedientes preparados hacia el área/consultorio junto con la hoja diaria. El destino puede recibirlos por Enfermería o por médico/solicitante autorizado. Al retorno, el mensajero regresa únicamente los expedientes entregados por Enfermería y descarga/raya manualmente la lista.

### Decisión SIGAC
Distinguir transporte de custodia:
1. `ExpedienteDispatched`: el expediente sale físicamente de Archivo Clínico y queda EN_TRASLADO.
2. `CustodyAccepted`: la custodia externa inicia cuando el expediente llega al destino y el receptor autorizado confirma recepción.

La confirmación digital inicial no implica firma electrónica criptográfica; es una acción autenticada y auditable del receptor.

---

## DEC-EW-STATE-001 — EstadoOperativo del Expediente
**Estado:** ACCEPTED

El aggregate `Expediente` tendrá un `EstadoOperativo` explícito para comunicar la situación operacional dominante. No sustituye estados de Solicitud, Préstamo, Incidencia, Custodia ni Ubicación.

Estados iniciales aceptados:
- `DISPONIBLE`
- `APARTADO`
- `EN_TRASLADO`
- `EN_CONSULTA`
- `NO_LOCALIZADO`
- `EXTRAVIADO`

Reglas:
- `EN_BUSQUEDA` pertenece al proceso/estado de Solicitud, no a `EstadoOperativo`.
- `PRESTADO` pertenece al Préstamo; no se usa como estado operativo del Expediente.
- `NO_LOCALIZADO != EXTRAVIADO`.
- Las transiciones del EstadoOperativo pueden reaccionar a eventos emitidos por otros aggregates/módulos.

Transiciones base del flujo normal:
`DISPONIBLE -> APARTADO -> EN_TRASLADO -> EN_CONSULTA -> EN_TRASLADO -> DISPONIBLE`

La transición final a `DISPONIBLE` debe ocurrir conforme al workflow de devolución/verificación/rearchivo definido por el SDB; no asumir que la mera recepción física equivale a rearchivo.

---

## OQ-EW-007 — Derechohabientes del mismo tipo
**Estado:** RESOLVED

Cuando dos o más derechohabientes del mismo tipo pueden compartir el mismo número institucional, la diferenciación operativa se realiza mediante:
- nombre del derechohabiente;
- CURP;
- número ISSSTE.

### Decisión SIGAC
- `expedienteNumero` no se asumirá globalmente único.
- La búsqueda puede devolver múltiples coincidencias.
- Nunca abrir arbitrariamente una coincidencia cuando existan varias.
- La identidad técnica primaria será `ExpedienteId` (UUID interno).
- Las restricciones físicas de unicidad se definirán después de perfilar los datos reales de SIMEF.

---

## SEARCH-EW-001..010 — Búsqueda canónica por número
**Estado:** APPROVED

Se aprueba `SearchExpedientesByNumero` como Use Case Application con
`ExpedienteNumero`, `RequestContext`, `EXPEDIENT_VIEW` y Repository tenant-scoped. Su
resultado es una proyección mínima 0..N; el endpoint retorna `{items}` y el flujo UI es
0 vacío, 1 apertura directa, N>1 selección manual. Audit usa `EXPEDIENTE_SEARCH` con
success para cero o N resultados. Contrato completo en
`EXPEDIENT-SEARCH-DECISION.md`.

---

## AUDIT-UX-EW / CMD-UX-EW / LOC-EW — Audit y comandos pre-T-22
**Estado:** APPROVED

OQ-EW-003 queda RESOLVED con `EXPEDIENT_AUDIT_VIEW`, distinta de
`EXPEDIENT_VIEW` y fuera de capabilities. Se aprueban `GetExpedienteAudit`, su
query port tenant-scoped, el read model sanitizado y GET
`/api/v1/expedientes/{id}/audit`. También quedan definidos los dialogs de Dispatch y
AcceptCustody y el contrato mínimo de `ListUbicaciones`/GET `/api/v1/ubicaciones`.

La extensión v0.3.22 aprueba `LOCATION_VIEW` exclusivamente para
`ListUbicaciones`/GET `/api/v1/ubicaciones`, distinta de `EXPEDIENT_VIEW`,
`EXPEDIENT_AUDIT_VIEW` y `ADMIN_CONFIGURE`. No es capability. Con esta decisión,
`LOCATION-PERMISSION-GAP` queda CLOSED. Contrato completo en
`EXPEDIENT-AUDIT-AND-COMMAND-UX-DECISION.md`.

---

## AUD-PAGE-EW-001/002 y AUTH-UI-EW-001..005 — T-21A
**Estado:** APPROVED

Audit ordena `occurredAt DESC, auditId DESC`; el cursor opaco representa ambos valores.
GET `/api/v1/session`, respaldado por `GetSessionAuthorization`, retorna únicamente
actorId y permissions server-derived. Permission y capability permanecen separadas y
la UI nunca deriva autorización desde roles. Estas decisiones cierran los dos bloqueos
restantes de T-21A.
