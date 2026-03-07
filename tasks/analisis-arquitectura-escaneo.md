# Análisis de Arquitectura: Trazabilidad "El Olivar" (Módulos Independientes)

Este documento detalla el flujo de trabajo final para el sistema de escaneo. El cambio principal es la **independización total** de los módulos de Producto y Caja para simplificar la operación en planta.

## 1. El Flujo de Trabajo

Se han definido dos módulos operativos distintos que no se cruzan durante la ejecución para evitar confusión y errores de datos.

### Módulo A: Escaneo de Productos
1.  **Escaneo:** El operario escanea el código de barras (EAN-13) del producto.
2.  **Identificación:** El sistema recupera la información técnica del catálogo (`productos_barcode`).
3.  **Lote (Obligatorio):** Se debe ingresar el "Lote de Producción".
4.  **Guardado:** Se genera un registro en `historial_escaneos_productos`.
    *   *Nota: No existe opción de vincular caja en este paso.*

### Módulo B: Escaneo de Cajas
1.  **Escaneo:** El operario escanea el código de barras de la caja.
2.  **Identificación:** El sistema recupera los detalles del empaque (`cajas_barcode`).
3.  **Lote (Obligatorio):** Se debe ingresar el "Lote de Empaque/Caja".
4.  **Guardado:** Se genera un registro en `historial_escaneos_cajas`.

---

## 2. Estructura de Datos (Tablas v2)

### Catálogos (Lectura)
*   `productos_barcode`: Contiene nombre, barcode, unidades y datos sanitarios.
*   `cajas_barcode`: Contiene tipo de caja, capacidad y barcode de caja.

### Historiales (Escritura)
*   `historial_escaneos_productos`: [ID, producto_id, lote_interno, timestamp].
*   `historial_escaneos_cajas`: [ID, caja_id, lote_caja, timestamp].

---

## 3. Cambios en la Interfaz de Usuario (UI)

*   **Página Principal de Escaneo:** Se presentarán dos botones de acceso directos y claros: "MÓDULO PRODUCTOS" y "MÓDULO CAJAS".
*   **Eliminación de Vinculación:** Se elimina el botón de "Escaneo Adicional (Caja)" de la vista de productos.
*   **Simetría:** Ambas vistas deben ser visualmente similares para que el operario aprenda a usar una y ya sepa usar la otra.

---

## 4. Reglas Críticas Actualizadas

1.  **Lote Obligatorio:** En ambos módulos, el campo Lote es el campo de acción principal y no puede estar vacío.
2.  **Separación de Responsabilidad:** El sistema asume que el operario está en una estación de escaneo de productos O en una de cajas, no en ambas simultáneamente.
3.  **Historial Independiente:** Las auditorías de productos y cajas se realizan por separado.

---

> **Estado:** Documentación actualizada tras entrevista con personal de planta. Listo para implementación de la separación de módulos.
