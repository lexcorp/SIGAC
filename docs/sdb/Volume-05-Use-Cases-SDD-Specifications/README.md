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
# Volume 05 — Use Cases & Spec-Driven Development Specifications

Este volumen transforma el dominio y los workflows de SIGAC en contratos funcionales implementables.

## Objetivo

Que una persona desarrolladora o un agente como Codex pueda tomar una spec y saber:

- qué problema resuelve;
- quién puede ejecutarla;
- qué datos necesita;
- qué precondiciones existen;
- cuál es el flujo principal;
- cuáles son las alternativas y excepciones;
- qué reglas del negocio aplican;
- qué eventos produce;
- qué criterios de aceptación debe satisfacer;
- qué NO debe implementar.

## Regla SDD

El código se deriva de una especificación aprobada.  
La especificación se deriva de dominio, workflow, reglas y evidencia.

No se implementan supuestos silenciosos.
