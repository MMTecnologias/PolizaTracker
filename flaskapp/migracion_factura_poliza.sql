ALTER TABLE polizas
    ADD COLUMN factura_pdf VARCHAR(60) NULL,
    ADD COLUMN factura_xml VARCHAR(60) NULL,
    ADD COLUMN factura_pdf_original VARCHAR(255) NULL,
    ADD COLUMN factura_xml_original VARCHAR(255) NULL;
