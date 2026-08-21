---
project: SIGAC
sdb_volume: 02-Business-Compliance
version: 0.3.0
status: Draft
amended: "2026-08-14 — OQ-EW-005 RESOLVED"
---
# BIZ-016 — Authorization

Las fuentes distinguen consulta programada y préstamos extraordinarios.
No se fija "médico puede/no puede solicitar" universalmente.

## Fuentes habilitantes de salida — RESUELTO (OQ-EW-005)

| Fuente | Actores facultados | Plazo | Autorización por expediente |
|--------|--------------------|-------|-----------------------------|
| `CONSULTA_PROGRAMADA` | Archivo Clínico | Jornada | No requerida individualmente |
| `VALE_ARCHIVO_SM_1_14` | Director, Subdirector, Coordinación Médica | 24 h | Sí, por formato SM 1-14 |
| `ORDEN_SUPERIOR` | [pendiente detalles] | [pendiente] | [pendiente detalles] |

## Tupla de autorización
`subject + permission + tenant + resource + business context + enabling source`

La asignación mínima del Expediente Workspace y el mapeo Capability -> Permission están
aprobados en `docs/decisions/expediente-workspace/AUTHORIZATION-DECISION.md`.

Para SM 1-14, `DIRECCION` o `COORDINACION_MEDICA` emite/autoriza; `ARCHIVISTA` o
`ARCHIVO_JEFE` ejecuta la apertura. La emisión no concede `LOAN_OPEN` al emisor.
La fuente llega previamente validada al CapabilityService.

`ORDEN_SUPERIOR` no habilita `ABRIR_PRESTAMO` en este slice (fail-closed).

Ver también: SEC-017 (Volume 07) para la implementación técnica de RBAC + contexto.

## Agenda Preparation

Importar/reimportar exige `AGENDA_IMPORT`; consultar importación/resultados, Agenda
vigente o lista inicial exige `AGENDA_VIEW`; consultar incidencias exige
`AGENDA_INCIDENT_VIEW`. No hay capabilities ni `AGENDA_INCIDENT_RESOLVE` en el slice
inicial. No se aprueba aquí ningún mapping Role → Permission.

## Pendiente
Matriz completa Acción × TipoSolicitud × Rol × Servicio × Hospital a definir
en Volume 05 una vez confirmados los tipos de solicitud restantes.
