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
-- Table structure for table `accesos`
--

DROP TABLE IF EXISTS `accesos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `accesos` (
  `servicio_id` int NOT NULL,
  `nivel_id` int NOT NULL,
  KEY `servicio_id` (`servicio_id`),
  KEY `nivel_id` (`nivel_id`),
  CONSTRAINT `accesos_ibfk_1` FOREIGN KEY (`servicio_id`) REFERENCES `servicios` (`id`),
  CONSTRAINT `accesos_ibfk_2` FOREIGN KEY (`nivel_id`) REFERENCES `niveles_acceso` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `accesos`
--

LOCK TABLES `accesos` WRITE;
/*!40000 ALTER TABLE `accesos` DISABLE KEYS */;
INSERT INTO `accesos` VALUES (12,1),(13,1),(6,2),(7,2),(8,2),(9,2),(10,2),(6,3),(7,3),(8,3),(9,3),(10,3),(11,3),(12,3),(13,3),(6,4),(7,4),(8,4),(9,4),(10,4),(11,4);
/*!40000 ALTER TABLE `accesos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `agentes`
--

DROP TABLE IF EXISTS `agentes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `agentes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(50) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `agentes`
--

LOCK TABLES `agentes` WRITE;
/*!40000 ALTER TABLE `agentes` DISABLE KEYS */;
INSERT INTO `agentes` VALUES (2,'Abby'),(1,'Memo');
/*!40000 ALTER TABLE `agentes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `aseguradoras`
--

DROP TABLE IF EXISTS `aseguradoras`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `aseguradoras` (
  `id` int NOT NULL AUTO_INCREMENT,
  `aseguradora` varchar(40) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `aseguradora` (`aseguradora`)
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `aseguradoras`
--

LOCK TABLES `aseguradoras` WRITE;
/*!40000 ALTER TABLE `aseguradoras` DISABLE KEYS */;
INSERT INTO `aseguradoras` VALUES (5,'AXA'),(2,'BBVA'),(13,'gnp'),(15,'GNPp'),(3,'INBURSA'),(1,'METLIFE');
/*!40000 ALTER TABLE `aseguradoras` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `clientes`
--

DROP TABLE IF EXISTS `clientes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `clientes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(50) NOT NULL,
  `grupo_id` int NOT NULL,
  `rfc` varchar(13) NOT NULL,
  `tel_oficina` char(10) DEFAULT NULL,
  `tel_movil` char(10) DEFAULT NULL,
  `tel_casa` char(10) DEFAULT NULL,
  `correo` varchar(50) NOT NULL,
  `direccion` varchar(125) DEFAULT NULL,
  `fecha_nacimiento` date NOT NULL,
  `sexo` enum('Hombre','Mujer','Otro') NOT NULL,
  `ocupacion` varchar(30) DEFAULT NULL,
  `actividad` varchar(30) DEFAULT NULL,
  `apellido` varchar(50) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `rfc` (`rfc`),
  KEY `grupo_id` (`grupo_id`),
  CONSTRAINT `clientes_ibfk_1` FOREIGN KEY (`grupo_id`) REFERENCES `grupos` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=42 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `clientes`
--

LOCK TABLES `clientes` WRITE;
/*!40000 ALTER TABLE `clientes` DISABLE KEYS */;
INSERT INTO `clientes` VALUES (1,'Luis Edit',7,'MACL99sasgwud','9932297934','9932079325','','luismay_99@hotmail.com','Privada Tlaxcala 25','1999-05-04','Hombre','Trabajador','Office','May Custodio'),(2,'Angel Edited',5,'MAR06','9932297934','9934072546','9932297934','luismay_99@hotmail.com','Privada Tlaxcala 25','1980-03-31','Hombre','Trabajador','Office','May Custodio'),(3,'Luis',1,'MAC99','9932297934','9932297934',NULL,'luis@mail.com',NULL,'1999-05-04','Hombre',NULL,NULL,'May'),(5,'María',2,'MAR123','9987654321','9987654321','','maria@example.com','','1990-07-15','Hombre','','','González'),(6,'Juan',1,'JUA456','9876543210','9876543210','','juan@example.com','','1985-03-22','Hombre','','','Martínez de OCa'),(7,'Ana',3,'ANA789','9876541230','9876541230',NULL,'ana@example.com',NULL,'1978-11-10','Hombre',NULL,NULL,'Rodríguez'),(8,'Pedro',2,'PED654','9876541320','9876541320',NULL,'pedro@example.com',NULL,'1982-09-03','Hombre',NULL,NULL,'Hernández'),(9,'Laura',1,'LAU321','9876542130','9876542130',NULL,'laura@example.com',NULL,'1995-04-27','Hombre',NULL,NULL,'Gómez'),(10,'Carlos',3,'CAR987','9876542310','9876542310',NULL,'carlos@example.com',NULL,'1999-12-30','Hombre',NULL,NULL,'Díaz'),(11,'Sofía',2,'SOF258','9876543210','9876543210',NULL,'sofia@example.com',NULL,'1991-08-20','Hombre',NULL,NULL,'López'),(12,'Alejandro',1,'ALE369','9876543012','9876543012',NULL,'alejandro@example.com',NULL,'1988-06-18','Hombre',NULL,NULL,'Pérez'),(13,'Elena',3,'ELE147','9876543201','9876543201',NULL,'elena@example.com',NULL,'1976-02-14','Hombre',NULL,NULL,'Sánchez'),(14,'Daniel',2,'DAN258','9876543120','9876543120',NULL,'daniel@example.com',NULL,'1993-10-08','Hombre',NULL,NULL,'García'),(15,'Lucía',1,'LUC456','9876543102','9876543102',NULL,'lucia@example.com',NULL,'1980-05-01','Hombre',NULL,NULL,'Fernández'),(16,'Jorge',3,'JOR987','9876543012','9876543012',NULL,'jorge@example.com',NULL,'1974-07-11','Hombre',NULL,NULL,'Torres'),(17,'Valeria',2,'VAL321','9876543021','9876543021',NULL,'valeria@example.com',NULL,'1997-11-25','Hombre',NULL,NULL,'Ruiz'),(18,'Miguel',1,'MIG258','9876543102','9876543102',NULL,'miguel@example.com',NULL,'1987-03-17','Hombre',NULL,NULL,'Cruz'),(19,'Paola',3,'PAO147','9876543120','9876543120',NULL,'paola@example.com',NULL,'1992-09-09','Hombre',NULL,NULL,'Ortiz'),(20,'Gabriel',2,'GAB369','9876543012','9876543012',NULL,'gabriel@example.com',NULL,'1984-12-06','Hombre',NULL,NULL,'Dominguez'),(21,'Julia',1,'JUL456','9876543201','9876543201',NULL,'julia@example.com',NULL,'1979-08-28','Hombre',NULL,NULL,'Ramírez'),(22,'Diego',3,'DIE987','9876543102','9876543102',NULL,'diego@example.com',NULL,'1996-06-23','Hombre',NULL,NULL,'Núñez'),(23,'Fernanda',2,'FER321','9876543012','9876543012',NULL,'fernanda@example.com',NULL,'1983-02-19','Hombre',NULL,NULL,'Santos'),(24,'Andrés',1,'AND258','9876543120','9876543120',NULL,'andres@example.com',NULL,'1998-04-13','Hombre',NULL,NULL,'Reyes'),(25,'Carolina',3,'CAR147','9876543201','9876543201',NULL,'carolina@example.com',NULL,'1977-10-05','Hombre',NULL,NULL,'Gutiérrez'),(26,'Martín',2,'MAR369','9876543102','9876543102',NULL,'martin@example.com',NULL,'1994-12-31','Hombre',NULL,NULL,'Vázquez'),(27,'Sara',1,'SAR456','9876543201','9876543201',NULL,'sara@example.com',NULL,'1981-07-24','Hombre',NULL,NULL,'Iglesias'),(28,'Roberto',3,'ROB987','9876543012','9876543012',NULL,'roberto@example.com',NULL,'1973-05-16','Hombre',NULL,NULL,'León'),(29,'Cristina',2,'CRI321','9876543120','9876543120',NULL,'cristina@example.com',NULL,'1990-03-11','Hombre',NULL,NULL,'Molina'),(30,'Raúl',1,'RAU258','9876543201','9876543201',NULL,'raul@example.com',NULL,'1986-09-02','Hombre',NULL,NULL,'Aguilar'),(31,'Lorena',3,'LOR147','9876543102','9876543102',NULL,'lorena@example.com',NULL,'1999-02-26','Hombre',NULL,NULL,'Jiménez'),(32,'Emilio editado',2,'EMI369','9876543012','9876543012','','emilio@example.com','','1975-04-21','Hombre','','','Castro'),(33,'Adriana',1,'ADR456','9876543201','9876543201',NULL,'adriana@example.com',NULL,'1992-12-14','Hombre',NULL,NULL,'Herrera'),(34,'Hugo',3,'HUG987','9876543120','9876543120',NULL,'hugo@example.com',NULL,'1989-08-07','Hombre',NULL,NULL,'Flores'),(35,'Luis',3,'MACL990504712',NULL,NULL,NULL,'luismay_99@hotmail.com',NULL,'2024-02-13','Hombre','Home',NULL,'May Custodio'),(37,'Luis',4,'MACL990504355',NULL,NULL,NULL,'luismay_99@hotmail.com',NULL,'2024-02-20','Mujer','Home',NULL,'May Custodio'),(38,'Dummy',1,'DUMMY12345678',NULL,NULL,NULL,'dummy@mail.com',NULL,'2020-10-21','Otro',NULL,NULL,'Client'),(39,'Luis',2,'cndkdjskdjsdl','9932297934',') 229-7934','9932297934','luismay_99@hotmail.com','Privada Tlaxcala 25','2024-02-04','Hombre','Home','Office','May Custodio'),(40,'editado',1,'MACL990453453','9932297934','9932079325','9932297934','luismay_99@hotmail.com','Privada Tlaxcala 25','1999-05-04','Hombre','Trabajador','Office','May Custodio'),(41,'Luis',6,'fgmdkvldsfkdl','9932297931','9932297932','9932297933','luismay_99@hotmail.com','Privada Tlaxcala 25','2024-02-12','Hombre','Home','Office','May Custodio');
/*!40000 ALTER TABLE `clientes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `grupos`
--

DROP TABLE IF EXISTS `grupos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `grupos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `grupo` varchar(50) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `grupo` (`grupo`),
  UNIQUE KEY `grupo_2` (`grupo`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `grupos`
--

LOCK TABLES `grupos` WRITE;
/*!40000 ALTER TABLE `grupos` DISABLE KEYS */;
INSERT INTO `grupos` VALUES (8,''),(2,'Angelopolis A'),(7,'Eliazar'),(1,'General B'),(6,'Julio'),(4,'Luis'),(5,'Marin'),(3,'Parra');
/*!40000 ALTER TABLE `grupos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `niveles_acceso`
--

DROP TABLE IF EXISTS `niveles_acceso`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `niveles_acceso` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(50) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `niveles_acceso`
--

LOCK TABLES `niveles_acceso` WRITE;
/*!40000 ALTER TABLE `niveles_acceso` DISABLE KEYS */;
INSERT INTO `niveles_acceso` VALUES (1,'Administrador'),(3,'Desarollador'),(4,'Gerente'),(2,'Usuario');
/*!40000 ALTER TABLE `niveles_acceso` ENABLE KEYS */;
UNLOCK TABLES;

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
  `moneda` enum('MXN','USD','Otro') NOT NULL,
  `tipo_pago_id` int NOT NULL,
  `agente_id` int NOT NULL,
  `aseguradora_id` int NOT NULL,
  `serie` varchar(30) NOT NULL,
  `notas` varchar(400) DEFAULT NULL,
  `poliza_anterior` varchar(30) DEFAULT NULL,
  `renovacion` varchar(30) DEFAULT NULL,
  `prima_neta` decimal(12,2) NOT NULL,
  `prima_total` decimal(12,2) NOT NULL,
  `status` enum('Vigente','Pendiente','Cancelada','Finalizada') NOT NULL,
  PRIMARY KEY (`id`),
  KEY `cliente_id` (`cliente_id`),
  KEY `ramo_id` (`ramo_id`),
  KEY `subramo_id` (`subramo_id`),
  KEY `tipo_pago_id` (`tipo_pago_id`),
  KEY `agente_id` (`agente_id`),
  KEY `aseguradora_id` (`aseguradora_id`),
  CONSTRAINT `polizas_ibfk_1` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`),
  CONSTRAINT `polizas_ibfk_2` FOREIGN KEY (`ramo_id`) REFERENCES `ramos` (`id`),
  CONSTRAINT `polizas_ibfk_3` FOREIGN KEY (`subramo_id`) REFERENCES `subramos` (`id`),
  CONSTRAINT `polizas_ibfk_4` FOREIGN KEY (`tipo_pago_id`) REFERENCES `tipos_pagos` (`id`),
  CONSTRAINT `polizas_ibfk_5` FOREIGN KEY (`agente_id`) REFERENCES `agentes` (`id`),
  CONSTRAINT `polizas_ibfk_6` FOREIGN KEY (`aseguradora_id`) REFERENCES `aseguradoras` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `polizas`
--

LOCK TABLES `polizas` WRITE;
/*!40000 ALTER TABLE `polizas` DISABLE KEYS */;
INSERT INTO `polizas` VALUES (3,1,'2023-12-26','Si',1,3,'2023-12-26','2024-12-26','MXN',1,1,3,'AB1',NULL,NULL,NULL,2639.23,3500.00,'Vigente'),(4,2,'2021-12-26','What?',2,1,'2022-03-26','2024-03-26','MXN',3,1,2,'sd2',NULL,'1939DDF23','12332',150000.00,200000.00,'Vigente'),(5,1,'2021-12-26',NULL,3,2,'2023-08-26','2024-08-26','USD',2,2,2,'ADJ4',NULL,NULL,NULL,93628.23,100000.00,'Vigente');
/*!40000 ALTER TABLE `polizas` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ramos`
--

