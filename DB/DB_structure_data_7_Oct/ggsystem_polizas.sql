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
-- Table structure for table `polizas`
--

DROP TABLE IF EXISTS `polizas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `polizas` (
  `id` int NOT NULL AUTO_INCREMENT,
  `cliente_id` int NOT NULL,
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
  `serie` varchar(30) DEFAULT NULL,
  `notas` varchar(400) DEFAULT NULL,
  `poliza_anterior` varchar(30) DEFAULT NULL,
  `renovacion` varchar(30) DEFAULT NULL,
  `prima_neta` decimal(12,2) NOT NULL,
  `prima_total` decimal(12,2) NOT NULL,
  `status` enum('Vigente','Pendiente','Cancelada','Finalizada','Por Vencer') NOT NULL DEFAULT 'Vigente',
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
  KEY `ramo_id` (`ramo_id`),
  KEY `subramo_id` (`subramo_id`),
  KEY `tipo_pago_id` (`tipo_pago_id`),
  KEY `agente_id` (`agente_id`),
  KEY `aseguradora_id` (`aseguradora_id`),
  KEY `vendedor_id` (`vendedor_id`),
  CONSTRAINT `polizas_ibfk_1` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`),
  CONSTRAINT `polizas_ibfk_2` FOREIGN KEY (`ramo_id`) REFERENCES `ramos` (`id`),
  CONSTRAINT `polizas_ibfk_3` FOREIGN KEY (`subramo_id`) REFERENCES `subramos` (`id`),
  CONSTRAINT `polizas_ibfk_4` FOREIGN KEY (`tipo_pago_id`) REFERENCES `tipos_pagos` (`id`),
  CONSTRAINT `polizas_ibfk_5` FOREIGN KEY (`agente_id`) REFERENCES `agentes` (`id`),
  CONSTRAINT `polizas_ibfk_6` FOREIGN KEY (`aseguradora_id`) REFERENCES `aseguradoras` (`id`),
  CONSTRAINT `polizas_ibfk_7` FOREIGN KEY (`vendedor_id`) REFERENCES `vendedores` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=32 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `polizas`
--

