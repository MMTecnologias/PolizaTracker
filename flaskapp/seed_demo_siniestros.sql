SET NAMES utf8mb4;
-- =====================================================================
-- DATOS DE PRUEBA para la Tabla de Siniestros (solo para ver la pantalla).
-- Usa las primeras pólizas vigentes que existan. Idempotente.
-- Antes de correrlo:  USE ggsystem;
-- Para BORRAR estos datos de prueba después:
--     DELETE FROM siniestros WHERE creado_por IS NULL;
-- =====================================================================

INSERT INTO siniestros (folio, proceso_id, poliza_id, aseguradora_id, estatus_id, fecha_apertura, fecha_limite, ultima_actualizacion, estado)
SELECT 'CIR-2026-10-904', pr.id, po.id, po.aseguradora_id, es.id, NOW() - INTERVAL 21 DAY, NOW() + INTERVAL -96 HOUR, NOW() - INTERVAL 5 DAY, 'Activo'
FROM siniestro_procesos pr
JOIN siniestro_estatus es ON es.proceso_id = pr.id AND es.nombre = 'Enviado a aseguradora'
JOIN (SELECT id, aseguradora_id FROM polizas WHERE status = 'Vigente' ORDER BY id LIMIT 1 OFFSET 0) po
WHERE pr.clave = 'CIR' AND NOT EXISTS (SELECT 1 FROM siniestros x WHERE x.folio = 'CIR-2026-10-904');

INSERT INTO siniestros (folio, proceso_id, poliza_id, aseguradora_id, estatus_id, fecha_apertura, fecha_limite, ultima_actualizacion, estado)
SELECT 'REM-2026-09-917', pr.id, po.id, po.aseguradora_id, es.id, NOW() - INTERVAL 25 DAY, NOW() + INTERVAL -48 HOUR, NOW() - INTERVAL 6 DAY, 'Activo'
FROM siniestro_procesos pr
JOIN siniestro_estatus es ON es.proceso_id = pr.id AND es.nombre = 'Documentación incompleta'
JOIN (SELECT id, aseguradora_id FROM polizas WHERE status = 'Vigente' ORDER BY id LIMIT 1 OFFSET 1) po
WHERE pr.clave = 'REM' AND NOT EXISTS (SELECT 1 FROM siniestros x WHERE x.folio = 'REM-2026-09-917');

INSERT INTO siniestros (folio, proceso_id, poliza_id, aseguradora_id, estatus_id, fecha_apertura, fecha_limite, ultima_actualizacion, estado)
SELECT 'PD-2026-10-911', pr.id, po.id, po.aseguradora_id, es.id, NOW() - INTERVAL 14 DAY, NOW() + INTERVAL -24 HOUR, NOW() - INTERVAL 1 DAY, 'Activo'
FROM siniestro_procesos pr
JOIN siniestro_estatus es ON es.proceso_id = pr.id AND es.nombre = 'Entregado en hospital'
JOIN (SELECT id, aseguradora_id FROM polizas WHERE status = 'Vigente' ORDER BY id LIMIT 1 OFFSET 2) po
WHERE pr.clave = 'PD' AND NOT EXISTS (SELECT 1 FROM siniestros x WHERE x.folio = 'PD-2026-10-911');

INSERT INTO siniestros (folio, proceso_id, poliza_id, aseguradora_id, estatus_id, fecha_apertura, fecha_limite, ultima_actualizacion, estado)
SELECT 'PD-2026-10-916', pr.id, po.id, po.aseguradora_id, es.id, NOW() - INTERVAL 2 DAY, NOW() + INTERVAL 2 HOUR, NOW() - INTERVAL 0 DAY, 'Activo'
FROM siniestro_procesos pr
JOIN siniestro_estatus es ON es.proceso_id = pr.id AND es.nombre = 'Dictamen autorizado'
JOIN (SELECT id, aseguradora_id FROM polizas WHERE status = 'Vigente' ORDER BY id LIMIT 1 OFFSET 3) po
WHERE pr.clave = 'PD' AND NOT EXISTS (SELECT 1 FROM siniestros x WHERE x.folio = 'PD-2026-10-916');

INSERT INTO siniestros (folio, proceso_id, poliza_id, aseguradora_id, estatus_id, fecha_apertura, fecha_limite, ultima_actualizacion, estado)
SELECT 'CIR-2026-10-909', pr.id, po.id, po.aseguradora_id, es.id, NOW() - INTERVAL 18 DAY, NOW() + INTERVAL 24 HOUR, NOW() - INTERVAL 4 DAY, 'Activo'
FROM siniestro_procesos pr
JOIN siniestro_estatus es ON es.proceso_id = pr.id AND es.nombre = 'Documentación completa'
JOIN (SELECT id, aseguradora_id FROM polizas WHERE status = 'Vigente' ORDER BY id LIMIT 1 OFFSET 4) po
WHERE pr.clave = 'CIR' AND NOT EXISTS (SELECT 1 FROM siniestros x WHERE x.folio = 'CIR-2026-10-909');

