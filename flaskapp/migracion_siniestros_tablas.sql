SET NAMES utf8mb4;
-- =====================================================================
-- Módulo Siniestros · Etapa 2: tablas de la pantalla "Tabla de Siniestros"
-- Idempotente: se puede correr varias veces sin duplicar nada.
-- Antes de correrlo:  USE ggsystem;
-- =====================================================================

CREATE TABLE IF NOT EXISTS siniestro_procesos (
  id     INT NOT NULL AUTO_INCREMENT,
  clave  VARCHAR(5)  NOT NULL,             -- CIR, PD, REM, RA, SI, VI
  nombre VARCHAR(40) NOT NULL,
  grupo  ENUM('GMM','AUTOS','VIDA') NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_proceso_clave (clave)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS siniestro_estatus (
  id          INT NOT NULL AUTO_INCREMENT,
  proceso_id  INT NOT NULL,
  orden       INT NOT NULL,
  nombre      VARCHAR(40)  NOT NULL,       -- nombre corto (se ve en la tabla)
  descripcion VARCHAR(120) NULL,           -- nombre completo del catálogo
  tipo        ENUM('aseguradora','pendiente','otro') NOT NULL DEFAULT 'otro',
  es_final    TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_estatus (proceso_id, nombre),
  CONSTRAINT fk_estatus_proceso FOREIGN KEY (proceso_id) REFERENCES siniestro_procesos (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS siniestros (
  id                  INT NOT NULL AUTO_INCREMENT,
  folio               VARCHAR(20) NOT NULL,           -- CIR-AAAA-MM-NNN
  proceso_id          INT NOT NULL,
  poliza_id           INT NOT NULL,                   -- de ahí salen cliente y aseguradora
  aseguradora_id      INT NOT NULL,
  estatus_id          INT NOT NULL,
  origen_id           INT NULL,                       -- siniestro del que se deriva
  fecha_apertura      DATETIME NOT NULL,
  fecha_limite        DATETIME NULL,                  -- plazo vigente (NULL = sin plazo)
  ultima_actualizacion DATETIME NOT NULL,
  estado              ENUM('Activo','Cerrado') NOT NULL DEFAULT 'Activo',
  fecha_cierre        DATETIME NULL,
  creado_por          INT NULL,
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_siniestro_folio (folio),
  KEY ix_sin_estado (estado),
  KEY ix_sin_proceso (proceso_id),
  KEY ix_sin_poliza (poliza_id),
  KEY ix_sin_origen (origen_id),
  CONSTRAINT fk_sin_proceso  FOREIGN KEY (proceso_id)     REFERENCES siniestro_procesos (id),
  CONSTRAINT fk_sin_poliza   FOREIGN KEY (poliza_id)      REFERENCES polizas (id),
  CONSTRAINT fk_sin_aseg     FOREIGN KEY (aseguradora_id) REFERENCES aseguradoras (id),
  CONSTRAINT fk_sin_estatus  FOREIGN KEY (estatus_id)     REFERENCES siniestro_estatus (id),
  CONSTRAINT fk_sin_origen   FOREIGN KEY (origen_id)      REFERENCES siniestros (id) ON DELETE SET NULL,
  CONSTRAINT fk_sin_usuario  FOREIGN KEY (creado_por)     REFERENCES usuarios (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- Procesos
-- ---------------------------------------------------------------------
INSERT IGNORE INTO siniestro_procesos (clave, nombre, grupo) VALUES
 ('CIR','Cirugía Programada','GMM'),
 ('PD','Pago Directo','GMM'),
 ('REM','Reembolso GMM','GMM'),
 ('RA','Reembolso Autos Daños','AUTOS'),
 ('SI','Siniestro Inicial','AUTOS'),
 ('VI','Reclamación VIDA','VIDA');

-- ---------------------------------------------------------------------
-- Catálogo de estatus (nombre corto | descripción oficial | tipo | final)
-- tipo: aseguradora = esperando a la aseguradora · pendiente = falta algo
-- del asegurado o de revisión interna · otro = trámite interno normal.
-- ---------------------------------------------------------------------
DROP TEMPORARY TABLE IF EXISTS tmp_estatus;
CREATE TEMPORARY TABLE tmp_estatus (clave VARCHAR(5), orden INT, nombre VARCHAR(40), descripcion VARCHAR(120), tipo VARCHAR(12), es_final TINYINT);
INSERT INTO tmp_estatus VALUES
 -- Cirugía programada
 ('CIR',1,'Solicitud registrada','Solicitud registrada','otro',0),
 ('CIR',2,'Requisitos enviados','Requisitos enviados, en espera de documentación','pendiente',0),
 ('CIR',3,'Documentación recibida','Documentación recibida, pendiente de revisión','pendiente',0),
 ('CIR',4,'Documentación incompleta','En espera de documentación (incompleta)','pendiente',0),
 ('CIR',5,'Documentación completa','Documentación completa, listo para captura','otro',0),
 ('CIR',6,'Siniestro capturado','Siniestro capturado, listo para integrar expediente','otro',0),
 ('CIR',7,'Expediente integrado','Expediente integrado, listo para enviar a aseguradora','otro',0),
 ('CIR',8,'Enviado a aseguradora','Enviado a aseguradora, en espera de folio','aseguradora',0),
 ('CIR',9,'Folio registrado','Folio registrado, en seguimiento','aseguradora',0),
 ('CIR',10,'Autorizado','Autorizado, pendiente de cirugía','aseguradora',0),
 ('CIR',11,'Rechazado, cerrado','Rechazado, cerrado (final)','otro',1),
 ('CIR',12,'Cirugía concluida','Cirugía concluida, alta confirmada (final)','otro',1),
 ('CIR',13,'Reabierto','Reabierto para corrección','pendiente',0),
 -- Pago directo
 ('PD',1,'Notificación registrada','Notificación registrada','otro',0),
 ('PD',2,'Requisitos enviados','Requisitos enviados, en espera de documentación','pendiente',0),
 ('PD',3,'Documentación recibida','Documentación recibida, pendiente de revisión','pendiente',0),
 ('PD',4,'Documentación incompleta','En espera de documentación (incompleta)','pendiente',0),
 ('PD',5,'Documentación completa','Documentación completa','otro',0),
 ('PD',6,'Pendiente de pago','Pendiente de confirmación de pago (alerta)','pendiente',0),
 ('PD',7,'Póliza confirmada','Póliza confirmada, pendiente de entrega en hospital','otro',0),
 ('PD',8,'Entregado en hospital','Documentos entregados en hospital, en seguimiento con aseguradora','aseguradora',0),
 ('PD',9,'Dictamen autorizado','Dictamen recibido, autorizado','aseguradora',0),
 ('PD',10,'Corrección tras rechazo','En espera de documentación (corrección tras rechazo)','pendiente',0),
 ('PD',11,'Rechazado, cerrado','Rechazado, cerrado (final)','otro',1),
 ('PD',12,'Salida confirmada','Pago directo concluido, salida confirmada (final)','otro',1),
 ('PD',13,'Reabierto','Reabierto para corrección','pendiente',0),
 -- Reembolso GMM
 ('REM',1,'Solicitud registrada','Solicitud registrada','otro',0),
 ('REM',2,'Requisitos enviados','Requisitos enviados, en espera de documentación','pendiente',0),
 ('REM',3,'Documentación recibida','Documentación recibida, pendiente de revisión','pendiente',0),
 ('REM',4,'Documentación incompleta','En espera de documentación (incompleta / corrección solicitada)','pendiente',0),
 ('REM',5,'Documentación completa','Documentación completa, lista para captura del reembolso','otro',0),
 ('REM',6,'Reembolso capturado','Reembolso capturado, listo para integrar expediente','otro',0),
 ('REM',7,'Expediente integrado','Expediente integrado, listo para enviar a aseguradora','otro',0),
 ('REM',8,'Enviado a aseguradora','Enviado a aseguradora, en espera de folio','aseguradora',0),
 ('REM',9,'Folio registrado','Folio registrado, en seguimiento','aseguradora',0),
 ('REM',10,'Corrección de aseguradora','En espera de documentación (corrección solicitada por aseguradora)','pendiente',0),
 ('REM',11,'Finiquito capturado','Finiquito capturado, listo para notificar','otro',0),
 ('REM',12,'Notificado','Notificado, pendiente de cierre','otro',0),
 ('REM',13,'Cerrado, procedente','Cerrado, procedente (final)','otro',1),
 ('REM',14,'Reabierto','Reabierto para corrección','pendiente',0),
 -- Autos (SI, RA) y VIDA (VI): catálogo PROVISIONAL, se afina cuando se
 -- construya el flujo de cada proceso.
 ('SI',1,'Registrado','Siniestro registrado','otro',0),
 ('SI',2,'Integración de expediente','En integración de expediente','pendiente',0),
 ('SI',3,'Enviado a aseguradora','Enviado a aseguradora','aseguradora',0),
 ('SI',4,'En seguimiento','En seguimiento con aseguradora','aseguradora',0),
 ('SI',5,'Cerrado','Cerrado (final)','otro',1),
 ('SI',6,'Reabierto','Reabierto para corrección','pendiente',0),
 ('RA',1,'Registrado','Reembolso registrado','otro',0),
 ('RA',2,'Integración de expediente','En integración de expediente','pendiente',0),
 ('RA',3,'Enviado a aseguradora','Enviado a aseguradora','aseguradora',0),
 ('RA',4,'En seguimiento','En seguimiento con aseguradora','aseguradora',0),
 ('RA',5,'Cerrado','Cerrado (final)','otro',1),
 ('RA',6,'Reabierto','Reabierto para corrección','pendiente',0),
 ('VI',1,'Registrado','Reclamación registrada','otro',0),
 ('VI',2,'Revisión de documentos','En revisión de documentos','pendiente',0),
 ('VI',3,'Presentada a aseguradora','Reclamación presentada a aseguradora','aseguradora',0),
 ('VI',4,'En seguimiento','En seguimiento con aseguradora','aseguradora',0),
 ('VI',5,'Cerrado','Cerrado (final)','otro',1),
 ('VI',6,'Reabierto','Reabierto para corrección','pendiente',0);

INSERT IGNORE INTO siniestro_estatus (proceso_id, orden, nombre, descripcion, tipo, es_final)
SELECT p.id, t.orden, t.nombre, t.descripcion, t.tipo, t.es_final
FROM tmp_estatus t JOIN siniestro_procesos p ON p.clave = t.clave;
DROP TEMPORARY TABLE tmp_estatus;

-- Verificación: procesos y número de estatus de cada uno
SELECT p.clave, p.nombre, COUNT(e.id) AS estatus
FROM siniestro_procesos p LEFT JOIN siniestro_estatus e ON e.proceso_id = p.id
GROUP BY p.id ORDER BY p.id;
