-- Observaciones (notas) de 400 a 2000 caracteres en pólizas y endosos.
ALTER TABLE polizas MODIFY COLUMN notas VARCHAR(2000) NULL;
ALTER TABLE endosos MODIFY COLUMN notas VARCHAR(2000) NULL;