INSERT INTO siniestros (folio, proceso_id, poliza_id, aseguradora_id, estatus_id, fecha_apertura, fecha_limite, ultima_actualizacion, estado)
SELECT 'REM-2026-10-921', pr.id, po.id, po.aseguradora_id, es.id, NOW() - INTERVAL 15 DAY, NOW() + INTERVAL 48 HOUR, NOW() - INTERVAL 0 DAY, 'Activo'
FROM siniestro_procesos pr
JOIN siniestro_estatus es ON es.proceso_id = pr.id AND es.nombre = 'Enviado a aseguradora'
JOIN (SELECT id, aseguradora_id FROM polizas WHERE status = 'Vigente' ORDER BY id LIMIT 1 OFFSET 5) po
WHERE pr.clave = 'REM' AND NOT EXISTS (SELECT 1 FROM siniestros x WHERE x.folio = 'REM-2026-10-921');

INSERT INTO siniestros (folio, proceso_id, poliza_id, aseguradora_id, estatus_id, fecha_apertura, fecha_limite, ultima_actualizacion, estado)
SELECT 'RA-2026-10-906', pr.id, po.id, po.aseguradora_id, es.id, NOW() - INTERVAL 13 DAY, NOW() + INTERVAL 72 HOUR, NOW() - INTERVAL 2 DAY, 'Activo'
FROM siniestro_procesos pr
JOIN siniestro_estatus es ON es.proceso_id = pr.id AND es.nombre = 'En seguimiento'
JOIN (SELECT id, aseguradora_id FROM polizas WHERE status = 'Vigente' ORDER BY id LIMIT 1 OFFSET 6) po
WHERE pr.clave = 'RA' AND NOT EXISTS (SELECT 1 FROM siniestros x WHERE x.folio = 'RA-2026-10-906');

INSERT INTO siniestros (folio, proceso_id, poliza_id, aseguradora_id, estatus_id, fecha_apertura, fecha_limite, ultima_actualizacion, estado)
SELECT 'PD-2026-10-914', pr.id, po.id, po.aseguradora_id, es.id, NOW() - INTERVAL 9 DAY, NOW() + INTERVAL 70 HOUR, NOW() - INTERVAL 0 DAY, 'Activo'
FROM siniestro_procesos pr
JOIN siniestro_estatus es ON es.proceso_id = pr.id AND es.nombre = 'Documentación recibida'
JOIN (SELECT id, aseguradora_id FROM polizas WHERE status = 'Vigente' ORDER BY id LIMIT 1 OFFSET 7) po
WHERE pr.clave = 'PD' AND NOT EXISTS (SELECT 1 FROM siniestros x WHERE x.folio = 'PD-2026-10-914');

INSERT INTO siniestros (folio, proceso_id, poliza_id, aseguradora_id, estatus_id, fecha_apertura, fecha_limite, ultima_actualizacion, estado)
SELECT 'PD-2026-10-908', pr.id, po.id, po.aseguradora_id, es.id, NOW() - INTERVAL 20 DAY, NOW() + INTERVAL 150 HOUR, NOW() - INTERVAL 0 DAY, 'Activo'
FROM siniestro_procesos pr
JOIN siniestro_estatus es ON es.proceso_id = pr.id AND es.nombre = 'Entregado en hospital'
JOIN (SELECT id, aseguradora_id FROM polizas WHERE status = 'Vigente' ORDER BY id LIMIT 1 OFFSET 8) po
WHERE pr.clave = 'PD' AND NOT EXISTS (SELECT 1 FROM siniestros x WHERE x.folio = 'PD-2026-10-908');

INSERT INTO siniestros (folio, proceso_id, poliza_id, aseguradora_id, estatus_id, fecha_apertura, fecha_limite, ultima_actualizacion, estado)
SELECT 'CIR-2026-10-912', pr.id, po.id, po.aseguradora_id, es.id, NOW() - INTERVAL 8 DAY, NOW() + INTERVAL 170 HOUR, NOW() - INTERVAL 1 DAY, 'Activo'
FROM siniestro_procesos pr
JOIN siniestro_estatus es ON es.proceso_id = pr.id AND es.nombre = 'Documentación recibida'
JOIN (SELECT id, aseguradora_id FROM polizas WHERE status = 'Vigente' ORDER BY id LIMIT 1 OFFSET 8) po
WHERE pr.clave = 'CIR' AND NOT EXISTS (SELECT 1 FROM siniestros x WHERE x.folio = 'CIR-2026-10-912');

