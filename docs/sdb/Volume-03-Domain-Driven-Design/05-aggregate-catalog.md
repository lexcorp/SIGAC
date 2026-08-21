---
project: SIGAC
volume: 03-Domain-Driven-Design
version: 0.1.0
status: Draft
---
# DDD-005 — Aggregate Catalog
Aggregate Roots candidatos:
1. Expediente
2. Solicitud
3. Prestamo
4. JornadaPreparacion
5. Incidencia
6. ImportacionAgenda (Agenda Preparation; accountability de ingestión)
7. Agenda (Agenda Preparation; estado lógico tenant+fecha)

No roots por defecto: Movimiento, Ubicación, Custodia, PacienteReferencia, Servicio, Consultorio.

`ImportacionAgenda` sigue IMP-AP-001..014: IDs/instante provistos externamente,
`BUILDING → FINALIZED`, registros con resultado único, incidencias 0..N y métricas
derivadas. No contiene fingerprint, filename, raw ni `ImportArtifactMetadata`.
