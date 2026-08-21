# TQ-008 — Security Testing

Auth/authz, IDOR/BOLA, privilege escalation, session, upload, injection, XSS/CSRF, logs sensibles, admin, cross-tenant.

Para Agenda Preparation verificar que RequestContext se resuelve antes de generar
`ImportAttemptId`, `AGENDA_IMPORT` se valida antes de leer el upload, tenant no procede
de body/query/filename/archivo y audit/telemetría no contienen datos personales ni raw.
Los casos cross-tenant no exponen existencia ni crean códigos `CROSS_TENANT_*`.

RAW-AP-001..012 exige pruebas de staging tenant-namespaced/protegido, least privilege,
eliminación tras outcomes terminales, ausencia de vista/descarga raw, allow-list durable
y evidencia mínima incapaz de reconstruir el archivo.
