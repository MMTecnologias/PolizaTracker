SET NAMES utf8mb4;
-- =====================================================================
-- Módulo Siniestros · Etapa 3: Historial, Pagos, Plantillas y Reportes
-- Idempotente: se puede correr varias veces sin duplicar nada.
-- Antes de correrlo:  USE ggsystem;
-- =====================================================================

-- 1) Columnas nuevas en tablas existentes (solo si faltan) -------------
SET @s = (SELECT IF(COUNT(*)=0, 'ALTER TABLE siniestro_estatus ADD COLUMN activo TINYINT(1) NOT NULL DEFAULT 1', 'SELECT 1')
          FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'siniestro_estatus' AND COLUMN_NAME = 'activo');
PREPARE p FROM @s; EXECUTE p; DEALLOCATE PREPARE p;

SET @s = (SELECT IF(COUNT(*)=0, 'ALTER TABLE siniestros ADD COLUMN tipo_id INT NULL', 'SELECT 1')
          FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'siniestros' AND COLUMN_NAME = 'tipo_id');
PREPARE p FROM @s; EXECUTE p; DEALLOCATE PREPARE p;

SET @s = (SELECT IF(COUNT(*)=0, 'ALTER TABLE siniestros ADD COLUMN resultado ENUM(''Procedente'',''Rechazado'',''Cerrado'') NULL', 'SELECT 1')
          FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'siniestros' AND COLUMN_NAME = 'resultado');
PREPARE p FROM @s; EXECUTE p; DEALLOCATE PREPARE p;

