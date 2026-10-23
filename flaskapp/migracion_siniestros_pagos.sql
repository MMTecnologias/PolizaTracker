-- Pagos de siniestros: estados Pendiente / Pagado / Cancelado.
-- Paso 1: permitir temporalmente los estados viejos y nuevos a la vez
ALTER TABLE siniestro_pagos
  MODIFY estado ENUM('Vigente','Pendiente','Pagado','Cancelado') NOT NULL DEFAULT 'Pagado';

-- Paso 2: los pagos "Vigente" pasan a "Pagado"
UPDATE siniestro_pagos SET estado = 'Pagado' WHERE estado = 'Vigente';

-- Paso 3: dejar sólo los estados nuevos; la fecha de pago puede quedar vacía mientras esté Pendiente
ALTER TABLE siniestro_pagos
  MODIFY estado ENUM('Pendiente','Pagado','Cancelado') NOT NULL DEFAULT 'Pagado',
  MODIFY fecha_pago DATE NULL;

-- Verificación
SELECT estado, COUNT(*) AS pagos FROM siniestro_pagos GROUP BY estado;
