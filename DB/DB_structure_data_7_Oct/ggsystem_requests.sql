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
-- Table structure for table `requests`
--

DROP TABLE IF EXISTS `requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `usuario_id` int NOT NULL,
  `timestamp` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `usuario_review_id` int DEFAULT NULL,
  `description` varchar(400) DEFAULT NULL,
  `status` enum('Pendiente','Aceptada','Rechazada') DEFAULT 'Pendiente',
  `row_id` int NOT NULL,
  `table_name` varchar(50) NOT NULL,
  `notas` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `usuario_id` (`usuario_id`),
  KEY `usuario_review_id` (`usuario_review_id`),
  CONSTRAINT `requests_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `requests_ibfk_2` FOREIGN KEY (`usuario_review_id`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=89 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `requests`
--

LOCK TABLES `requests` WRITE;
/*!40000 ALTER TABLE `requests` DISABLE KEYS */;
INSERT INTO `requests` VALUES (21,6,'2024-05-09 16:42:52',6,'Eliminar cliente Luis Edit May Custodio','Rechazada',0,'',NULL),(22,6,'2024-05-09 16:42:56',6,'Eliminar cliente Laura Gómez','Rechazada',0,'',NULL),(23,6,'2024-05-09 16:42:58',6,'Eliminar cliente Miguel Cruz','Aceptada',0,'',NULL),(24,6,'2024-05-09 16:43:01',6,'Eliminar cliente Paola Ortiz','Aceptada',0,'',NULL),(25,6,'2024-05-09 18:41:20',6,'Eliminar cliente Luis Edit May Custodio','Rechazada',0,'',NULL),(26,6,'2024-05-09 23:23:58',NULL,'Crea poliza Pnew','Aceptada',0,'',NULL),(27,6,'2024-05-09 23:25:17',NULL,'Crea poliza P3455','Aceptada',0,'',NULL),(28,6,'2024-05-09 23:25:57',NULL,'Crea poliza P3455','Aceptada',0,'',NULL),(29,6,'2024-05-10 00:41:41',NULL,'Crear Cliente Luis May Custodio','Aceptada',1914,'Cliente',NULL),(30,6,'2024-05-10 00:43:00',NULL,'Editar Cliente Luis Edit May Custodio','Aceptada',1,'Cliente',NULL),(31,6,'2024-05-10 00:43:43',NULL,'Editar Cliente Luis Edit 2 May Custodio','Aceptada',1,'Cliente',NULL),(32,6,'2024-05-10 00:43:51',NULL,'Editar Cliente Luis Edit 2 May Custodio','Aceptada',1,'Cliente',NULL),(33,6,'2024-05-10 00:44:40',6,'Eliminar cliente Luis Edit 2 May Custodio','Rechazada',1,'Cliente',NULL),(34,6,'2024-05-10 00:44:43',6,'Eliminar cliente Laura Gómez','Aceptada',9,'Cliente',NULL),(35,6,'2024-05-10 01:19:33',6,'Eliminar cliente Gabriel Dominguez','Rechazada',20,'Cliente',NULL),(36,6,'2024-05-10 01:24:22',6,'Eliminar cliente Luis Edit 2 May Custodio','Aceptada',1,'Cliente',NULL),(37,6,'2024-05-10 20:02:47',NULL,'Eliminar usuario Marina Marinada 2','Aceptada',7,'Usuario',NULL),(38,6,'2024-06-26 15:20:02',NULL,'Crear poliza P301','Aceptada',16,'Poliza',NULL),(39,6,'2024-06-26 15:20:05',NULL,'Crear poliza P301','Aceptada',17,'Poliza',NULL),(40,6,'2024-06-26 15:20:09',NULL,'Crear poliza P301','Aceptada',18,'Poliza',NULL),(41,6,'2024-06-26 15:20:10',NULL,'Crear poliza P301','Aceptada',19,'Poliza',NULL),(42,6,'2024-06-26 15:20:10',NULL,'Crear poliza P301','Aceptada',20,'Poliza',NULL),(43,6,'2024-06-26 15:20:10',NULL,'Crear poliza P301','Aceptada',21,'Poliza',NULL),(44,6,'2024-06-26 15:20:11',NULL,'Crear poliza P301','Aceptada',22,'Poliza',NULL),(45,6,'2024-07-08 18:48:14',NULL,'Pagar recibo 1 / 1 de la poliza AP1','Aceptada',1,'Recibo',NULL),(46,6,'2024-07-08 18:48:17',NULL,'Pagar recibo 1 / 1 de la poliza AP1','Aceptada',22,'Recibo',NULL),(47,6,'2024-07-08 20:23:31',NULL,'Cancelar pago del recibo 1 / 1 de la poliza AP1','Aceptada',22,'Recibo',NULL),(48,6,'2024-07-08 20:25:39',NULL,'Pagar recibo 1 / 1 de la poliza AP1','Aceptada',22,'Recibo',NULL),(49,6,'2024-07-08 20:25:40',NULL,'Cancelar pago del recibo 1 / 1 de la poliza AP1','Pendiente',22,'Recibo',NULL),(50,6,'2024-07-08 21:08:57',NULL,'Crear poliza PolEnd1','Aceptada',23,'Poliza',NULL),(51,6,'2024-07-08 21:24:40',NULL,'Pagar recibo 1 / 4 de la poliza PolEnd1','Aceptada',35,'Recibo',NULL),(52,6,'2024-07-08 21:24:41',NULL,'Pagar recibo 3 / 4 de la poliza PolEnd1','Aceptada',37,'Recibo',NULL),(53,6,'2024-07-08 21:24:56',NULL,'Eliminar cliente Luis May Custodio','Pendiente',1914,'Cliente',NULL),(54,6,'2024-07-10 22:35:08',NULL,'Crear poliza Pclose','Aceptada',24,'Poliza',NULL),(55,6,'2024-07-17 15:51:30',NULL,'Crear poliza P301','Aceptada',25,'Poliza',NULL),(56,6,'2024-07-17 17:38:53',NULL,'Crear poliza Hey','Aceptada',26,'Poliza',NULL),(57,6,'2024-07-17 17:40:37',NULL,'Crear poliza P300','Aceptada',27,'Poliza',NULL),(58,6,'2024-07-17 17:42:37',NULL,'Crear poliza hey','Aceptada',28,'Poliza',NULL),(59,6,'2024-07-17 17:51:46',NULL,'Crear endoso B para la póliza hey','Aceptada',1,'Endoso',NULL),(60,6,'2024-07-17 17:54:51',NULL,'Crear endoso B para la póliza hey','Aceptada',2,'Endoso',NULL),(61,6,'2024-07-17 18:18:03',NULL,'Crear endoso B para la póliza hey','Aceptada',3,'Endoso',NULL),(62,6,'2024-07-17 18:20:22',NULL,'Crear endoso B para la póliza hey','Aceptada',4,'Endoso',NULL),(63,6,'2024-07-17 18:23:03',NULL,'Crear endoso B para la póliza hey','Aceptada',5,'Endoso',NULL),(64,6,'2024-07-17 18:29:43',NULL,'Crear endoso B para la póliza Pclose','Aceptada',6,'Endoso',NULL),(65,6,'2024-08-02 16:14:10',NULL,'Crear poliza r','Aceptada',29,'Poliza',NULL),(66,6,'2024-08-16 04:10:54',6,'Cancelar póliza r','Rechazada',29,'Poliza',NULL),(67,6,'2024-08-16 04:24:53',NULL,'Cancelar póliza r','Pendiente',29,'Poliza','Porque si'),(68,6,'2024-08-16 06:18:58',NULL,'Crear endoso B para la póliza r','Aceptada',7,'Endoso',NULL),(69,6,'2024-08-16 06:34:25',NULL,'Crear endoso B para la póliza r','Aceptada',8,'Endoso',NULL),(70,6,'2024-08-16 06:36:34',NULL,'Crear endoso B para la póliza r','Aceptada',9,'Endoso',NULL),(71,6,'2024-08-16 06:41:45',NULL,'Crear endoso B para la póliza r','Aceptada',10,'Endoso',NULL),(72,6,'2024-08-16 06:44:31',NULL,'Crear endoso B para la póliza r','Aceptada',11,'Endoso',NULL),(73,6,'2024-08-16 06:46:47',NULL,'Crear endoso B para la póliza r','Aceptada',12,'Endoso',NULL),(74,6,'2024-08-16 06:51:23',NULL,'Crear endoso B para la póliza r','Aceptada',13,'Endoso',NULL),(75,6,'2024-08-20 03:08:39',NULL,'Cancelar póliza hey','Pendiente',28,'Poliza','Porque marin dice'),(76,6,'2024-08-20 03:09:20',NULL,'Cancelar póliza P300','Pendiente',27,'Poliza','Porque marin dice que el texto denbe ser muy grande y puede ser tan largo como quiera yo'),(77,6,'2024-08-25 19:57:01',NULL,'Crear Cliente Nuevo vacio apeelido','Aceptada',1915,'Cliente',NULL),(78,6,'2024-08-25 20:19:31',NULL,'Crear poliza Pnueva','Aceptada',30,'Poliza',NULL),(79,6,'2024-08-25 20:33:24',NULL,'Crear endoso B para la póliza Pnueva','Aceptada',14,'Endoso',NULL),(80,6,'2024-08-25 20:38:01',NULL,'Crear endoso B para la póliza Pnueva','Aceptada',15,'Endoso',NULL),(81,6,'2024-08-25 21:16:33',NULL,'Crear endoso B para la póliza Pnueva','Aceptada',16,'Endoso',NULL),(82,6,'2024-08-25 21:23:55',NULL,'Crear endoso B para la póliza Pnueva','Aceptada',17,'Endoso',NULL),(83,6,'2024-08-25 21:29:07',NULL,'Crear endoso B para la póliza Pnueva','Aceptada',18,'Endoso',NULL),(84,6,'2024-08-25 21:30:57',NULL,'Crear endoso B para la póliza Pnueva','Aceptada',19,'Endoso',NULL),(85,6,'2024-08-28 04:43:31',NULL,'Crear Cliente Marin vacio vacio 2','Aceptada',1916,'Cliente',NULL),(86,6,'2024-08-30 01:29:37',NULL,'Crear Cliente Emmanuel Hernandez Ramon','Aceptada',1917,'Cliente',NULL),(87,6,'2024-08-30 01:36:19',NULL,'Crear poliza 111699656','Aceptada',31,'Poliza',NULL),(88,6,'2024-08-30 01:44:09',NULL,'Crear endoso B para la póliza 111699656','Aceptada',20,'Endoso',NULL);
/*!40000 ALTER TABLE `requests` ENABLE KEYS */;
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