-- 2) Catálogos ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS siniestro_tipos (
  id         INT NOT NULL AUTO_INCREMENT,
  proceso_id INT NOT NULL,
  nombre     VARCHAR(60) NOT NULL,
  activo     TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tipo (proceso_id, nombre),
  CONSTRAINT fk_tipo_proceso FOREIGN KEY (proceso_id) REFERENCES siniestro_procesos (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS siniestro_campos (
  id         INT NOT NULL AUTO_INCREMENT,
  nombre     VARCHAR(80) NOT NULL,
  tipo_dato  VARCHAR(20) NOT NULL DEFAULT 'Texto',   -- Texto, Texto largo, Número, Monto, Fecha, Sí / No, Lista
  opciones   VARCHAR(255) NULL,                      -- solo para Lista, separadas por coma
  obligatorio TINYINT(1) NOT NULL DEFAULT 0,
  activo     TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uq_campo_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS siniestro_campo_procesos (
  campo_id   INT NOT NULL,
  proceso_id INT NOT NULL,
  PRIMARY KEY (campo_id, proceso_id),
  CONSTRAINT fk_cp_campo   FOREIGN KEY (campo_id)   REFERENCES siniestro_campos (id) ON DELETE CASCADE,
  CONSTRAINT fk_cp_proceso FOREIGN KEY (proceso_id) REFERENCES siniestro_procesos (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS siniestro_campo_tipos (
  campo_id INT NOT NULL,
  tipo_id  INT NOT NULL,
  PRIMARY KEY (campo_id, tipo_id),
  CONSTRAINT fk_ct_campo FOREIGN KEY (campo_id) REFERENCES siniestro_campos (id) ON DELETE CASCADE,
  CONSTRAINT fk_ct_tipo  FOREIGN KEY (tipo_id)  REFERENCES siniestro_tipos (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS siniestro_requisitos_cat (
  id     INT NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(120) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_req_cat (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS siniestro_plantillas_req (
  id             INT NOT NULL AUTO_INCREMENT,
  proceso_id     INT NOT NULL,
  aseguradora_id INT NOT NULL,
  tipo_id        INT NOT NULL,
  activo         TINYINT(1) NOT NULL DEFAULT 1,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_plantilla (proceso_id, aseguradora_id, tipo_id),
  CONSTRAINT fk_pl_proceso FOREIGN KEY (proceso_id)     REFERENCES siniestro_procesos (id),
  CONSTRAINT fk_pl_aseg    FOREIGN KEY (aseguradora_id) REFERENCES aseguradoras (id),
  CONSTRAINT fk_pl_tipo    FOREIGN KEY (tipo_id)        REFERENCES siniestro_tipos (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS siniestro_plantilla_items (
  id          INT NOT NULL AUTO_INCREMENT,
  plantilla_id INT NOT NULL,
  nombre      VARCHAR(120) NOT NULL,
  obligatorio TINYINT(1) NOT NULL DEFAULT 1,
  orden       INT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  CONSTRAINT fk_it_plantilla FOREIGN KEY (plantilla_id) REFERENCES siniestro_plantillas_req (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS siniestro_mensajes (
  id       INT NOT NULL AUTO_INCREMENT,
  nombre   VARCHAR(80) NOT NULL,
  uso      VARCHAR(100) NULL,
  procesos VARCHAR(40) NOT NULL DEFAULT 'TODOS',     -- TODOS o claves separadas por coma
  canal    VARCHAR(30) NOT NULL DEFAULT 'WhatsApp / Correo',
  texto    TEXT NOT NULL,
  activo   TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3) Pagos ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS siniestro_pagos (
  id                  INT NOT NULL AUTO_INCREMENT,
  siniestro_id        INT NOT NULL,
  fecha_pago          DATE NOT NULL,
  concepto            VARCHAR(60) NOT NULL,
  monto               DECIMAL(14,2) NOT NULL,
  beneficiario        VARCHAR(120) NULL,
  estado              ENUM('Vigente','Cancelado') NOT NULL DEFAULT 'Vigente',
  motivo_cancelacion  VARCHAR(255) NULL,
  comprobante         VARCHAR(255) NULL,
  registrado_por      INT NULL,
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_pago_sin (siniestro_id),
  KEY ix_pago_fecha (fecha_pago),
  CONSTRAINT fk_pago_sin FOREIGN KEY (siniestro_id) REFERENCES siniestros (id),
  CONSTRAINT fk_pago_usr FOREIGN KEY (registrado_por) REFERENCES usuarios (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4) Datos iniciales de los catálogos ----------------------------------
INSERT IGNORE INTO siniestro_tipos (proceso_id, nombre)
SELECT pr.id, t.nombre FROM (
  SELECT 'CIR' c, 'Cirugía de vesícula' nombre UNION ALL SELECT 'CIR','Cirugía de rodilla' UNION ALL SELECT 'CIR','Hernia' UNION ALL SELECT 'CIR','Cataratas'
  UNION ALL SELECT 'PD','Hospitalización' UNION ALL SELECT 'PD','Urgencia' UNION ALL SELECT 'PD','Maternidad'
  UNION ALL SELECT 'REM','Consulta' UNION ALL SELECT 'REM','Medicamentos' UNION ALL SELECT 'REM','Estudios' UNION ALL SELECT 'REM','Hospitalización'
  UNION ALL SELECT 'RA','Choque' UNION ALL SELECT 'RA','Robo total' UNION ALL SELECT 'RA','Cristales' UNION ALL SELECT 'RA','Daños a terceros'
  UNION ALL SELECT 'SI','Colisión' UNION ALL SELECT 'SI','Robo'
  UNION ALL SELECT 'VI','Fallecimiento' UNION ALL SELECT 'VI','Invalidez total' UNION ALL SELECT 'VI','Enfermedades graves'
) t JOIN siniestro_procesos pr ON pr.clave = t.c;

INSERT IGNORE INTO siniestro_requisitos_cat (nombre) VALUES
('Aviso de accidente o enfermedad'),('Informe médico'),('Estudios de laboratorio'),('Facturas originales'),('Identificación oficial'),
('Estado de cuenta bancario'),('Carta de no complicaciones'),('Receta médica'),('Acta de hechos'),('Peritaje'),
('Acta de defunción'),('Acta de nacimiento del beneficiario'),('Dictamen de invalidez');

INSERT IGNORE INTO siniestro_campos (nombre, tipo_dato, opciones, obligatorio) VALUES
('Nombre del paciente / afectado','Texto',NULL,1),('Fecha del evento','Fecha',NULL,1),('Hospital','Texto',NULL,1),
('Diagnóstico','Texto largo',NULL,1),('Monto reclamado','Monto',NULL,1),('Fecha programada de cirugía','Fecha',NULL,1),
('Médico tratante','Texto',NULL,0),('Placas del vehículo','Texto',NULL,1),('Hubo lesionados','Sí / No',NULL,0),
('Causa del fallecimiento','Lista','Natural, Accidente, Enfermedad',1),('Beneficiario','Texto',NULL,1);

DROP TEMPORARY TABLE IF EXISTS tmp_cp;
CREATE TEMPORARY TABLE tmp_cp (campo VARCHAR(80), clave VARCHAR(5));
INSERT INTO tmp_cp VALUES
('Nombre del paciente / afectado','CIR'),('Nombre del paciente / afectado','PD'),('Nombre del paciente / afectado','REM'),('Nombre del paciente / afectado','RA'),('Nombre del paciente / afectado','SI'),('Nombre del paciente / afectado','VI'),
('Fecha del evento','CIR'),('Fecha del evento','PD'),('Fecha del evento','REM'),('Fecha del evento','RA'),('Fecha del evento','SI'),('Fecha del evento','VI'),
('Hospital','CIR'),('Hospital','PD'),('Hospital','REM'),('Diagnóstico','CIR'),('Diagnóstico','PD'),('Diagnóstico','REM'),
('Monto reclamado','CIR'),('Monto reclamado','PD'),('Monto reclamado','REM'),('Monto reclamado','RA'),('Monto reclamado','VI'),
('Fecha programada de cirugía','CIR'),('Médico tratante','CIR'),('Médico tratante','PD'),('Médico tratante','REM'),
('Placas del vehículo','RA'),('Placas del vehículo','SI'),('Hubo lesionados','RA'),('Hubo lesionados','SI'),
('Causa del fallecimiento','VI'),('Beneficiario','VI');
INSERT IGNORE INTO siniestro_campo_procesos (campo_id, proceso_id)
SELECT c.id, p.id FROM tmp_cp t JOIN siniestro_campos c ON c.nombre = t.campo JOIN siniestro_procesos p ON p.clave = t.clave;
DROP TEMPORARY TABLE tmp_cp;

-- Campos limitados a ciertos tipos
INSERT IGNORE INTO siniestro_campo_tipos (campo_id, tipo_id)
SELECT c.id, t.id FROM siniestro_campos c JOIN siniestro_tipos t ON
  (c.nombre = 'Fecha programada de cirugía' AND t.nombre IN ('Cirugía de vesícula','Cirugía de rodilla','Hernia','Cataratas'))
  OR (c.nombre = 'Hubo lesionados' AND t.nombre IN ('Choque','Colisión'))
  OR (c.nombre = 'Causa del fallecimiento' AND t.nombre = 'Fallecimiento');

INSERT INTO siniestro_mensajes (nombre, uso, procesos, canal, texto)
SELECT * FROM (
 SELECT 'Solicitud de documentos faltantes' nombre,'Actualizar estatus: pendiente de documentos' uso,'CIR,PD,REM,RA,VI' procesos,'WhatsApp / Correo' canal,'Hola {cliente}, para continuar con tu siniestro {folio} de {aseguradora} (póliza {poliza}) necesitamos los siguientes documentos:\n{requisitos}\nFecha límite para enviarlos: {fecha_limite}. Gracias.' texto
 UNION ALL SELECT 'Confirmación de apertura','Nuevo siniestro','TODOS','WhatsApp / Correo','Hola {cliente}, abrimos tu siniestro con folio {folio} ante {aseguradora}. Te mantendremos informado de cada avance.'
 UNION ALL SELECT 'Pago realizado','Registrar pago','TODOS','WhatsApp / Correo','Hola {cliente}, te confirmamos que se realizó el pago de {monto} correspondiente al siniestro {folio}.'
 UNION ALL SELECT 'Siniestro improcedente','Cerrar siniestro: rechazado','CIR,PD,REM,RA,VI','Correo','Estimado {cliente}, la aseguradora {aseguradora} determinó improcedente el siniestro {folio}. Si deseas revisar el caso con nosotros, estamos a tus órdenes.'
 UNION ALL SELECT 'Aviso a la aseguradora','Nuevo siniestro / derivado','CIR,PD,REM','Correo','Buen día, por este medio notificamos el siniestro {folio} del asegurado {asegurado}, póliza {poliza}. Adjuntamos la documentación requerida.'
 UNION ALL SELECT 'Recordatorio de documentos','Siniestros por vencer','TODOS','WhatsApp','Hola {cliente}, te recordamos que aún faltan documentos del siniestro {folio}. El plazo vence el {fecha_limite}.'
 UNION ALL SELECT 'Reapertura de siniestro','Reabrir siniestro','TODOS','Correo','Estimado {cliente}, reabrimos el siniestro {folio} para dar seguimiento adicional.'
) m WHERE NOT EXISTS (SELECT 1 FROM siniestro_mensajes);

SELECT (SELECT COUNT(*) FROM siniestro_tipos) tipos, (SELECT COUNT(*) FROM siniestro_campos) campos,
       (SELECT COUNT(*) FROM siniestro_mensajes) mensajes, (SELECT COUNT(*) FROM siniestro_requisitos_cat) requisitos;

-- 5) Bitácora (por ahora registra las reaperturas; el detalle del siniestro la mostrará) ----
CREATE TABLE IF NOT EXISTS siniestro_bitacora (
  id           INT NOT NULL AUTO_INCREMENT,
  siniestro_id INT NOT NULL,
  fecha        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  usuario_id   INT NULL,
  accion       VARCHAR(40) NOT NULL,
  detalle      VARCHAR(500) NULL,
  PRIMARY KEY (id),
  KEY ix_bit_sin (siniestro_id),
  CONSTRAINT fk_bit_sin FOREIGN KEY (siniestro_id) REFERENCES siniestros (id) ON DELETE CASCADE,
  CONSTRAINT fk_bit_usr FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
