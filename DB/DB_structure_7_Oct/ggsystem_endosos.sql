-- MySQL dump 10.13  Distrib 8.0.34, for Win64 (x86_64)
--
-- Host: localhost    Database: ggsystem
-- ------------------------------------------------------
-- Server version	8.0.34

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `endosos`
--

DROP TABLE IF EXISTS `endosos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `endosos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tipo_endoso` enum('A','B','D') NOT NULL,
  `cliente_id` int NOT NULL,
  `poliza_id` int NOT NULL,
  `fecha_captura` date NOT NULL,
  `endoso` varchar(100) DEFAULT NULL,
  `ramo_id` int NOT NULL,
  `subramo_id` int NOT NULL,
  `fecha_inicio` date NOT NULL,
  `fecha_termino` date NOT NULL,
  `moneda` enum('MXN','USD','UDIS') NOT NULL,
  `tipo_pago_id` int NOT NULL,
  `agente_id` int NOT NULL,
  `aseguradora_id` int NOT NULL,
  `serie` varchar(30) NOT NULL,
  `notas` varchar(400) DEFAULT NULL,
  `poliza_anterior` varchar(30) DEFAULT NULL,
  `renovacion` varchar(30) DEFAULT NULL,
  `prima_neta` decimal(12,2) NOT NULL,
  `prima_total` decimal(12,2) NOT NULL,
  `status` enum('Vigente','Pendiente','Cancelada','Finalizada') DEFAULT 'Vigente',
  `derecho_poliza` decimal(12,2) DEFAULT NULL,
  `iva` decimal(12,2) DEFAULT NULL,
  `rec_pago` decimal(12,2) DEFAULT NULL,
  `comision` decimal(12,2) DEFAULT NULL,
  `recibos` enum('Generados','Por generar') DEFAULT 'Por generar',
  `vendedor_id` int NOT NULL DEFAULT '1',
  `poliza` varchar(30) NOT NULL,
  `conducta_pago` varchar(30) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `cliente_id` (`cliente_id`),
  KEY `poliza_id` (`poliza_id`),
  KEY `ramo_id` (`ramo_id`),
  KEY `subramo_id` (`subramo_id`),
  KEY `tipo_pago_id` (`tipo_pago_id`),
  KEY `agente_id` (`agente_id`),
  KEY `aseguradora_id` (`aseguradora_id`),
  KEY `vendedor_id` (`vendedor_id`),
  CONSTRAINT `endosos_ibfk_1` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`),
  CONSTRAINT `endosos_ibfk_2` FOREIGN KEY (`poliza_id`) REFERENCES `polizas` (`id`),
  CONSTRAINT `endosos_ibfk_3` FOREIGN KEY (`ramo_id`) REFERENCES `ramos` (`id`),
  CONSTRAINT `endosos_ibfk_4` FOREIGN KEY (`subramo_id`) REFERENCES `subramos` (`id`),
  CONSTRAINT `endosos_ibfk_5` FOREIGN KEY (`tipo_pago_id`) REFERENCES `tipos_pagos` (`id`),
  CONSTRAINT `endosos_ibfk_6` FOREIGN KEY (`agente_id`) REFERENCES `agentes` (`id`),
  CONSTRAINT `endosos_ibfk_7` FOREIGN KEY (`aseguradora_id`) REFERENCES `aseguradoras` (`id`),
  CONSTRAINT `endosos_ibfk_8` FOREIGN KEY (`vendedor_id`) REFERENCES `vendedores` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2024-10-07 10:27:45
