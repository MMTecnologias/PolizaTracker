-- Catálogo de estatus según los chats de cada proceso (RA, VIDA, Siniestro Inicial)
-- y estatus nuevos para medir plazos e incidencias (PD y CIR). No se borra nada:
-- los estatus en uso se renombran para conservar su historial.
SET SQL_SAFE_UPDATES = 0;

-- ============ Reembolso Autos Daños (RA) ============
UPDATE siniestro_estatus SET nombre='Siniestro registrado', tipo='otro', orden=101 WHERE proceso_id=(SELECT id FROM siniestro_procesos WHERE clave='RA') AND nombre='Registrado';
UPDATE siniestro_estatus SET nombre='Requisitos enviados', tipo='pendiente', orden=102 WHERE proceso_id=(SELECT id FROM siniestro_procesos WHERE clave='RA') AND nombre='Integración de expediente';
UPDATE siniestro_estatus SET nombre='Documentación enviada', tipo='aseguradora', orden=104 WHERE proceso_id=(SELECT id FROM siniestro_procesos WHERE clave='RA') AND nombre='Enviado a aseguradora';
UPDATE siniestro_estatus SET nombre='Finiquito firmado, en espera de pago', tipo='aseguradora', orden=109 WHERE proceso_id=(SELECT id FROM siniestro_procesos WHERE clave='RA') AND nombre='En seguimiento';
UPDATE siniestro_estatus SET orden=113 WHERE proceso_id=(SELECT id FROM siniestro_procesos WHERE clave='RA') AND nombre='Cerrado';
UPDATE siniestro_estatus SET orden=114 WHERE proceso_id=(SELECT id FROM siniestro_procesos WHERE clave='RA') AND nombre='Reabierto';
INSERT IGNORE INTO siniestro_estatus (proceso_id,orden,nombre,descripcion,tipo,es_final) SELECT p.id,x.o,x.n,x.d,x.t,0 FROM siniestro_procesos p JOIN (
  SELECT 103 o,'Documentación incompleta' n,'Documentación incompleta, solicitud de correcciones enviada' d,'pendiente' t UNION ALL
  SELECT 105,'Finiquito validado','Finiquito validado, listo para enviar al asegurado','otro' UNION ALL
  SELECT 106,'Finiquito con errores','Finiquito con errores, en solicitud de ajustes','aseguradora' UNION ALL
  SELECT 107,'Finiquito enviado al asegurado','Finiquito enviado al asegurado, en espera de firma','pendiente' UNION ALL
  SELECT 108,'Finiquito firmado recibido','Finiquito firmado recibido, listo para enviar a aseguradora','otro' UNION ALL
  SELECT 110,'Comprobante de pago recibido','Comprobante de pago recibido, pendiente de confirmar con asegurado','pendiente' UNION ALL
  SELECT 111,'Pago confirmado','Pago confirmado con asegurado, listo para cierre','otro') x WHERE p.clave='RA';
UPDATE siniestro_estatus SET es_final=1 WHERE proceso_id=(SELECT id FROM siniestro_procesos WHERE clave='RA') AND nombre='Cerrado';

-- ============ Reclamación VIDA (VI) ============
UPDATE siniestro_estatus SET nombre='Siniestro registrado', tipo='otro', orden=101 WHERE proceso_id=(SELECT id FROM siniestro_procesos WHERE clave='VI') AND nombre='Registrado';
UPDATE siniestro_estatus SET nombre='Documentación en revisión', tipo='pendiente', orden=103 WHERE proceso_id=(SELECT id FROM siniestro_procesos WHERE clave='VI') AND nombre='Revisión de documentos';
UPDATE siniestro_estatus SET nombre='Documentos en portal aseguradora', tipo='aseguradora', orden=105 WHERE proceso_id=(SELECT id FROM siniestro_procesos WHERE clave='VI') AND nombre='Presentada a aseguradora';
UPDATE siniestro_estatus SET nombre='Folio registrado', tipo='aseguradora', orden=106 WHERE proceso_id=(SELECT id FROM siniestro_procesos WHERE clave='VI') AND nombre='En seguimiento';
UPDATE siniestro_estatus SET orden=110 WHERE proceso_id=(SELECT id FROM siniestro_procesos WHERE clave='VI') AND nombre='Cerrado';
UPDATE siniestro_estatus SET orden=111 WHERE proceso_id=(SELECT id FROM siniestro_procesos WHERE clave='VI') AND nombre='Reabierto';
INSERT IGNORE INTO siniestro_estatus (proceso_id,orden,nombre,descripcion,tipo,es_final) SELECT p.id,x.o,x.n,x.d,x.t,0 FROM siniestro_procesos p JOIN (
  SELECT 102 o,'Requisitos enviados' n,'Requisitos enviados, en espera de documentación' d,'pendiente' t UNION ALL
  SELECT 104,'Documentación completa','Documentación completa; aquí empiezan a contar los 15 días hábiles','otro' UNION ALL
  SELECT 107,'Dictamen negativo','Dictamen negativo; el coordinador elige a qué estatus regresa (cuenta como incidencia)','pendiente' UNION ALL
  SELECT 108,'Dictamen procedente','Dictamen procedente, en espera de transferencia y finiquito','aseguradora' UNION ALL
  SELECT 109,'Transferencia y finiquito','Transferencia y finiquito realizados por la aseguradora','otro') x WHERE p.clave='VI';
