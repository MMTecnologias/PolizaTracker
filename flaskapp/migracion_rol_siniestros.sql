-- ============================================================
-- Rol "Siniestros" (nivel 5) y servicio "Siniestros"
-- Se puede correr más de una vez sin duplicar nada.
-- Correr en MySQL Workbench sobre la base `ggsys` ANTES de
-- levantar la rama `siniestros`.
-- ============================================================

-- 1) Nuevo nivel de acceso (el id 5 debe coincidir con el
--    <option value="5"> del formulario de usuarios)
INSERT INTO niveles_acceso (id, nombre)
SELECT 5, 'Siniestros' FROM DUAL
WHERE NOT EXISTS (
    SELECT 1 FROM niveles_acceso WHERE id = 5 OR nombre = 'Siniestros'
);

-- 2) Nuevo servicio
INSERT INTO servicios (nombre)
SELECT 'Siniestros' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM servicios WHERE nombre = 'Siniestros');

-- 3) Accesos
--    - Servicio "Siniestros": rol Siniestros, Desarollador y Gerente
--    - Servicio "Clientes": rol Siniestros (la pantalla de Clientes
--      valida este servicio)
--    (la tabla accesos no tiene llave primaria, por eso se valida con
--    NOT EXISTS en lugar de INSERT IGNORE)
INSERT INTO accesos (servicio_id, nivel_id)
SELECT s.id, n.id
FROM servicios s
JOIN niveles_acceso n
WHERE ((s.nombre = 'Siniestros' AND n.nombre IN ('Siniestros', 'Desarollador', 'Gerente'))
    OR (s.nombre = 'Clientes'   AND n.nombre = 'Siniestros'))
  AND NOT EXISTS (
      SELECT 1 FROM accesos a
      WHERE a.servicio_id = s.id AND a.nivel_id = n.id
  );

-- 4) Verificación: debe devolver 4 filas
SELECT s.nombre AS servicio, n.nombre AS nivel
FROM accesos a
JOIN servicios s ON s.id = a.servicio_id
JOIN niveles_acceso n ON n.id = a.nivel_id
WHERE n.nombre = 'Siniestros' OR s.nombre = 'Siniestros'
ORDER BY s.nombre, n.nombre;
