# Domain Discovery — flujo operativo del Expediente

Estado: exploratorio. Este conjunto documenta el proceso observado y las preguntas necesarias antes de una futura spec. No modifica ni complementa normativamente al SDB.

## Alcance

Salida, preparación, solicitud, préstamo, retorno y rearchivo de expedientes físicos. Las afirmaciones usan la taxonomía de `knowledge/README.md`:

- `[SOURCE]`: contenido de una fuente original o autoritativa.
- `[AS-IS]`: comportamiento actual documentado u observado.
- `[TO-BE]`: candidato futuro, sin aprobación.
- `[OPEN QUESTION]`: definición necesaria todavía ausente.
- `[ASSUMPTION]`: supuesto explícito pendiente de validación.

## Artefactos

- [source-map.md](source-map.md): procedencia, autoridad y límites de la evidencia.
- [as-is-process-map.md](as-is-process-map.md): flujos actuales reconstruidos.
- [artifact-analysis.md](artifact-analysis.md): Agenda SIMEF, SM10-1 y SM1-14.
- [event-storming.md](event-storming.md): actores, comandos, eventos, políticas y read models candidatos.
- [domain-boundaries.md](domain-boundaries.md): convergencias, límites y agregados candidatos.
- [exceptions-map.md](exceptions-map.md): excepciones observadas y grado de certeza.
- [open-questions.md](open-questions.md): preguntas que deben resolverse antes de especificar.
- [slice-candidates.md](slice-candidates.md): opciones de siguiente vertical slice.
- [excel-reverse-engineering.md](excel-reverse-engineering.md): evidencia directa del `.xlsm`, DD-EW-001..006 e incidencias.
- [business-rules.md](business-rules.md): clasificación provisional RN-001..RN-020.
- [domain-model-analysis.md](domain-model-analysis.md): contextos, agregados y flujo TO-BE candidatos.
- [archive-clinical-questionnaire.md](archive-clinical-questionnaire.md): cuestionario priorizado para negocio.
- [adr-candidates.md](adr-candidates.md): decisiones arquitectónicas futuras, todavía no redactadas.
- [impact-analysis.md](impact-analysis.md): impacto probable en SDB y specs.
- [spec-002-readiness.md](spec-002-readiness.md): readiness explícito DD-EW-001..006.
- [iteration-3-evidence.md](iteration-3-evidence.md): contraste del cuestionario con la Agenda real del 21/08/2026.
- [fixtures/test-data/README.md](fixtures/test-data/README.md): Golden Dataset desidentificado.

## Restricciones

Este material no crea reglas, estados, permisos, endpoints ni schemas. Los datos personales presentes en exportaciones reales se analizaron sólo estructuralmente y no se reproducen aquí. Una futura spec debe volver a citar la fuente original y resolver sus preguntas abiertas mediante decisión explícita.
