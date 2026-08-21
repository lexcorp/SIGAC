# DO-016 — Logging

Structured, no debug prod by default, no secrets/tokens/patient payloads.

Agenda import logging tampoco incluye filename cliente, fingerprint, FOLIO, fila raw,
nombre, Expediente ni otros identificadores personales. La disposición reporta sólo
conteos y éxito/fallo sanitizados.
