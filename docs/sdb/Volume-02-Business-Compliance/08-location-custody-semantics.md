---
project: SIGAC
sdb_volume: 02-Business-Compliance
version: 0.2.0
status: Draft
amended: "2026-08-14 — OQ-EW-006 RESOLVED, DEC-EW-STATE-001"
---
# BIZ-008 — Location & Custody

## Definiciones
- **Ubicación:** dónde está registrado el expediente (anaquel, zona temporal, carrito, consultorio,
  servicio u otra ubicación institucional).
- **Custodia:** quién responde operativamente por el expediente.
  `Custodia ≠ permiso de acceso ≠ propiedad`.

## Distinción despacho / transporte / aceptación de custodia (OQ-EW-006 RESOLVED)

El traslado de expedientes al área/consultorio involucra tres momentos operativos distintos
que **no** deben fusionarse:

### 1. Despacho (`ExpedienteDispatched`)
El archivista/mensajero retira el expediente de Archivo Clínico para llevarlo al destino.
- El expediente pasa a `EstadoOperativo = EN_TRASLADO`.
- La custodia sigue siendo de Archivo hasta que el receptor confirme recepción.
- El mensajero porta la hoja diaria junto con los expedientes.

### 2. Transporte
El mensajero está en tránsito con los expedientes. No es un evento de dominio por sí solo;
el expediente permanece `EN_TRASLADO`.

### 3. Aceptación de custodia (`CustodyAccepted`)
El receptor autorizado en el destino (Enfermería o médico/solicitante) confirma la recepción.
- El expediente pasa a `EstadoOperativo = EN_CONSULTA`.
- La custodia externa queda formalmente registrada.
- La confirmación digital es una acción autenticada y auditable; **no** implica firma
  electrónica criptográfica en este slice.

### Retorno
- El mensajero regresa con los expedientes que Enfermería le entrega.
- La lista se descarga/raya al retorno (proceso AS-IS); el TO-BE lo convierte en
  `ReturnReceived` + verificación + rearchivo.

## Regla TO-BE
Toda transferencia relevante registra: origen, destino, actor que entrega, receptor,
fecha/hora y finalidad.
Fuente: SRC-INT-002, SRC-INT-003, DECISION-REGISTER OQ-EW-006.
