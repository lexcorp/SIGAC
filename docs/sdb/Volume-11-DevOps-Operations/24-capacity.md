# DO-024 — Capacity

DB growth, bloat, pools, disk, backups, queues, tenant workload.

Agenda import requiere upload limit, page limit, timeout y ventana de idempotencia
configurados. No hay defaults ilimitados ni números de negocio. La operación inicial es
síncrona; métricas reales decidirán si un perfil grande requiere worker.
