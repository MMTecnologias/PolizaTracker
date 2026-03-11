#!/usr/bin/env python3
"""
Script para probar si un PDF es válido y puede ser procesado
Uso: python test_pdf.py <ruta_al_pdf>
"""
import sys
import pdfplumber

def test_pdf(pdf_path):
    print(f"Probando PDF: {pdf_path}")
    print("-" * 50)
    
    try:
        # Leer el contenido del archivo
        with open(pdf_path, 'rb') as f:
            content = f.read()
        
        file_size = len(content)
        print(f"✓ Tamaño del archivo: {file_size / 1024:.2f} KB")
        
        # Verificar que no esté vacío
        if file_size == 0:
            print("❌ ERROR: El archivo está vacío")
            return False
        
        # Verificar tamaño máximo
        if file_size > 10 * 1024 * 1024:
            print(f"⚠️  ADVERTENCIA: El archivo es muy grande ({file_size / (1024*1024):.2f} MB)")
            print("   El límite es 10MB")
        
        # Verificar header PDF
        if not content.startswith(b'%PDF'):
            print("❌ ERROR: El archivo no tiene el header de PDF válido")
            print(f"   Primeros bytes: {content[:20]}")
            return False
        
        print("✓ Header PDF válido")
        
        # Intentar abrir con pdfplumber
        import io
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            num_pages = len(pdf.pages)
            print(f"✓ Número de páginas: {num_pages}")
            
            if num_pages == 0:
                print("❌ ERROR: El PDF no contiene páginas")
                return False
            
            # Intentar extraer texto de la primera página
            first_page = pdf.pages[0]
            text = first_page.extract_text()
            
            if text:
                print(f"✓ Texto extraído de la primera página ({len(text)} caracteres)")
                print("\nPrimeros 200 caracteres:")
                print("-" * 50)
                print(text[:200])
                print("-" * 50)
            else:
                print("⚠️  ADVERTENCIA: No se pudo extraer texto de la primera página")
                print("   El PDF puede ser una imagen escaneada")
        
        print("\n✅ El PDF es válido y puede ser procesado")
        return True
        
    except FileNotFoundError:
        print(f"❌ ERROR: No se encontró el archivo: {pdf_path}")
        return False
    except Exception as e:
        print(f"❌ ERROR al procesar el PDF: {e}")
        print(f"   Tipo de error: {type(e).__name__}")
        return False

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python test_pdf.py <ruta_al_pdf>")
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    success = test_pdf(pdf_path)
    sys.exit(0 if success else 1)