INSERT INTO siniestros (folio, proceso_id, poliza_id, aseguradora_id, estatus_id, fecha_apertura, fecha_limite, ultima_actualizacion, estado)
SELECT 'REM-2026-10-926', pr.id, po.id, po.aseguradora_id, es.id, NOW() - INTERVAL 5 DAY, NOW() + INTERVAL 190 HOUR, NOW() - INTERVAL 3 DAY, 'Activo'
FROM siniestro_procesos pr
JOIN siniestro_estatus es ON es.proceso_id = pr.id AND es.nombre = 'Requisitos enviados'
JOIN (SELECT id, aseguradora_id FROM polizas WHERE status = 'Vigente' ORDER BY id LIMIT 1 OFFSET 8) po
WHERE pr.clave = 'REM' AND NOT EXISTS (SELECT 1 FROM siniestros x WHERE x.folio = 'REM-2026-10-926');

INSERT INTO siniestros (folio, proceso_id, poliza_id, aseguradora_id, estatus_id, fecha_apertura, fecha_limite, ultima_actualizacion, estado)
SELECT 'REM-2026-10-925', pr.id, po.id, po.aseguradora_id, es.id, NOW() - INTERVAL 4 DAY, NOW() + INTERVAL 210 HOUR, NOW() - INTERVAL 0 DAY, 'Activo'
FROM siniestro_procesos pr
JOIN siniestro_estatus es ON es.proceso_id = pr.id AND es.nombre = 'Documentación incompleta'
JOIN (SELECT id, aseguradora_id FROM polizas WHERE status = 'Vigente' ORDER BY id LIMIT 1 OFFSET 8) po
WHERE pr.clave = 'REM' AND NOT EXISTS (SELECT 1 FROM siniestros x WHERE x.folio = 'REM-2026-10-925');

INSERT INTO siniestros (folio, proceso_id, poliza_id, aseguradora_id, estatus_id, fecha_apertura, fecha_limite, ultima_actualizacion, estado)
SELECT 'CIR-2026-09-920', pr.id, po.id, po.aseguradora_id, es.id, NOW() - INTERVAL 23 DAY, NOW() + INTERVAL 80 HOUR, NOW() - INTERVAL 0 DAY, 'Activo'
FROM siniestro_procesos pr
JOIN siniestro_estatus es ON es.proceso_id = pr.id AND es.nombre = 'Folio registrado'
JOIN (SELECT id, aseguradora_id FROM polizas WHERE status = 'Vigente' ORDER BY id LIMIT 1 OFFSET 9) po
WHERE pr.clave = 'CIR' AND NOT EXISTS (SELECT 1 FROM siniestros x WHERE x.folio = 'CIR-2026-09-920');

INSERT INTO siniestros (folio, proceso_id, poliza_id, aseguradora_id, estatus_id, fecha_apertura, fecha_limite, ultima_actualizacion, estado)
SELECT 'REM-2026-10-924', pr.id, po.id, po.aseguradora_id, es.id, NOW() - INTERVAL 6 DAY, NOW() + INTERVAL 200 HOUR, NOW() - INTERVAL 8 DAY, 'Activo'
FROM siniestro_procesos pr
JOIN siniestro_estatus es ON es.proceso_id = pr.id AND es.nombre = 'Enviado a aseguradora'
JOIN (SELECT id, aseguradora_id FROM polizas WHERE status = 'Vigente' ORDER BY id LIMIT 1 OFFSET 10) po
WHERE pr.clave = 'REM' AND NOT EXISTS (SELECT 1 FROM siniestros x WHERE x.folio = 'REM-2026-10-924');

INSERT INTO siniestros (folio, proceso_id, poliza_id, aseguradora_id, estatus_id, fecha_apertura, fecha_limite, ultima_actualizacion, estado)
SELECT 'REM-2026-09-909', pr.id, po.id, po.aseguradora_id, es.id, NOW() - INTERVAL 28 DAY, NOW() + INTERVAL 120 HOUR, NOW() - INTERVAL 0 DAY, 'Activo'
FROM siniestro_procesos pr
JOIN siniestro_estatus es ON es.proceso_id = pr.id AND es.nombre = 'Reembolso capturado'
JOIN (SELECT id, aseguradora_id FROM polizas WHERE status = 'Vigente' ORDER BY id LIMIT 1 OFFSET 11) po
WHERE pr.clave = 'REM' AND NOT EXISTS (SELECT 1 FROM siniestros x WHERE x.folio = 'REM-2026-09-909');