DROP TABLE IF EXISTS `ramos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ramos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ramo` varchar(30) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ramo` (`ramo`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ramos`
--

LOCK TABLES `ramos` WRITE;
/*!40000 ALTER TABLE `ramos` DISABLE KEYS */;
INSERT INTO `ramos` VALUES (2,'Auto'),(3,'SGM'),(1,'Vida');
/*!40000 ALTER TABLE `ramos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `recibos`
--

DROP TABLE IF EXISTS `recibos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `recibos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `fecha_inicio` date NOT NULL,
  `fecha_vencimiento` date NOT NULL,
  `poliza_id` int NOT NULL,
  `prima_neta` decimal(12,2) NOT NULL,
  `prima_total` decimal(12,2) NOT NULL,
  `comision` decimal(12,2) NOT NULL,
  `status` enum('Liquidado','Pendiente','Vencido','Cancelado') NOT NULL,
  `fecha_pago` date DEFAULT NULL,
  `comprobante` varchar(30) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `poliza_id` (`poliza_id`),
  CONSTRAINT `recibos_ibfk_1` FOREIGN KEY (`poliza_id`) REFERENCES `polizas` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `recibos`
--

LOCK TABLES `recibos` WRITE;
/*!40000 ALTER TABLE `recibos` DISABLE KEYS */;
INSERT INTO `recibos` VALUES (1,'2023-12-26','2023-01-26',3,2639.23,3500.00,200.00,'Pendiente',NULL,NULL),(2,'2022-03-26','2022-04-26',4,37500.00,50000.00,1000.00,'Liquidado','2022-04-02','AEFJ34'),(3,'2022-09-26','2022-10-26',4,37500.00,50000.00,1000.00,'Liquidado','2022-10-15','SDAA12'),(4,'2023-03-26','2023-04-26',4,37500.00,50000.00,1000.00,'Liquidado','2023-04-12','SDAF34'),(5,'2023-09-26','2023-10-26',4,37500.00,50000.00,1000.00,'Liquidado','2023-10-01','DALK45');
/*!40000 ALTER TABLE `recibos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `servicios`
--

DROP TABLE IF EXISTS `servicios`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `servicios` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(50) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `servicios`
--

LOCK TABLES `servicios` WRITE;
/*!40000 ALTER TABLE `servicios` DISABLE KEYS */;
INSERT INTO `servicios` VALUES (13,'Admin usuarios'),(7,'Clientes'),(6,'Documentos'),(8,'Recibos'),(10,'Reportes'),(11,'Reportes Gerenciales'),(12,'Utilerias'),(9,'Vencimientos');
/*!40000 ALTER TABLE `servicios` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `solicitudes_new_pass`
--

DROP TABLE IF EXISTS `solicitudes_new_pass`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `solicitudes_new_pass` (
  `usuario_id` int NOT NULL,
  `status` enum('Resuelta','Pendiente') NOT NULL DEFAULT 'Pendiente',
  UNIQUE KEY `usuario_id` (`usuario_id`),
  CONSTRAINT `solicitudes_new_pass_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `solicitudes_new_pass`
--

LOCK TABLES `solicitudes_new_pass` WRITE;
/*!40000 ALTER TABLE `solicitudes_new_pass` DISABLE KEYS */;
INSERT INTO `solicitudes_new_pass` VALUES (6,'Pendiente'),(7,'Pendiente'),(8,'Pendiente');
/*!40000 ALTER TABLE `solicitudes_new_pass` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `subramos`
--

DROP TABLE IF EXISTS `subramos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `subramos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `subramo` varchar(30) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `subramo` (`subramo`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `subramos`
--

LOCK TABLES `subramos` WRITE;
/*!40000 ALTER TABLE `subramos` DISABLE KEYS */;
INSERT INTO `subramos` VALUES (2,'Familiar'),(3,'Grupal'),(1,'Individual');
/*!40000 ALTER TABLE `subramos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tipos_pagos`
--

DROP TABLE IF EXISTS `tipos_pagos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tipos_pagos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tipo_pago` varchar(25) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `tipo_pago` (`tipo_pago`),
  UNIQUE KEY `tipo_pago_2` (`tipo_pago`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tipos_pagos`
--

LOCK TABLES `tipos_pagos` WRITE;
/*!40000 ALTER TABLE `tipos_pagos` DISABLE KEYS */;
INSERT INTO `tipos_pagos` VALUES (4,'Bimestral'),(2,'Mensual'),(3,'Semestral'),(1,'Unico');
/*!40000 ALTER TABLE `tipos_pagos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `usuarios`
--

DROP TABLE IF EXISTS `usuarios`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `usuarios` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(10) NOT NULL,
  `password` varchar(520) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `nivel_id` int NOT NULL,
  `nombre` varchar(50) NOT NULL,
	`apellido` varchar(50) NOT NULL,
	`correo` varchar(50) NOT NULL,
	`telefono` char(10) NOT NULL,
    `status` ENUM('Activo', 'Eliminado') NOT NULL default 'Activo',
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  KEY `nivel_id` (`nivel_id`),
  CONSTRAINT `usuarios_ibfk_1` FOREIGN KEY (`nivel_id`) REFERENCES `niveles_acceso` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `usuarios`
--

LOCK TABLES `usuarios` WRITE;
/*!40000 ALTER TABLE `usuarios` DISABLE KEYS */;
INSERT INTO `usuarios` VALUES (6,'LuisMay','scrypt:32768:8:1$T28QmqMKvw91gR6X$e71b5ab64d18cb42c9b59f56ee61a3149115e1b2e913e04695e7646af1d8c2628b960d9a4b87a2520a17429b01a3ae7634f641f6ebe904e14208766ae0a09d3b',3),(7,'Marina','scrypt:32768:8:1$7J2ENtVdyx9x7z3A$f694abd9a775b4abb330010b64d8492da30476bf49d7c96f9453c586bf9fd12fd693cc16c9b2900dc5d2407f26af9b8ddefc1bb8c9933128060af97c7a185c87',1),(8,'Memo','scrypt:32768:8:1$B5eV4VcmA9J9Kyhr$4760efc61d4e6b91175024677f9d06ce1cbcf5661426e11a37325f0154707cd1b175197c30957fe7cc0281b483d0d1706eb9a3494ac6bd804568916f3ce0edee',4);
/*!40000 ALTER TABLE `usuarios` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2024-02-18 23:29:25