UPDATE siniestro_estatus SET es_final=1 WHERE proceso_id=(SELECT id FROM siniestro_procesos WHERE clave='VI') AND nombre='Cerrado';

-- ============ Siniestro Inicial (SI) ============
UPDATE siniestro_estatus SET nombre='Siniestro registrado', tipo='otro', orden=101 WHERE proceso_id=(SELECT id FROM siniestro_procesos WHERE clave='SI') AND nombre='Registrado';
UPDATE siniestro_estatus SET nombre='Ajustador asignado', tipo='aseguradora', orden=102 WHERE proceso_id=(SELECT id FROM siniestro_procesos WHERE clave='SI') AND nombre='Integración de expediente';
UPDATE siniestro_estatus SET nombre='Ajustador en sitio', tipo='otro', orden=103 WHERE proceso_id=(SELECT id FROM siniestro_procesos WHERE clave='SI') AND nombre='Enviado a aseguradora';
UPDATE siniestro_estatus SET nombre='En seguimiento con supervisor', tipo='aseguradora', orden=104 WHERE proceso_id=(SELECT id FROM siniestro_procesos WHERE clave='SI') AND nombre='En seguimiento';
UPDATE siniestro_estatus SET orden=107 WHERE proceso_id=(SELECT id FROM siniestro_procesos WHERE clave='SI') AND nombre='Cerrado';
UPDATE siniestro_estatus SET orden=108 WHERE proceso_id=(SELECT id FROM siniestro_procesos WHERE clave='SI') AND nombre='Reabierto';
INSERT IGNORE INTO siniestro_estatus (proceso_id,orden,nombre,descripcion,tipo,es_final) SELECT p.id,x.o,x.n,x.d,x.t,0 FROM siniestro_procesos p JOIN (
  SELECT 105 o,'Incidencia abierta' n,'Incidencia o complicación reportada por el asegurado, en negociación con el supervisor' d,'pendiente' t UNION ALL
  SELECT 106,'Reporte final del supervisor','Reporte final del supervisor recibido','otro') x WHERE p.clave='SI';
UPDATE siniestro_estatus SET es_final=1 WHERE proceso_id=(SELECT id FROM siniestro_procesos WHERE clave='SI') AND nombre='Cerrado';

-- ============ Pago directo (PD): estatus donde arranca el conteo de 3 horas ============
INSERT IGNORE INTO siniestro_estatus (proceso_id,orden,nombre,descripcion,tipo,es_final)
  SELECT id,8,'Alta registrada','Alta hospitalaria registrada, en espera de dictamen (arranca el conteo de 3 horas)','aseguradora',0 FROM siniestro_procesos WHERE clave='PD';

-- ============ Orden final consecutivo en los procesos tocados ============
UPDATE siniestro_estatus e
  JOIN (SELECT id, ROW_NUMBER() OVER (PARTITION BY proceso_id ORDER BY orden, id) rn FROM siniestro_estatus) r ON r.id = e.id
  JOIN siniestro_procesos p ON p.id = e.proceso_id
SET e.orden = r.rn WHERE p.clave IN ('RA','VI','SI','PD');

SET SQL_SAFE_UPDATES = 1;

SELECT p.clave, e.orden, e.nombre, e.tipo, e.es_final
FROM siniestro_estatus e JOIN siniestro_procesos p ON p.id = e.proceso_id
WHERE p.clave IN ('RA','VI','SI','PD') ORDER BY p.id, e.orden;
