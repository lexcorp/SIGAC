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
# INT-003 — API ↔ UI Mapping

| UI Intent | API candidate |
|---|---|
| Abrir expediente | GET /expedientes/{id} |
| Ver trayectoria | GET /expedientes/{id}/timeline |
| Crear solicitud | POST /solicitudes |
| Asignar | POST /solicitudes/{id}/assign |
| Iniciar búsqueda | POST /solicitudes/{id}/start-search |
| Localizado | POST /solicitudes/{id}/mark-located |
| No localizado | POST /solicitudes/{id}/mark-not-located |
| Abrir préstamo | POST /prestamos |
| Renovar | POST /prestamos/{id}/renew |
| Recibir devolución | POST /devoluciones |
| Abrir incidencia | POST /incidencias |
| Importar agenda | POST /agenda-imports |