LOCK TABLES `polizas` WRITE;
/*!40000 ALTER TABLE `polizas` DISABLE KEYS */;
INSERT INTO `polizas` VALUES (3,1,'2023-12-26','Si',1,3,'2023-12-26','2024-12-26','MXN',1,1,3,'AB1','no','no','no',2639.23,3500.00,'Cancelada',10.00,0.10,0.22,0.10,'Generados',1,'AP1',NULL),(4,2,'2021-12-26','What?',2,1,'2022-03-26','2024-03-26','MXN',3,1,2,'sd2',NULL,'1939DDF23','12332',150000.00,200000.00,'Finalizada',NULL,0.16,NULL,NULL,NULL,1,'P6',NULL),(5,1,'2021-12-26',NULL,3,2,'2023-08-26','2024-08-26','USD',2,2,2,'AB12',NULL,NULL,NULL,93628.23,100000.00,'Finalizada',500.00,0.16,-0.10,0.20,'Generados',1,'P2',NULL),(6,1,'2021-12-26',NULL,1,2,'2021-08-26','2023-08-26','MXN',4,2,3,'Luis',NULL,NULL,NULL,500.00,1000.00,'Finalizada',200.00,0.16,0.44,0.20,'Generados',1,'P22',NULL),(7,12,'2021-12-26',NULL,1,2,'2021-08-26','2022-08-26','MXN',3,1,2,'MArina',NULL,NULL,NULL,500.00,1000.00,'Finalizada',200.00,0.16,0.44,0.25,'Generados',1,'P4',NULL),(8,43,'2024-03-01',NULL,4,4,'2023-09-27','2024-09-27','MXN',3,3,23,'2333211','BANORTE** deducibel 70,000 coaseguro 10%','2333212',NULL,93231.35,116693.95,'Por Vencer',986.00,0.16,0.08,0.00,'Generados',1,'ZP5',NULL),(9,881,'2024-04-29',NULL,2,4,'2024-01-01','2026-01-01','MXN',2,4,2,'S200','intento',NULL,'Si',100.00,200.00,'Vigente',NULL,0.16,NULL,NULL,'Por generar',1,'P300',NULL),(10,1524,'2024-04-29',NULL,3,3,'2024-04-05','2024-04-03','MXN',2,3,3,'S200',NULL,NULL,NULL,87687.00,76978697.00,'Finalizada',NULL,0.16,NULL,NULL,'Por generar',1,'P300',NULL),(11,1,'2024-05-09',NULL,4,1,'2024-05-09','2026-05-09','USD',3,4,3,'Serie1234',NULL,NULL,NULL,1000.00,200.00,'Vigente',NULL,0.16,NULL,NULL,'Por generar',3,'Poliza1234',NULL),(12,1524,'2024-05-09',NULL,3,3,'2024-05-11','2024-05-14','USD',3,5,13,'B300',NULL,NULL,NULL,100.00,200.00,'Finalizada',NULL,0.16,NULL,NULL,'Por generar',1,'B100',NULL),(13,547,'2024-05-09',NULL,4,3,'2024-05-09','2024-05-08','MXN',1,5,13,'Snew',NULL,NULL,NULL,100.00,200.00,'Finalizada',NULL,0.16,NULL,NULL,'Por generar',2,'Pnew',NULL),(14,893,'2024-05-09',NULL,3,3,'2024-05-18','2024-05-16','MXN',2,3,13,'S445',NULL,NULL,NULL,100.00,200.00,'Finalizada',NULL,0.16,NULL,NULL,'Por generar',3,'P3455',NULL),(15,893,'2024-05-09',NULL,3,3,'2024-05-18','2024-05-16','MXN',2,3,13,'S445',NULL,NULL,NULL,100.00,200.00,'Finalizada',NULL,0.16,NULL,NULL,'Por generar',3,'P3455',NULL),(16,709,'2024-06-26',NULL,4,3,'2024-05-30','2026-05-30','USD',3,4,2,'S301',NULL,NULL,NULL,1000.00,200.00,'Vigente',NULL,0.16,NULL,NULL,'Por generar',3,'P301',NULL),(17,709,'2024-06-26',NULL,4,3,'2024-05-30','2026-05-30','USD',3,4,2,'S301',NULL,NULL,NULL,1000.00,200.00,'Vigente',NULL,0.16,NULL,NULL,'Por generar',3,'P301',NULL),(18,709,'2024-06-26',NULL,4,3,'2024-05-30','2026-05-30','USD',3,4,2,'S301',NULL,NULL,NULL,1000.00,200.00,'Vigente',NULL,0.16,NULL,NULL,'Por generar',3,'P301',NULL),(19,709,'2024-06-26',NULL,4,3,'2024-05-30','2026-05-30','USD',3,4,2,'S301',NULL,NULL,NULL,1000.00,200.00,'Vigente',NULL,0.16,NULL,NULL,'Por generar',3,'P301',NULL),(20,709,'2024-06-26',NULL,4,3,'2024-05-30','2026-05-30','USD',3,4,2,'S301',NULL,NULL,NULL,1000.00,200.00,'Vigente',NULL,0.16,NULL,NULL,'Por generar',3,'P301',NULL),(21,709,'2024-06-26',NULL,4,3,'2024-05-30','2026-05-30','USD',3,4,2,'S301',NULL,NULL,NULL,1000.00,200.00,'Vigente',NULL,0.16,NULL,NULL,'Por generar',3,'P301',NULL),(22,709,'2024-06-26',NULL,4,3,'2024-05-30','2026-05-30','USD',3,4,2,'S301',NULL,NULL,NULL,1000.00,200.00,'Vigente',NULL,0.16,NULL,NULL,'Por generar',3,'P301',NULL),(23,1906,'2024-07-08',NULL,4,4,'2024-07-01','2025-07-01','MXN',3,4,23,'PolEnd1',NULL,NULL,NULL,1000.00,2000.00,'Vigente',116.00,0.16,0.72,1.00,'Generados',2,'PolEnd1',NULL),(24,1524,'2024-07-10',NULL,4,2,'2022-07-20','2024-07-20','MXN',2,2,2,'Sclose','Hey Jude',NULL,NULL,500.00,1000.00,'Finalizada',NULL,0.16,NULL,NULL,'Por generar',1,'Pclose',NULL),(25,1881,'2024-07-17',NULL,1,2,'2024-07-18','2026-07-18','USD',1,4,2,'S201',NULL,NULL,NULL,1000.00,2000.00,'Vigente',NULL,0.16,NULL,NULL,'Por generar',3,'P301',NULL),(26,1881,'2024-07-17',NULL,1,2,'2024-07-15','2026-07-15','USD',1,4,2,'S201',NULL,'P301',NULL,100.00,500.00,'Vigente',NULL,0.16,NULL,NULL,'Por generar',3,'Hey',NULL),(27,1881,'2024-07-17',NULL,1,2,'2024-07-09','2026-07-09','USD',1,4,2,'S201',NULL,'Hey',NULL,5454.00,45354.00,'Cancelada',NULL,0.16,NULL,NULL,'Por generar',3,'P300',NULL),(28,1881,'2024-07-17',NULL,1,2,'2024-07-01','2028-07-01','USD',1,4,2,'S201',NULL,'P300',NULL,100.00,500.00,'Cancelada',116.00,0.16,2.68,0.10,'Generados',3,'hey',NULL),(29,1881,'2024-08-02',NULL,1,2,'2021-01-01','2022-01-01','USD',1,4,2,'S201',NULL,'hey',NULL,4364.00,6357.00,'Cancelada',1017.15,0.16,0.06,0.10,'Generados',3,'r',NULL),(30,1915,'2024-08-25',NULL,4,4,'2021-08-10','2025-08-01','USD',2,3,13,'Snueva',NULL,NULL,NULL,1000.00,10000.00,'Vigente',100.00,1379.31,7520.69,100.00,'Generados',1,'Pnueva','C1'),(31,1917,'2024-08-29',NULL,2,3,'2024-07-28','2025-07-28','MXN',4,5,26,'3WKDD40X8DF840739',NULL,NULL,NULL,73926.78,93817.51,'Vigente',750.00,12940.35,6200.38,7392.68,'Generados',1,'111699656','C1');
/*!40000 ALTER TABLE `polizas` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2024-10-07 10:26:39
