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
-- Table structure for table `log`
--

DROP TABLE IF EXISTS `log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `request_id` int NOT NULL,
  `column_name` varchar(50) NOT NULL,
  `old_value` varchar(400) DEFAULT NULL,
  `new_value` varchar(400) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `request_id` (`request_id`),
  CONSTRAINT `log_ibfk_1` FOREIGN KEY (`request_id`) REFERENCES `requests` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=57 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `log`
--

LOCK TABLES `log` WRITE;
/*!40000 ALTER TABLE `log` DISABLE KEYS */;
INSERT INTO `log` VALUES (19,21,'status','Activo','Eliminado'),(20,22,'status','Activo','Eliminado'),(21,23,'status','Activo','Eliminado'),(22,24,'status','Activo','Eliminado'),(23,25,'status','Activo','Eliminado'),(24,28,'cliente_id','','893'),(25,28,'fecha_inicio','','2024-05-18'),(26,28,'fecha_termino','','2024-05-16'),(27,28,'moneda','','MXN'),(28,28,'tipo_pago_id','','2'),(29,28,'serie','','S445'),(30,28,'prima_neta','','100'),(31,28,'prima_total','','200'),(32,28,'poliza','','P3455'),(33,28,'ramo_id','','3'),(34,28,'subramo_id','','3'),(35,28,'aseguradora_id','','13'),(36,28,'vendedor_id','','3'),(37,28,'agente_id','','3'),(38,28,'fecha_captura','','2024-05-09'),(39,30,'grupo_id','17','20'),(40,30,'direccion','Privada Tlaxcala 25','Privada Tlaxcala 25 int 4'),(41,30,'ocupacion','Trabajador','Trabajador muy bueno'),(42,31,'nombre','Luis Edit','Luis Edit 2'),(43,32,'direccion','Privada Tlaxcala 25 int 4','Privada Tlaxcala 25 int 4 1'),(44,33,'status','Activo','Eliminado'),(45,34,'status','Activo','Eliminado'),(46,35,'status','Activo','Eliminado'),(47,36,'status','Activo','Eliminado'),(48,47,'status','Liquidado','Pendiente'),(49,47,'fecha_pago','2024-7-8',NULL),(50,49,'status','Liquidado','Pendiente'),(51,49,'fecha_pago','2024-7-8',NULL),(52,53,'status','Activo','Eliminado'),(53,66,'status','Vigente','Cancelada'),(54,67,'status','Vigente','Cancelada'),(55,75,'status','Vigente','Cancelada'),(56,76,'status','Vigente','Cancelada');
/*!40000 ALTER TABLE `log` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2024-09-04  8:31:11
