-- ============================================================
-- Migración: permite que grupo_id quede vacío (NULL) en clientes
-- Necesario antes de correr el script que limpia el grupo "General".
-- Correr una sola vez, en MySQL Workbench o la terminal de mysql.
-- ============================================================

ALTER TABLE clientes MODIFY grupo_id INT NULL;
