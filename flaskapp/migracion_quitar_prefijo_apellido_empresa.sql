-- Quita el prefijo "// " que se agregaba históricamente al campo
-- `apellido` de los clientes persona moral (sexo = 'Empresa'). Ese
-- campo no debería tener nada para una empresa, ya que el nombre
-- completo (razón social) vive en `nombre`.
--
-- Ejecutar una sola vez, después de desplegar el código que ya deja
-- de escribir ese prefijo.

UPDATE clientes
SET apellido = ''
WHERE sexo = 'Empresa'
  AND apellido LIKE '// %';

-- Por si algún registro quedó con el prefijo pero sin el espacio, o
-- con espacios extra alrededor:
UPDATE clientes
SET apellido = TRIM(SUBSTRING(apellido, 3))
WHERE sexo = 'Empresa'
  AND apellido LIKE '//%'
  AND apellido NOT LIKE '// %';
