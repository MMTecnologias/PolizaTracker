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

--
-- Dumping data for table `endosos`
--

LOCK TABLES `endosos` WRITE;
/*!40000 ALTER TABLE `endosos` DISABLE KEYS */;
INSERT INTO `endosos` VALUES (1,'B',1881,28,'2024-07-17','1',4,4,'2024-07-08','2025-07-08','USD',3,5,25,'S200',NULL,NULL,NULL,5454.00,10000.00,NULL,NULL,0.16,NULL,NULL,'Por generar',3,'hey',NULL),(2,'B',1881,28,'2024-07-17','2',4,4,'2024-07-04','2028-07-04','MXN',5,5,25,'S200',NULL,NULL,NULL,100.00,200.00,NULL,116.00,0.16,-0.32,0.10,'Generados',3,'hey',NULL),(3,'B',1881,28,'2024-07-17','3',4,4,'2024-07-01','2030-07-01','USD',5,5,25,'S200',NULL,NULL,NULL,43.00,500.00,NULL,116.00,0.16,7.77,0.10,'Generados',3,'hey',NULL),(4,'B',1881,28,'2024-07-17','4',4,4,'2022-01-01','2029-01-01','USD',5,5,25,'q',NULL,NULL,NULL,43.00,500.00,NULL,116.00,0.16,7.77,0.10,'Generados',3,'hey',NULL),(5,'B',1881,28,'2024-07-17','5',4,4,'2024-07-10','2029-07-10','MXN',5,5,25,'fgdfgdsfg',NULL,NULL,NULL,345345.00,45354.00,NULL,116.00,0.16,-1.03,0.10,'Generados',3,'hey',NULL),(6,'B',1524,24,'2024-07-17','6',2,4,'2024-07-10','2030-07-10','USD',5,5,25,'fgdfgdsfg',NULL,NULL,NULL,5454.00,45354.00,NULL,116.00,0.16,7.13,0.10,'Generados',3,'Pclose',NULL),(7,'B',1881,29,'2024-08-16','E',4,4,'2024-02-01','2024-09-04','MXN',2,5,23,'S1',NULL,NULL,NULL,4364.13,6357.14,NULL,NULL,0.16,NULL,NULL,'Por generar',3,'r',NULL),(8,'B',1881,29,'2024-08-16','P300',4,4,'2021-10-01','2022-01-01','MXN',2,5,25,'S200',NULL,NULL,NULL,4364.13,6357.14,NULL,NULL,0.16,NULL,NULL,'Por generar',3,'r',NULL),(9,'B',1881,29,'2024-08-16','q',4,4,'2021-01-01','2022-01-01','MXN',4,5,25,'q',NULL,NULL,NULL,1.00,2.00,NULL,NULL,0.16,NULL,NULL,'Por generar',3,'r',NULL),(10,'B',1881,29,'2024-08-16','P300',4,4,'2021-10-01','2022-01-01','MXN',2,5,25,'S200',NULL,NULL,NULL,4364.13,6357.14,NULL,NULL,0.16,NULL,NULL,'Por generar',3,'r',NULL),(11,'B',1881,29,'2024-08-16','P300',4,4,'2021-10-10','2022-01-01','USD',2,5,25,'S200',NULL,NULL,NULL,4363.13,6357.14,NULL,NULL,0.16,NULL,NULL,'Por generar',3,'r',NULL),(12,'B',1881,29,'2024-08-16','P300',4,4,'2020-01-01','2022-01-01','USD',3,5,25,'S200',NULL,NULL,NULL,4363.13,6357.14,NULL,NULL,0.16,NULL,NULL,'Por generar',3,'r',NULL),(13,'B',1881,29,'2024-08-16','P300',4,4,'2020-01-01','2022-01-01','MXN',4,5,25,'S200',NULL,NULL,NULL,4364.13,6357.14,NULL,750.00,876.85,366.16,436.41,'Generados',3,'r',NULL),(14,'B',1915,30,'2024-08-25','sEndoso',4,4,'2021-10-10','2025-08-01','MXN',2,5,25,'dsss',NULL,NULL,NULL,100.00,1000.00,NULL,100.00,137.93,662.07,12.00,'Generados',3,'Pnueva',NULL),(15,'B',1915,30,'2024-08-25','E2',4,4,'2025-06-09','2025-08-01','USD',2,5,25,'S2',NULL,NULL,NULL,1000.00,2000.00,NULL,100.00,275.86,624.14,120.00,'Generados',3,'Pnueva',NULL),(16,'B',1915,30,'2024-08-25','Sn2',4,4,'2024-08-14','2025-08-01','USD',2,5,25,'Sn2',NULL,NULL,NULL,100.00,10000.00,NULL,NULL,0.16,NULL,NULL,'Por generar',3,'Pnueva',NULL),(17,'B',1915,30,'2024-08-25','Pint2',4,4,'2024-08-25','2025-08-01','MXN',2,5,25,'Sint2',NULL,NULL,NULL,100.00,1000.00,NULL,NULL,0.16,NULL,NULL,'Por generar',3,'Pnueva',NULL),(18,'B',1915,30,'2024-08-25','Ahora si',4,4,'2024-08-25','2025-08-01','MXN',5,5,25,'Yei',NULL,NULL,NULL,100.00,200.00,NULL,100.00,27.59,-27.59,12.00,'Generados',3,'Pnueva',NULL),(19,'B',1915,30,'2024-08-25','N',4,4,'2024-08-25','2025-08-01','USD',2,5,25,'S',NULL,NULL,NULL,100.00,1000.00,NULL,100.00,137.93,662.07,12.00,'Generados',3,'Pnueva',NULL),(20,'B',1917,31,'2024-08-29','1',2,3,'2024-07-28','2025-07-28','MXN',4,5,26,'3WKDD40X8DF840739',NULL,NULL,NULL,2882.14,3538.87,NULL,0.00,488.12,168.61,0.00,'Generados',3,'111699656',NULL);
/*!40000 ALTER TABLE `endosos` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2024-10-07 10:26:40