INSERT INTO siniestros (folio, proceso_id, poliza_id, aseguradora_id, estatus_id, fecha_apertura, fecha_limite, ultima_actualizacion, estado)
SELECT 'SI-2026-10-903', pr.id, po.id, po.aseguradora_id, es.id, NOW() - INTERVAL 19 DAY, NULL, NOW() - INTERVAL 0 DAY, 'Activo'
FROM siniestro_procesos pr
JOIN siniestro_estatus es ON es.proceso_id = pr.id AND es.nombre = 'Enviado a aseguradora'
JOIN (SELECT id, aseguradora_id FROM polizas WHERE status = 'Vigente' ORDER BY id LIMIT 1 OFFSET 6) po
WHERE pr.clave = 'SI' AND NOT EXISTS (SELECT 1 FROM siniestros x WHERE x.folio = 'SI-2026-10-903');

INSERT INTO siniestros (folio, proceso_id, poliza_id, aseguradora_id, estatus_id, fecha_apertura, fecha_limite, ultima_actualizacion, estado)
SELECT 'SI-2026-10-907', pr.id, po.id, po.aseguradora_id, es.id, NOW() - INTERVAL 11 DAY, NULL, NOW() - INTERVAL 0 DAY, 'Activo'
FROM siniestro_procesos pr
JOIN siniestro_estatus es ON es.proceso_id = pr.id AND es.nombre = 'Registrado'
JOIN (SELECT id, aseguradora_id FROM polizas WHERE status = 'Vigente' ORDER BY id LIMIT 1 OFFSET 12) po
WHERE pr.clave = 'SI' AND NOT EXISTS (SELECT 1 FROM siniestros x WHERE x.folio = 'SI-2026-10-907');

INSERT INTO siniestros (folio, proceso_id, poliza_id, aseguradora_id, estatus_id, fecha_apertura, fecha_limite, ultima_actualizacion, estado)
SELECT 'RA-2026-10-901', pr.id, po.id, po.aseguradora_id, es.id, NOW() - INTERVAL 22 DAY, NULL, NOW() - INTERVAL 9 DAY, 'Activo'
FROM siniestro_procesos pr
JOIN siniestro_estatus es ON es.proceso_id = pr.id AND es.nombre = 'Integración de expediente'
JOIN (SELECT id, aseguradora_id FROM polizas WHERE status = 'Vigente' ORDER BY id LIMIT 1 OFFSET 13) po
WHERE pr.clave = 'RA' AND NOT EXISTS (SELECT 1 FROM siniestros x WHERE x.folio = 'RA-2026-10-901');

INSERT INTO siniestros (folio, proceso_id, poliza_id, aseguradora_id, estatus_id, fecha_apertura, fecha_limite, ultima_actualizacion, estado)
SELECT 'VI-2026-10-901', pr.id, po.id, po.aseguradora_id, es.id, NOW() - INTERVAL 8 DAY, NULL, NOW() - INTERVAL 0 DAY, 'Activo'
FROM siniestro_procesos pr
JOIN siniestro_estatus es ON es.proceso_id = pr.id AND es.nombre = 'Revisión de documentos'
JOIN (SELECT id, aseguradora_id FROM polizas WHERE status = 'Vigente' ORDER BY id LIMIT 1 OFFSET 14) po
WHERE pr.clave = 'VI' AND NOT EXISTS (SELECT 1 FROM siniestros x WHERE x.folio = 'VI-2026-10-901');

INSERT INTO siniestros (folio, proceso_id, poliza_id, aseguradora_id, estatus_id, fecha_apertura, fecha_limite, ultima_actualizacion, estado)
SELECT 'VI-2026-10-902', pr.id, po.id, po.aseguradora_id, es.id, NOW() - INTERVAL 4 DAY, NULL, NOW() - INTERVAL 1 DAY, 'Activo'
FROM siniestro_procesos pr
JOIN siniestro_estatus es ON es.proceso_id = pr.id AND es.nombre = 'Presentada a aseguradora'
JOIN (SELECT id, aseguradora_id FROM polizas WHERE status = 'Vigente' ORDER BY id LIMIT 1 OFFSET 15) po
WHERE pr.clave = 'VI' AND NOT EXISTS (SELECT 1 FROM siniestros x WHERE x.folio = 'VI-2026-10-902');

-- Relaciones de derivación
UPDATE siniestros h JOIN siniestros o ON o.folio = 'SI-2026-10-903' SET h.origen_id = o.id WHERE h.folio = 'RA-2026-10-906';
UPDATE siniestros h JOIN siniestros o ON o.folio = 'PD-2026-10-908' SET h.origen_id = o.id WHERE h.folio = 'CIR-2026-10-912';
UPDATE siniestros h JOIN siniestros o ON o.folio = 'PD-2026-10-908' SET h.origen_id = o.id WHERE h.folio = 'REM-2026-10-926';
UPDATE siniestros h JOIN siniestros o ON o.folio = 'CIR-2026-10-912' SET h.origen_id = o.id WHERE h.folio = 'REM-2026-10-925';

SELECT COUNT(*) AS siniestros_de_prueba FROM siniestros WHERE creado_por IS NULL;
