# Gestión de PDFs en Pólizas

## Flujo implementado

### 1. Subida de PDF (`/upload_pdf`)
- Valida el archivo (tamaño, formato, header PDF)
- Extrae texto del PDF
- Procesa con Ollama para extraer datos
- Busca o crea: Cliente, Aseguradora, Agente, Vendedor
- **Guarda el PDF temporalmente**
- Retorna datos extraídos + `pdf_path`

### 2. Guardar Póliza (`/create`)
- Recibe `pdf_path` en el formulario
- Si la póliza se guarda exitosamente:
  - Vincula el `pdf_path` a la póliza
  - El PDF se conserva permanentemente
- Si hay error o el usuario cancela:
  - El frontend debe llamar a `/delete_temp_pdf`

### 3. Eliminar PDF temporal (`/delete_temp_pdf`)
- Endpoint para eliminar PDFs no vinculados
- El frontend debe llamarlo si:
  - El usuario cancela la creación de la póliza
  - Hay un error al guardar la póliza
  - El usuario cierra el formulario sin guardar

## Manejo de errores

Si hay error al procesar el PDF:
- El PDF guardado se elimina automáticamente
- Se retorna mensaje de error específico

## Frontend (JavaScript recomendado)

```javascript
let tempPdfPath = null;

// Al subir PDF
async function uploadPDF(file) {
  const formData = new FormData();
  formData.append('pdf_file', file);
  
  const response = await fetch('/polizas/upload_pdf', {
    method: 'POST',
    body: formData
  });
  
  const data = await response.json();
  
  if (!data.error) {
    tempPdfPath = data.pdf_path;
    // Llenar formulario con data.data
  }
}

// Al guardar póliza
async function savePoliza(formData) {
  if (tempPdfPath) {
    formData.append('pdf_path', tempPdfPath);
  }
  
  const response = await fetch('/polizas/create', {
    method: 'POST',
    body: formData
  });
  
  const data = await response.json();
  
  if (!data.error) {
    tempPdfPath = null; // PDF vinculado exitosamente
  }
}

// Al cancelar o cerrar formulario
async function cancelForm() {
  if (tempPdfPath) {
    await fetch('/polizas/delete_temp_pdf', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({pdf_path: tempPdfPath})
    });
    tempPdfPath = null;
  }
}

// Listener para cerrar ventana/pestaña
window.addEventListener('beforeunload', (e) => {
  if (tempPdfPath) {
    // Intentar eliminar PDF temporal
    navigator.sendBeacon('/polizas/delete_temp_pdf', 
      JSON.stringify({pdf_path: tempPdfPath}));
  }
});
```

## Ventajas de este enfoque

1. **Validación temprana**: El PDF se valida antes de guardar la póliza
2. **Datos pre-llenados**: El usuario puede revisar/editar antes de guardar
3. **Sin PDFs huérfanos**: Los PDFs no vinculados se pueden eliminar
4. **Rollback automático**: Si hay error, el PDF se elimina
5. **Experiencia de usuario**: El usuario ve los datos extraídos antes de confirmar
