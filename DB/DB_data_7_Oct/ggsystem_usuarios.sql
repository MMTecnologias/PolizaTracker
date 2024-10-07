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
-- Dumping data for table `usuarios`
--

LOCK TABLES `usuarios` WRITE;
/*!40000 ALTER TABLE `usuarios` DISABLE KEYS */;
INSERT INTO `usuarios` VALUES (6,'LuisMay','scrypt:32768:8:1$OSxYjEQTbRMsT69E$4998ab733863d40ddffa42856b38490523d9c3a7f8b1a775bbbad53a12de801bd6f6cfa580b850701f07eb78d6276680932b25775c73c6b8fcf9ad7be32722c2',3,'Luis Chido','May Dev2','luismay3@mail.com','9932297934','Activo'),(7,'Marina','scrypt:32768:8:1$7J2ENtVdyx9x7z3A$f694abd9a775b4abb330010b64d8492da30476bf49d7c96f9453c586bf9fd12fd693cc16c9b2900dc5d2407f26af9b8ddefc1bb8c9933128060af97c7a185c87',1,'Marina','Marinada 2','marina@mail.com','9932297931','Eliminado'),(8,'Memo','scrypt:32768:8:1$B5eV4VcmA9J9Kyhr$4760efc61d4e6b91175024677f9d06ce1cbcf5661426e11a37325f0154707cd1b175197c30957fe7cc0281b483d0d1706eb9a3494ac6bd804568916f3ce0edee',4,'Guillermo','Gomez','memo@mail.com','9932297932','Activo'),(9,'Jorge','scrypt:32768:8:1$Ab8uXxWb6jxsklrb$acc9d3ca1a9dbbd72e2eddd432a3f9f5ffa8b72bad209931e726169028f2e464748ee02b43274f40a9a650f6dedfbf73c53a71c63a69d5051a869ecdea003f8e',1,'Jorge','Erick','jorge@mail.com','9932297931','Activo'),(10,'Emilio','scrypt:32768:8:1$YOgHqQBmNhxP9xJM$4f6f52b2334b33ebfbbf2f68ae9212461aa2369818043cc7b42ba1bb624b6d4fecd9d818310838dab548cbea33881eb9ccf8aa3ee6959f8d4d6bc1f147d7b2b5',4,'Emilio','MArquez','emilio@mail.com','9932297931','Activo'),(11,'admin','scrypt:32768:8:1$ZhyjrZ1rZQDy7dXI$9772252543f9e085eba6ddbbf7d02495002f91007e67b9bf2af1a0971decc1bc91e01443254dfbf246cfd72164cd84a4e9f2de99c1394239c0425a6e9a946395',1,'Luis Admin','Custodio','luismay_99@hotmail.com','9932297934','Activo'),(12,'usuario','scrypt:32768:8:1$fu8BHkjLd0zPxnxa$fac455d24d86ebfd5680a2b6b39fb92d577070fae1182ef72109fdb30ab46f935a2c412fdf71a202b2875a1d55ff69dd1ef337e6202a43520561c17e2597c6f1',2,'Luis 3','Usuario','luismay_99@hotmail.com','9932297934','Activo'),(13,'may4599','scrypt:32768:8:1$0MAmmnDqZBY4RBkS$b9a233d9c900afa9bdd10ea016993934ba2ea42fd90b011257bca8809a963cfa893a398dd34d6a24e6f693bfc346af018b56a9ca67a40c08037c4559b56ad8ba',3,'Luis','May Custodio','luismay_99@hotmail.com','9932297934','Activo'),(14,'Luis_user','scrypt:32768:8:1$Z6UIfJn6GqjV57lC$f5ec923b92067ca9368ec0e6d9c8c8c6eb5dcf6fbb851d73c203ba3b995c9e2f60a27fd1fb19336f854a51d29890640f4ec2ab22399e48f1b78b10f19109ec5a',2,'Luis new','May Custodio','luismay_99@hotmail.com','9932297934','Activo'),(15,'luism','scrypt:32768:8:1$Yxsk9yrvhxUCshOI$dc57f998ba06a934d8da1b2f1e95bcf95cd0a5b6aaba3bc1a8f805cd433d815d3be9b9888ba72e51d7425f27a391e1bb76c94960e47836e545c0b8a398761c48',3,'Luis','May Custodio','luismay_99@hotmail.com','9932297934','Activo'),(16,'djndj','scrypt:32768:8:1$OP76MDKquQ6qF2YA$33476809291e52744e47deccd58d1d24567b2a09514a2f4a39d003544f252180d1ccb29342fae52b940cb56b66bac5ec29e0e1239ff2d18e76dbb698f04b4ac5',4,'Luis','May Custodio','luismay_99@hotmail.com','9932297934','Activo'),(17,'luismuser','scrypt:32768:8:1$bTvYu2RVlsfLHPvJ$fa63e198f37c69bd552ba922c6c02cee5aff151c703b51a43ed1ef29f021ea796b17ddb35c0401a2b0557cfd442cd196fb07ea332d6c332c04c73f9b64dc6046',4,'Luis','May Custodio','luismay_99@hotmail.com','9932297934','Activo'),(18,'gerente','scrypt:32768:8:1$HpvXHEuUAF04KXnF$a16778f3cf5d775cdc7ea71a24a9d011fad3ed65903dec5e93f93963b856477bb59149950285a705fb5db17225647d934c94932937372caf2944b2aff0a48748',4,'Luis Gerente','May Custodio','luismay_99@hotmail.com','9932297934','Activo'),(19,'LuisMay4','scrypt:32768:8:1$1qm3cPZDXsJKt7Vd$835392a9026eb3543af94219d1d379d352e395302096cb8d1ca0486496df9610b5e0044ba3f5d86fe18408427bd5a19ea894332aea79280f3f8af84fb6a0c708',4,'Luis','May Custodio','luismay_99@hotmail.com','9932297934','Activo');
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

-- Dump completed on 2024-10-07 10:27:00
