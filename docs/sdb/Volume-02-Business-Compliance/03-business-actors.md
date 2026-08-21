---
project: SIGAC
sdb_volume: 02-Business-Compliance
version: 0.2.0
status: Draft
---
# BIZ-003 — Business Actors
Jefatura de Archivo, archivistas, enfermería, médicos, Coordinación Médica, Dirección/Subdirección, sistema/área de citas, traslado y TI. Solicitante, receptor y custodio son roles contextuales.

## Roles canónicos del Expediente Workspace

`ARCHIVISTA`, `ARCHIVO_JEFE`, `DIRECCION`, `COORDINACION_MEDICA`,
`RECEPTOR_SERVICIO`, `AUDITOR_CONSULTA`, `ADMIN_TECNICO`, `TRASLADO`.

En este slice, Subdirector se representa mediante `DIRECCION`; Enfermería y médico
receptor actúan contextualmente mediante `RECEPTOR_SERVICIO`. No se crean roles separados.
Role, Permission, Capability y Command son conceptos distintos.

## Agenda Preparation

Las fuentes identifican a Jefatura de Archivo y personal de Archivo designado como
actores operativos. SIMEF es sistema fuente, no actor autenticado. `AUTH-AP-001..003`
no crea roles ni asigna Role → Permission; Application autoriza por permission efectiva.
