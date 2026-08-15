---
project: SIGAC
sdb_volume: "05 - Use Cases & Spec-Driven Development Specifications"
version: "0.2.0"
status: "Draft for use-case/spec validation"
date: "2026-08-14"
amended: "2026-08-14 — OQ-EW-001, OQ-EW-007, DEC-EW-STATE-001"
methodology:
  - Spec-Driven Development
  - Domain-Driven Design
  - Event Storming
  - Acceptance-Test-Driven Design
---
# UC-018 — Consultar Situación del Expediente

## Objetivo
Permitir a un usuario autorizado conocer la situación operativa actual de un expediente
físico: dónde está, quién lo tiene, desde cuándo y qué ocurrió.

## Read Model
- `expedienteNumero` (formato institucional con separador preferente `/`)
- referencia mínima del paciente (datos C3 — mínimo necesario para identificación operativa)
- `estadoOperativo` (uno de: DISPONIBLE, APARTADO, EN_TRASLADO, EN_CONSULTA,
  NO_LOCALIZADO, EXTRAVIADO — DEC-EW-STATE-001)
- ubicación actual
- custodia actual (tipo, referencia, `acceptedAt` si aplica)
- préstamo activo (si existe)
- solicitud activa (si existe)
- incidencias abiertas (si existen)
- historial de movimientos operativos relevantes (`MovimientoExpediente`)
- `capabilities[]` — acciones válidas para el actor actual en el estado actual

## Búsqueda por número (OQ-EW-001/007 RESOLVED)
- La búsqueda por `expedienteNumero` puede devolver **0, 1 ó N coincidencias**.
- Si N = 0: estado vacío descriptivo; no revelar información de otros tenants.
- Si N = 1: abrir el workspace directamente.
- Si N > 1: presentar lista de coincidencias con datos mínimos de desambiguación
  (nombre, CURP, número ISSSTE); **nunca** abrir automáticamente una coincidencia
  cuando existan varias (INV-EXP-003, BR-017).
- Se aceptan variantes de separador (`/`, `-`, sin separador) para búsqueda;
  la presentación usa `/` como forma preferente.

## UX principle
Debe responder rápidamente: dónde está, quién lo tiene, desde cuándo y qué puedo hacer.

## Non-goals
- No mostrar diagnósticos, notas clínicas, tratamientos ni estudios.
- No autorizar acceso al contenido clínico del expediente.

## Precondición
Actor autenticado con permiso `EXPEDIENT_VIEW` en el tenant resuelto server-side.

## Fuente
DDD-013, SPEC-009, BIZ-007, DECISION-REGISTER OQ-EW-001, OQ-EW-007, DEC-EW-STATE-001.
