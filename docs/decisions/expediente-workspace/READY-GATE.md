# Ready Gate — Expediente Workspace v0.3.0

No autorizar implementación hasta verificar:

- [ ] Los cuatro documentos declaran versión 0.3.0.
- [ ] OQ-EW-001 está cerrada y el número de expediente no se trata como único absoluto.
- [ ] OQ-EW-005 está cerrada; no existe política temporal inventada.
- [ ] OQ-EW-006 está cerrada; Dispatch y CustodyAccepted son eventos/momentos distintos.
- [ ] OQ-EW-007 está cerrada; múltiples coincidencias se desambiguan.
- [ ] `EstadoOperativo` usa exactamente: DISPONIBLE, APARTADO, EN_TRASLADO, EN_CONSULTA, NO_LOCALIZADO, EXTRAVIADO.
- [ ] `EN_BUSQUEDA` no es EstadoOperativo del Expediente.
- [ ] `PRESTADO` no es EstadoOperativo del Expediente.
- [ ] `NO_LOCALIZADO` no cambia automáticamente a `EXTRAVIADO`.
- [ ] Requirements, Design, Tasks y Traceability coinciden en blocking OQs.
- [ ] Ninguna task depende de una regla marcada PENDIENTE.
- [ ] Búsqueda por número contempla 0..N coincidencias.
- [ ] `MovimientoExpediente` y `audit_log` siguen separados.
- [ ] Autorización sigue server-side.
- [ ] Tenant isolation sigue siendo no negociable.
- [ ] No se incorporan diagnósticos/notas/tratamientos.
- [ ] Tests cubren formato/normalización, múltiples coincidencias, estados, traslado, custodia y autorización contextual.

Resultado esperado:

`implementation_ready: true`

Sólo después aprobar T-01.
