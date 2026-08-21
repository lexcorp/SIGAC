---
project: SIGAC
sdb_volume: 02-Business-Compliance
version: 0.1.0
status: Draft
---
# BIZ-018 — Privacy & Minimum Data
TO-BE almacena solo identificación y metadatos operativos necesarios. Excluir por defecto diagnósticos, notas, tratamientos, estudios y contenido clínico.

Agenda Preparation persiste sólo FOLIO, nombre, referencia de Expediente, tipo de
derechohabiente, primera vez/subsecuente, fecha, hora, médico/número de empleado y
Servicio/Especialidad. Contacto, vigencia, sexo, edad, CURP y datos asistenciales se
descartan antes de persistir. Archivo y filas raw sólo existen en staging transitorio.
