# SIGAC Knowledge Base

## Propósito

Esta base conserva las fuentes utilizadas para comprender la operación actual de SIGAC, sustentar decisiones y mantener trazabilidad hacia futuras specs. No sustituye al SDB ni convierte observaciones en reglas aprobadas.

## Clasificación

| Categoría | Contenido | Naturaleza |
|---|---|---|
| `01-normativa/` | Normativa, guías y documentos oficiales de referencia | Fuente autoritativa o normativa |
| `02-procedimientos/` | Descripciones derivadas de procedimientos institucionales AS-IS | Interpretación documentada de fuentes y práctica observada |
| `03-formatos-oficiales/` | Formatos institucionales utilizados por los procedimientos | Evidencia documental oficial de captura o intercambio |
| `04-simef-evidencia-operativa/` | Exportaciones y archivos reales de SIMEF | Evidencia del comportamiento del sistema actual |
| `05-notas-operativas/` | Entrevistas, notas, observaciones, pendientes e hipótesis | Contexto no autoritativo pendiente de contraste o decisión |

## Jerarquía y precedencia

Cuando exista contradicción entre documentos:

1. Normativa legal y sanitaria vigente.
2. Guía de organización y manejo del expediente clínico.
3. Procedimientos institucionales oficiales.
4. Formatos oficiales.
5. Evidencia del funcionamiento de sistemas actuales como SIMEF.
6. Procedimiento operativo observado o documentado.
7. Notas, entrevistas, hipótesis y pendientes.

La **Guía de organización y manejo del expediente clínico** es una fuente autoritativa en esta Knowledge Base. Los documentos de citas programadas y solicitud/préstamo son derivados de la Guía y de observaciones operativas: ayudan al análisis AS-IS, pero no sustituyen la fuente original.

Una interpretación, resumen, entrevista o práctica observada nunca puede sobrescribir silenciosamente una fuente de mayor precedencia. Toda discrepancia debe conservar ambas evidencias, señalarse explícitamente y resolverse mediante el proceso de decisión correspondiente.

## Tipos de conocimiento

- **Fuente normativa:** establece obligaciones o criterios oficiales y tiene la mayor precedencia aplicable.
- **Procedimiento institucional:** describe una secuencia formal de trabajo; debe indicar sus fuentes.
- **Evidencia operativa:** muestra cómo funciona realmente un sistema o proceso en un momento determinado; no prueba por sí sola que ese comportamiento sea normativamente correcto.
- **Observación:** registra algo visto o relatado que todavía debe contrastarse.
- **Hipótesis:** explicación o propuesta provisional que requiere validación y nunca se trata como regla aprobada.

## Etiquetas conceptuales

- `[SOURCE]`: fuente original o autoritativa.
- `[AS-IS]`: comportamiento o procedimiento actual documentado.
- `[TO-BE]`: estado futuro propuesto y todavía sujeto a aprobación.
- `[OPEN QUESTION]`: cuestión sin resolución canónica.
- `[ASSUMPTION]`: supuesto explícito que necesita validación.

Las etiquetas describen la naturaleza de una afirmación; no cambian por sí mismas la precedencia de su fuente.

## Regla de trazabilidad

Toda futura spec, decisión o regla debe poder identificar la fuente concreta de la que proviene, usando como mínimo la ruta del artefacto y, cuando sea posible, sección, página, hoja o referencia interna. Si una regla combina varias fuentes, debe distinguir qué aporta cada una y registrar cualquier interpretación realizada.

Los archivos originales se conservan sin conversión ni alteración de contenido. Los README funcionan sólo como índices y metadatos de clasificación.
