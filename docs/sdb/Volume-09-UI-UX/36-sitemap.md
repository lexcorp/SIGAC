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
# IA-001 — Sitemap

```mermaid
flowchart TD
 D[Dashboard]
 E[Expedientes]
 S[Solicitudes]
 P[Preparación]
 L[Préstamos]
 R[Devoluciones]
 I[Incidencias]
 U[Ubicaciones]
 REP[Reportes]
 A[Administración]
 D --> E
 E --> EW[Expediente Workspace]
 S --> EW
 P --> EW
 L --> EW
 R --> EW
 I --> EW
```
