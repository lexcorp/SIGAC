---
project: SIGAC
sdb_volume: "07 - Security & Privacy"
version: "0.1.0"
status: "Draft for security/privacy validation"
date: "2026-08-13"
baseline:
  - OWASP ASVS 5.0
  - OWASP Top 10 2025
  - NIST SP 800-207
  - LGPDPPSO vigente
  - NOM-004-SSA3-2012
---
# SEC-011 — Retention & Deletion

No existe una única política de retención para todos los datos SIGAC.

Separar:
- expediente físico;
- metadatos operativos;
- movimientos;
- auditoría;
- logs técnicos;
- importaciones/staging;
- archivos temporales;
- backups.

Cada categoría tendrá owner, finalidad, plazo y mecanismo de disposición.

Nunca reutilizar la regla de conservación del expediente clínico como plazo automático para todos los logs.

Agenda Preparation: archivo/fila raw sólo durante procesamiento/aborto, con máximo
técnico configurable y eliminación del almacenamiento activo al outcome terminal.
ImportacionAgenda/registro minimizado usa retención operacional configurable para
trazabilidad; Agenda/Cita histórica tiene política distinta. No hay plazo numérico
aprobado ni default indefinido. Backups expiran bajo su propia política.
