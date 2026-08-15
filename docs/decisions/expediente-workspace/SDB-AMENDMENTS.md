# SDB Amendments — Expediente Workspace Decision Resolution

Estas enmiendas deben incorporarse a los documentos canónicos existentes sin renumerar arbitrariamente IDs ya publicados. Si un documento tiene un registro de Open Questions, cerrar allí el OQ correspondiente y enlazar esta decisión.

## Volume 02 — Business & Compliance
Incorporar:
- divergencia documentada entre formato de número de expediente de la Guía y práctica hospitalaria;
- catálogo operativo 10–90;
- consulta programada vs SM 1-14 vs Orden Superior como fuentes habilitantes;
- responsabilidad del solicitante y plazo de 24 h para SM 1-14;
- evidencia AS-IS de mensajero + hoja diaria + entrega a Enfermería/médico;
- regla `NO_LOCALIZADO != EXTRAVIADO`.

Actualizar preferentemente: business rules, loan rules, location/custody semantics, authorization matrix, evidence register, open questions y validation decisions.

## Volume 03 — Domain-Driven Design
Refinar:
- `ExpedienteNumero` como VO institucional tolerante a variantes `/`, `-` o sin separador;
- `ExpedienteId` UUID interno separado;
- `EstadoOperativo` con seis valores aceptados;
- `Custodia` y transporte como conceptos distintos;
- `FuenteHabilitanteSalida`;
- eventos `ExpedienteDispatched` y `CustodyAccepted`;
- `MovimientoExpediente` sigue distinto de Audit Log;
- eliminar `EN_BUSQUEDA` y `PRESTADO` del estado operativo del Expediente si aparecen como candidatos.

No declarar `expedienteNumero` único hasta perfilar SIMEF.

## Volume 04 — Workflows & Event Storming
Actualizar flujo normal:
Agenda/programación → preparación → APARTADO → despacho → EN_TRASLADO → recepción autorizada/CustodyAccepted → EN_CONSULTA → retorno/EN_TRASLADO → recepción/verificación → rearchivo → DISPONIBLE.

Separar claramente:
- preparación;
- despacho;
- transporte;
- aceptación de custodia;
- devolución física;
- verificación;
- rearchivo.

## Volume 05 — Use Cases & SDD Specifications
Actualizar UC/specs de búsqueda, préstamo, custodia y workspace:
- búsqueda por número puede retornar 0..N resultados;
- si N > 1, exigir desambiguación por datos permitidos del derechohabiente;
- `OpenLoan` evalúa `FuenteHabilitanteSalida`;
- consulta programada no exige autorización individual adicional;
- SM 1-14 sí restringe solicitantes y plazo;
- `CustodyAccepted` requiere receptor autenticado/autorizado;
- agregar Given/When/Then para separadores, múltiples coincidencias, despacho sin recepción y recepción confirmada.

## Volume 06 — Architecture & ADR
No se requiere un ADR nuevo sólo por el catálogo de estados, salvo que el repositorio trate toda decisión de ownership de estado como ADR. Registrar, como mínimo, que `EstadoOperativo` es estado del aggregate Expediente pero no sustituye los estados de otros aggregates.

## Volume 07 — Security & Privacy
Refinar autorización contextual:
`subject + permission + tenant + resource + business context + enabling source`.

La confirmación de custodia debe registrar usuario autenticado, tenant, recurso, destino, timestamp y resultado. No requiere firma criptográfica en este slice.

## Volume 08 — Data & API
Cambios requeridos:
- no asumir UNIQUE de `expediente_numero`;
- búsqueda por número retorna colección;
- almacenar/derivar forma normalizada para búsqueda sin perder presentación institucional;
- modelar `estado_operativo` con los seis valores aceptados;
- contratos/eventos para dispatch y custody acceptance;
- mantener `MovimientoExpediente` separado de `audit_log`.

Antes de crear constraint de unicidad: profiling de SIMEF.

## Volume 09 — UI/UX
El Workspace debe responder además visualmente a:
- Estado operativo;
- Ubicación;
- Custodio;
- si está en traslado, destino y transportista cuando corresponda;
- si una búsqueda por número produce múltiples resultados, mostrar selección/desambiguación; nunca elegir automáticamente.

## Volume 10 — Testing & Quality
Agregar pruebas para:
- variantes `RFC/10`, `RFC-10`, `RFC10`;
- búsqueda con múltiples coincidencias;
- estados válidos e inválidos;
- `NO_LOCALIZADO` no implica `EXTRAVIADO`;
- dispatch produce `EN_TRASLADO`;
- `CustodyAccepted` produce estado/custodia de destino;
- autorización de consulta programada vs SM 1-14;
- aislamiento tenant en todas las búsquedas.

## Volume 12 — OpenSpec / SpecBoot
Actualizar readiness/traceability:
- OQ-EW-001 = RESOLVED
- OQ-EW-005 = RESOLVED
- OQ-EW-006 = RESOLVED
- OQ-EW-007 = RESOLVED
- DEC-EW-STATE-001 = ACCEPTED

Eliminar cualquier instrucción de “política conservadora temporal” para OQ-EW-005. Una decisión resuelta debe consumirse directamente desde el SDB actualizado.
