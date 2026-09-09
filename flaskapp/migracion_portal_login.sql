-- ============================================================
-- Migración: tablas nuevas para el login del Portal del Asegurado
-- Correr una sola vez contra tu base de datos local (MySQL Workbench
-- o la terminal de mysql). No modifica ninguna tabla existente.
-- ============================================================

CREATE TABLE `portal_usuarios` (
  `id` int NOT NULL AUTO_INCREMENT,
  `cliente_id` int NOT NULL,
  `correo` varchar(80) NOT NULL,
  `password` varchar(520) NOT NULL,
  `correo_confirmado` tinyint(1) NOT NULL DEFAULT '0',
  `fecha_registro` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status` enum('Activo','Eliminado') NOT NULL DEFAULT 'Activo',
  PRIMARY KEY (`id`),
  UNIQUE KEY `cliente_id` (`cliente_id`),
  UNIQUE KEY `correo` (`correo`),
  CONSTRAINT `portal_usuarios_ibfk_1` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `portal_tokens` (
  `id` int NOT NULL AUTO_INCREMENT,
  `portal_usuario_id` int NOT NULL,
  `tipo` enum('confirmacion_correo','reset_password') NOT NULL,
  `token` varchar(64) NOT NULL,
  `creado_en` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expira_en` datetime NOT NULL,
  `usado` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `token` (`token`),
  KEY `portal_usuario_id` (`portal_usuario_id`),
  CONSTRAINT `portal_tokens_ibfk_1` FOREIGN KEY (`portal_usuario_id`) REFERENCES `portal_usuarios` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `portal_solicitudes_registro` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(50) NOT NULL,
  `apellido` varchar(50) NOT NULL,
  `rfc` varchar(13) NOT NULL,
  `numero_poliza` varchar(30) DEFAULT NULL,
  `correo` varchar(80) NOT NULL,
  `telefono` varchar(10) NOT NULL,
  `password` varchar(520) NOT NULL,
  `motivo` varchar(200) DEFAULT NULL,
  `status` enum('Pendiente','Aceptada','Rechazada') NOT NULL DEFAULT 'Pendiente',
  `cliente_id_asignado` int DEFAULT NULL,
  `fecha_solicitud` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_resolucion` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `cliente_id_asignado` (`cliente_id_asignado`),
  CONSTRAINT `portal_solicitudes_registro_ibfk_1` FOREIGN KEY (`cliente_id_asignado`) REFERENCES `clientes` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
