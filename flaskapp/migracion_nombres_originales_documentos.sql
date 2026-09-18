ALTER TABLE recibos
    ADD COLUMN comprobante_original VARCHAR(255) NULL,
    ADD COLUMN complemento_pago_pdf_original VARCHAR(255) NULL,
    ADD COLUMN complemento_pago_xml_original VARCHAR(255) NULL;
