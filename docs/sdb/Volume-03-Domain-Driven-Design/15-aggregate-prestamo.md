---
project: SIGAC
volume: 03-Domain-Driven-Design
version: 0.1.0
status: Draft
---
# DDD-015 — Aggregate Prestamo
Representa custodia temporal formal.
Datos: expediente, finalidad, solicitante, custodio, destino, inicio, fecha límite, renovaciones, estado y devolución.
El plazo de 24h se modelará como LoanDeadlinePolicy/configuración aplicable, no como constante universal.
