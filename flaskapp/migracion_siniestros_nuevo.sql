SET NAMES utf8mb4;
-- =====================================================================
-- Módulo Siniestros · Etapa 5: Nuevo siniestro.  Idempotente.   Antes:  USE ggsystem;
-- Crea la tabla de valores capturados y completa el catálogo de campos
-- con lo que pide el cliente en sus hojas resumidas (médicos y autos).
-- =====================================================================
CREATE TABLE IF NOT EXISTS siniestro_valores (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  siniestro_id INT NOT NULL,
  campo_id     INT NOT NULL,
  etiqueta     VARCHAR(80) NOT NULL,
  valor        TEXT NULL,
  KEY ix_sv_sin (siniestro_id),
  CONSTRAINT fk_sv_sin   FOREIGN KEY (siniestro_id) REFERENCES siniestros (id) ON DELETE CASCADE,
  CONSTRAINT fk_sv_campo FOREIGN KEY (campo_id)     REFERENCES siniestro_campos (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO siniestro_campos (nombre, tipo_dato, opciones, obligatorio) VALUES
('Nombre del paciente / afectado','Texto',NULL,1),
('Certificado','Texto',NULL,0),
('Fecha recibido','Fecha',NULL,1),
('Tipo de pago','Lista','Inicial,Complementario,Ingreso hospitalario,Consecutivo,Carta autorización,Reconsideración',1),
('Tipo de trámite','Lista','Factura hospital,Facturas varias,Factura farmacia,Reembolso de medicamento,Programación de cirugía,Solicitud de medicamentos,Radioterapia,Otro',1),
('Número de inciso','Texto',NULL,1),
('Fecha y hora del ocurrido','Fecha y hora',NULL,1),
('Estado','Texto',NULL,1),
('Municipio','Texto',NULL,0),
('Descripción del siniestro','Texto largo',NULL,1),
('Observaciones','Texto largo',NULL,0),
('Número de siniestro aseguradora','Texto',NULL,0);

-- Relación campo ↔ proceso (CIR=1 PD=2 REM=3 RA=4 SI=5 VI=6 se resuelve por clave)
DROP TEMPORARY TABLE IF EXISTS tmp_cp;
CREATE TEMPORARY TABLE tmp_cp (campo VARCHAR(80), clave VARCHAR(5));
INSERT INTO tmp_cp VALUES
('Nombre del paciente / afectado','CIR'),('Nombre del paciente / afectado','PD'),('Nombre del paciente / afectado','REM'),('Nombre del paciente / afectado','VI'),
('Certificado','CIR'),('Certificado','PD'),('Certificado','REM'),
('Fecha recibido','CIR'),('Fecha recibido','PD'),('Fecha recibido','REM'),
('Tipo de pago','CIR'),('Tipo de pago','PD'),('Tipo de pago','REM'),
('Tipo de trámite','CIR'),('Tipo de trámite','PD'),('Tipo de trámite','REM'),
('Número de inciso','RA'),('Número de inciso','SI'),
('Fecha y hora del ocurrido','RA'),('Fecha y hora del ocurrido','SI'),
('Estado','RA'),('Estado','SI'),('Municipio','RA'),('Municipio','SI'),
('Descripción del siniestro','RA'),('Descripción del siniestro','SI'),
('Observaciones','CIR'),('Observaciones','PD'),('Observaciones','REM'),('Observaciones','RA'),('Observaciones','SI'),('Observaciones','VI'),
('Número de siniestro aseguradora','CIR'),('Número de siniestro aseguradora','PD'),('Número de siniestro aseguradora','REM'),
('Número de siniestro aseguradora','RA'),('Número de siniestro aseguradora','SI'),('Número de siniestro aseguradora','VI');
INSERT IGNORE INTO siniestro_campo_procesos (campo_id, proceso_id)
SELECT c.id, p.id FROM tmp_cp t JOIN siniestro_campos c ON c.nombre = t.campo JOIN siniestro_procesos p ON p.clave = t.clave;
DROP TEMPORARY TABLE tmp_cp;

-- En autos "Fecha y hora del ocurrido" sustituye a "Fecha del evento"
DELETE cp FROM siniestro_campo_procesos cp
JOIN siniestro_campos c ON c.id = cp.campo_id AND c.nombre = 'Fecha del evento'
JOIN siniestro_procesos p ON p.id = cp.proceso_id AND p.clave IN ('RA','SI');

SELECT COUNT(*) AS campos FROM siniestro_campos;

-- Mensaje para enviar al crear el siniestro: apertura + lista de documentos (checklist de la plantilla)
INSERT INTO siniestro_mensajes (nombre, uso, procesos, canal, texto, activo)
SELECT 'Apertura y lista de documentos', 'Al crear el siniestro: envía el checklist de documentos', 'TODOS', 'WhatsApp / Correo',
 'Hola {cliente}, abrimos tu siniestro con folio {folio} ante {aseguradora} (póliza {poliza}). Para continuar necesitamos los siguientes documentos:
{requisitos}
Fecha límite de atención: {fecha_limite}. Quedamos al pendiente.', 1
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM siniestro_mensajes WHERE nombre = 'Apertura y lista de documentos');
