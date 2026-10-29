-- Usuarios: correo y teléfono opcionales; username hasta 30 caracteres
-- (antes 10: usernames más largos daban error 500 al crear el usuario).
ALTER TABLE usuarios MODIFY COLUMN username VARCHAR(30) NOT NULL;
ALTER TABLE usuarios MODIFY COLUMN correo VARCHAR(50) NULL;
ALTER TABLE usuarios MODIFY COLUMN telefono VARCHAR(10) NULL;
