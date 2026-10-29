-- Asegura que el nivel Gerente tenga acceso a los servicios "Clientes" y
-- "Admin usuarios" (idempotente: se puede correr varias veces).
INSERT INTO accesos (servicio_id, nivel_id)
SELECT s.id, n.id
FROM servicios s
JOIN niveles_acceso n ON n.nombre = 'Gerente'
WHERE s.nombre IN ('Clientes', 'Admin usuarios')
  AND NOT EXISTS (
      SELECT 1 FROM accesos a WHERE a.servicio_id = s.id AND a.nivel_id = n.id
  );

-- Verificación:
SELECT s.nombre AS servicio, n.nombre AS nivel
FROM accesos a
JOIN servicios s ON s.id = a.servicio_id
JOIN niveles_acceso n ON n.id = a.nivel_id
WHERE n.nombre = 'Gerente' ORDER BY s.nombre;
