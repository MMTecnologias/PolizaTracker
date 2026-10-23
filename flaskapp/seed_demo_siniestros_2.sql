SET NAMES utf8mb4;
-- DATOS DE PRUEBA para Historial, Pagos y Plantillas. Se pueden correr varias veces.
-- Para borrar solo los siniestros cerrados y pagos de prueba:
--   DELETE FROM siniestro_pagos WHERE registrado_por IS NULL;
--   DELETE FROM siniestros WHERE creado_por IS NULL AND folio LIKE '%-C___';

-- 1) 36 siniestros cerrados (historial)
INSERT INTO siniestros (folio, proceso_id, poliza_id, aseguradora_id, estatus_id, fecha_apertura, fecha_limite, ultima_actualizacion, estado, fecha_cierre, resultado)
SELECT x.folio, pr.id, po.id, po.aseguradora_id,
       COALESCE((SELECT e.id FROM siniestro_estatus e WHERE e.proceso_id = pr.id AND e.es_final = 1 ORDER BY e.orden LIMIT 1),
                (SELECT e.id FROM siniestro_estatus e WHERE e.proceso_id = pr.id ORDER BY e.orden DESC LIMIT 1)),
       x.apertura,
       CASE x.clave WHEN 'PD' THEN x.apertura + INTERVAL 3 HOUR WHEN 'CIR' THEN x.apertura + INTERVAL 13 DAY WHEN 'REM' THEN x.apertura + INTERVAL 14 DAY
                    WHEN 'RA' THEN x.apertura + INTERVAL 14 DAY WHEN 'VI' THEN x.apertura + INTERVAL 21 DAY ELSE NULL END,
       x.cierre, 'Cerrado', x.cierre,
       CASE WHEN x.clave = 'SI' THEN 'Cerrado' WHEN x.clave = 'VI' AND MOD(x.n,7) = 0 THEN 'Rechazado' WHEN x.clave <> 'VI' AND MOD(x.n,9) = 0 THEN 'Rechazado' ELSE 'Procedente' END
FROM (
  SELECT n, ELT(1 + MOD(n,6), 'CIR','PD','REM','RA','SI','VI') AS clave,
         CONCAT(ELT(1 + MOD(n,6), 'CIR','PD','REM','RA','SI','VI'), '-2026-C', LPAD(n,3,'0')) AS folio,
         MOD(n*3,16) AS poliza_n,
         NOW() - INTERVAL (2 + n*4) DAY AS apertura,
         IF(MOD(n,6) = 1, NOW() - INTERVAL (2 + n*4) DAY + INTERVAL (1 + MOD(n*7,5)) HOUR,
                          NOW() - INTERVAL (2 + n*4) DAY + INTERVAL (3 + MOD(n*5,16)) DAY) AS cierre
  FROM (SELECT a.n + b.n*10 + 1 AS n FROM (SELECT 0 n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) a,
                                          (SELECT 0 n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3) b) nn
  WHERE n <= 36
) x
JOIN siniestro_procesos pr ON pr.clave = x.clave
JOIN (SELECT id, aseguradora_id, ROW_NUMBER() OVER (ORDER BY id) - 1 AS n
      FROM (SELECT id, aseguradora_id FROM polizas WHERE status = 'Vigente' ORDER BY id LIMIT 16) p) po ON po.n = x.poliza_n
WHERE NOT EXISTS (SELECT 1 FROM siniestros s WHERE s.folio = x.folio);

-- 2) Pagos de prueba: uno por siniestro cerrado procedente y por 1 de cada 3 activos
INSERT INTO siniestro_pagos (siniestro_id, fecha_pago, concepto, monto, beneficiario, estado, motivo_cancelacion, comprobante)
SELECT s.id, DATE(COALESCE(s.fecha_cierre, s.ultima_actualizacion)),
       ELT(1 + MOD(s.id,5), 'Pago a hospital','Reembolso al asegurado','Indemnización','Pago a beneficiario','Honorarios médicos'),
       4000 + MOD(s.id * 7919, 180000),
       IF(pr.clave = 'VI', 'Beneficiario de prueba', NULL),
       IF(MOD(s.id,11) = 0, 'Cancelado', 'Vigente'),
       IF(MOD(s.id,11) = 0, 'Captura duplicada', NULL),
       IF(MOD(s.id,4) = 0, NULL, 'comprobante_demo.pdf')
FROM siniestros s JOIN siniestro_procesos pr ON pr.id = s.proceso_id
WHERE ((s.estado = 'Cerrado' AND s.resultado = 'Procedente') OR (s.estado = 'Activo' AND MOD(s.id,3) = 0))
  AND NOT EXISTS (SELECT 1 FROM siniestro_pagos p WHERE p.siniestro_id = s.id);

-- 3) Plantillas de requisitos de prueba: cada tipo (excepto SI) x las 3 primeras aseguradoras
INSERT IGNORE INTO siniestro_plantillas_req (proceso_id, aseguradora_id, tipo_id)
SELECT t.proceso_id, a.id, t.id
FROM siniestro_tipos t JOIN siniestro_procesos p ON p.id = t.proceso_id AND p.clave <> 'SI'
JOIN (SELECT id FROM aseguradoras ORDER BY id LIMIT 3) a;

INSERT INTO siniestro_plantilla_items (plantilla_id, nombre, obligatorio, orden)
SELECT pl.id, rc.nombre, IF(rc.nombre IN ('Receta médica','Carta de no complicaciones'), 0, 1), rc.id
FROM siniestro_plantillas_req pl
JOIN siniestro_procesos p ON p.id = pl.proceso_id
JOIN siniestro_requisitos_cat rc ON
     (p.clave = 'VI'  AND rc.nombre IN ('Acta de defunción','Acta de nacimiento del beneficiario','Identificación oficial','Estado de cuenta bancario'))
  OR (p.clave = 'RA'  AND rc.nombre IN ('Acta de hechos','Peritaje','Identificación oficial','Facturas originales'))
  OR (p.clave NOT IN ('VI','RA') AND rc.nombre IN ('Informe médico','Facturas originales','Identificación oficial','Estado de cuenta bancario','Receta médica'))
WHERE NOT EXISTS (SELECT 1 FROM siniestro_plantilla_items i WHERE i.plantilla_id = pl.id);

SELECT (SELECT COUNT(*) FROM siniestros WHERE estado='Cerrado') cerrados, (SELECT COUNT(*) FROM siniestro_pagos) pagos,
       (SELECT COUNT(*) FROM siniestro_plantillas_req) plantillas;
