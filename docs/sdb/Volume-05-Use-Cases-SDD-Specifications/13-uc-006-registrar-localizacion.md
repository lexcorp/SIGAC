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
# UC-006 — Registrar Localización

## Objetivo
Confirmar que el expediente fue físicamente localizado.

## Flujo
1. Identificar expediente.
2. Validar coincidencia.
3. Registrar ubicación real.
4. Detectar divergencia con ubicación registrada.
5. Marcar solicitud Localizada.
6. Emitir ExpedienteLocated.
7. Si hubo divergencia, registrar movimiento/corrección.

## Acceptance
Given expediente esperado en A y encontrado en B
When se marca localizado
Then la localización se registra en B
And no se pierde evidencia de la discrepancia.
