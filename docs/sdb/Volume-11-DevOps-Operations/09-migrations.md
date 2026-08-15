# DO-009 — Migrations

Control DB then tenant registry, migrate with status/retry/report/health.

El registry de schemas tenant puede componerse desde módulos propietarios. T-10 conserva
su migración inicial; Security / Audit publica después la migración tenant de audit_log
y mantiene ownership. El runner la aplica a cada database tenant con status/retry; no
se crea una tabla audit global como sustituto del audit transaccional local.
