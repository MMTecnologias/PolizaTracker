CREATE TABLE IF NOT EXISTS recordatorios_cobro (
  id INT AUTO_INCREMENT PRIMARY KEY,
  recibo_id INT NOT NULL,
  tipo ENUM('previo','vencido') NOT NULL,
  destinatario VARCHAR(120) NULL,
  enviado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
  resultado VARCHAR(255) NULL,
  UNIQUE KEY uq_recordatorio_recibo_tipo (recibo_id, tipo),
  CONSTRAINT fk_recordatorio_recibo FOREIGN KEY (recibo_id) REFERENCES recibos(id)
);
