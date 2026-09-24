INSERT INTO tipos_pagos (tipo_pago, pagos_anuales, contado)
SELECT 'Cuatrimestral', 3, 'No'
WHERE NOT EXISTS (SELECT 1 FROM tipos_pagos WHERE tipo_pago = 'Cuatrimestral');
