-- T-BUG-VA-001 / Vale Archivo — Unicidad de numero_vale por tenant
--
-- Agrega UNIQUE constraint sobre numero_vale en vale_archivo.
-- Coherente con ADR-0034: la unicidad es por tenant porque las tablas
-- viven en la base de datos del tenant (database-per-tenant).
-- Dos tenants distintos pueden tener el mismo numero_vale sin conflicto.
--
-- Esta es la última línea de defensa de la base de datos contra duplicados
-- concurrentes (dos requests simultáneos con el mismo numero_vale).
-- La primera línea es el check previo en RegistrarVale.execute().

ALTER TABLE "vale_archivo"
  ADD CONSTRAINT "vale_archivo_numero_vale_unique" UNIQUE ("numero_vale");
