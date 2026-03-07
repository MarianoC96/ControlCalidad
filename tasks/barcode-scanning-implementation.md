# Plan de Implementación: Módulo de Escaneo de Códigos de Barras (v2)

## 1. Arquitectura del Módulo
El sistema se dividirá en dos grandes rutas tras el acceso desde el Gateway:
- `/dashboard`: Pantalla de selección principal.
- `/escaneo`: Módulo especializado con su propia navegación (Sidebar).

## 2. Requerimientos Funcionales Detallados

### A. Navegación Especializada (Sidebar Escaneo)
Dentro de `/escaneo`, se implementará un panel lateral izquierdo con:
1. **Escáner:** Interfaz principal de captura y visualización.
2. **Agregar Producto:** Formulario para registrar nuevos SKUs.
3. **Agregar Caja:** Formulario para registrar configuraciones de empaque.

### B. Lógica de Escaneo Dual
El sistema debe diferenciar automáticamente (o mediante toggle manual) entre dos tipos de escaneo:

#### 1. Escaneo de Producto
- **Match:** Contra tabla `productos_barcode`.
- **Datos (Read-only):** Vida Útil, Registro Sanitario, Presentación, Unidades por Caja.
- **Campo Crítico:** "Lote Interno" (Bloqueado por defecto).
- **Acción:** Botón "Agregar Lote Interno" desbloquea el campo para edición manual.

#### 2. Escaneo de Caja
- **Match:** Contra tabla `cajas_barcode`.
- **Datos (Read-only):** Presentación, Unidades por Caja.
- **Campo Crítico:** "Lote Interno" (Misma lógica de desbloqueo mediante botón).

## 3. Diseño de Base de Datos (Supabase)

Se deben ejecutar los siguientes cambios en la base de datos para soportar los nuevos requisitos:

```sql
-- Tabla de Productos para Escaneo
CREATE TABLE public.productos_barcode (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  barcode text UNIQUE NOT NULL,
  vida_util text,
  registro_sanitario text,
  presentacion text,
  unidades_por_caja integer,
  created_at timestamp with time zone DEFAULT now()
);

-- Tabla de Cajas para Escaneo
CREATE TABLE public.cajas_barcode (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  barcode text UNIQUE NOT NULL,
  presentacion text,
  unidades_por_caja integer,
  created_at timestamp with time zone DEFAULT now()
);

-- Historial de Escaneos (Audit Trail)
CREATE TABLE public.escaneos_barcode (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  item_barcode text NOT NULL,
  tipo_item text CHECK (tipo_item IN ('producto', 'caja')),
  lote_interno text NOT NULL,
  usuario_id integer REFERENCES public.usuarios(id),
  scanned_at timestamp with time zone DEFAULT now()
);

-- Índices para búsqueda rápida
CREATE INDEX idx_productos_barcode ON public.productos_barcode(barcode);
CREATE INDEX idx_cajas_barcode ON public.cajas_barcode(barcode);
```

## 4. UI/UX y Estados de Interfaz

### Reglas de Diseño (Chesterton's Fence)
- **Campos "Read-Only":** Fondo gris suave o translúcido, icono de candado 🔒 al final del input.
- **Campo "Lote Interno":** El único campo mutable. Debe tener un indicador visual claro (borde prominente o color distinto) solo cuando está activo.
- **Diferenciación de Escaneo:** Usar colores de "mira" distintos (ej. Verde para producto, Azul para caja) para retroalimentación inmediata.

### Protocolo de Resiliencia Visual
1. **Loading:** Shimmer effect en los campos informativos mientras se consulta Supabase.
2. **Empty:** Estado "Esperando escaneo..." con ilustración amigable.
3. **Error:** "Código no reconocido", con botón para agregarlo manualmente si el usuario tiene permisos.

## 5. Plan de Ejecución Fases

### Fase 1: Base de Datos y API
- Crear tablas en Supabase.
- Crear endpoints en `src/app/api/escaneo/` para consulta y registro.

### Fase 2: Sidebar y Layout
- Implementar `ScannerLayout.tsx` dentro de `/escaneo`.
- Crear el Sidebar persistente para este módulo.

### Fase 3: Lógica de Hardware (Escáner)
- Implementar el adaptador real usando `html5-qrcode`.
- Lógica de distinción Producto vs Caja.

### Fase 4: Formularios de Gestión
- Implementar páginas "Agregar Producto" y "Agregar Caja" con validaciones Zod.

---
> [!IMPORTANT]
> **Separación Radical:** El código del módulo de escaneo no debe interferir con la lógica de `src/app/registros-productos` (Control de Calidad actual).

> [!TIP]
> **Tokenización:** Usar `var(--primary-500)` para Calidad y una nueva variable `--scanner-accent` (ej. Indigo) para el nuevo módulo.

## 6. Consultas Técnicas y Definiciones (Pre-Implementación)

Antes de proceder con la edición final del código y la integración de Supabase, se ha establecido este espacio para resolver dudas de arquitectura y negocio:

### Bloque 1: Comportamiento del Escáner
- **Pregunta:** ¿Deseas que el escaneo de producto y caja sea 100% automático al detectar el código, o prefieres que el usuario deba presionar un botón de "Escanear"?
- **Respuesta:** El usuario prefere un botón explícito de **"Escanear código de barras"** para iniciar la cámara. No debe iniciarse automáticamente al cargar la página.

### Bloque 2: Persistencia de Datos
- **Pregunta:** ¿La tabla de `escaneos_barcode` (historial) debe guardar una copia de los datos del producto en ese momento (snapshot) o solo una referencia al ID del producto? (Importante para trazabilidad si los datos del producto cambian en el futuro).
- **Respuesta:** [Pendiente]

### Bloque 3: Flujo de Gestión
- **Pregunta:** En el Sidebar, las opciones "Agregar Producto" y "Agregar Caja" ¿deben estar disponibles para todos los usuarios o solo para aquellos con rol `administrador`?
- **Respuesta:** [Pendiente]


