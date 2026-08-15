---
project: SIGAC
sdb_volume: "05 - Use Cases & Spec-Driven Development Specifications"
version: "0.1.0"
status: "Draft for use-case/spec validation"
date: "2026-08-13"
methodology:
  - Spec-Driven Development
  - Domain-Driven Design
  - Event Storming
  - Acceptance-Test-Driven Design
---
# UC-001 — Importar Agenda

## Objetivo
Ingresar a SIGAC una versión de la agenda/demanda para preparar expedientes.

## Actor
Jefatura de Archivo o rol autorizado.

## Precondiciones
- usuario autenticado;
- hospital/tenant resuelto;
- archivo/formato soportado.

## Flujo principal
1. Actor selecciona archivo.
2. Sistema valida estructura.
3. Calcula fingerprint.
4. Registra versión.
5. Traduce registros a demanda.
6. Identifica duplicados.
7. Crea/actualiza JornadaPreparacion.
8. Publica AgendaImported.

## Alternos
- mismo archivo ya importado → no duplicar;
- filas inválidas → reportar;
- agenda parcial → marcar advertencia.

## Acceptance
Given una agenda válida no importada
When el usuario la importa
Then se registra una única versión
And se crean ítems de demanda sin duplicados.
