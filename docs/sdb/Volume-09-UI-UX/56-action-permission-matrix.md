---
project: SIGAC
sdb_volume: "09 - UI/UX & Design System"
version: "0.1.0"
status: "Draft for UX/UI validation"
date: "2026-08-13"
design_direction: "Clinical operational UI"
frontend: "React + TypeScript + Vite"
api_contract: "REST/OpenAPI /api/v1"
---
# INT-002 — Action / Permission Matrix

| Action | Archivista | Jefe | Auditor | Admin |
|---|---:|---:|---:|---:|
| Buscar expediente | ✓ | ✓ | read | policy |
| Iniciar búsqueda | ✓ | ✓ | — | — |
| Marcar localizado | ✓ | ✓ | — | — |
| Abrir préstamo | capability | capability | — | — |
| Recibir devolución | capability | capability | — | — |
| Resolver incidencia | conditional | ✓ | — | — |
| Ver auditoría | limited | ✓ | ✓ | conditional |
| Configurar catálogos | — | conditional | — | ✓ |

Esta matriz es UX preliminar; RBAC/ABAC del Volume 07 es autoridad.
