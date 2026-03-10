# Arquitectura y Funcionalidades del Sistema: Control de Calidad (v2.0)

Este documento es la fuente única de verdad para la arquitectura web, funcionalidades y módulos del sistema "Control de Calidad". Combina tanto la documentación técnica como la operativa.

---

## 1. Módulos y Navegación Principal

La aplicación está dividida en dos grandes módulos con navegaciones (Sidebars) independientes para facilitar el flujo de trabajo en la planta:

- **Gateway de Acceso (`/dashboard`)**: Pantalla de selección principal donde el usuario elige a qué módulo ingresar según su rol y ubicación en la planta (Calidad vs. Escaneo).
- **Módulo de Calidad (`/registros-productos`, `/historial`, etc.)**: Destinado al registro riguroso de parámetros técnicos y fotografías.
- **Módulo de Escaneo (`/escaneo`)**: Sistema ágil para trazabilidad y lectura de códigos de barras, operado rápidamente mediante hardware (escáner USB/Bluetooth) o cámara del dispositivo.

---

## 2. Sistema de Seguridad y Control de Acceso (RBAC)

La plataforma implementa un Control de Acceso Basado en Roles (RBAC) dinámico integrado con el motor de autenticación de Supabase.

*   **Sincronización Automática:** Los nuevos usuarios obtienen automáticamente cuentas en *Supabase Auth* (con correos `@controlcalidad.local` autogenerados).
*   **Gestión Dinámica:** Los administradores pueden añadir roles ("Supervisor", "Auditor") y mapearlos hacia áreas del sistema (Registrar, Historial, Descargas, Solicitudes, Parámetros).
*   **Protección y Auditoría:** Los usuarios eliminados entran en modo `is_deleted` (Soft-Delete) preservando la trazabilidad de sus registros pasados. El Super Administrador (`@sadmin`) cuenta con bloqueos de seguridad que impiden su borrado occidental.

---

## 3. Funcionalidades del Módulo de Calidad

Este es el módulo principal de ingreso de datos:

### A. Catálogos Maestros y de Productos
*   **Parámetros Maestros:** Centro único de definiciones de variables (ej. "Humedad", "Peso") donde se establece su tipo de medición: Texto (Cualitativo), Número (Objetivo Fijo) o Rango (Tolerancias Mín/Máx).
*   **Productos:** Cada producto tiene asociados a parámetros maestros. Esta es la "receta de calidad".

### B. Registro de Inspecciones
*   **Métrica en Tiempo Real:** Validación inmediata contra los rangos aceptables ("Fuera de Rango" se advierte visualmente).
*   **Evidencia:** Permite subir hasta 2 fotografías por muestreo (se guardan en base64 o storage tras la sincronización, optimizadas para no consumir el espacio del servidor).
*   **Firma Automática:** El sistema firma cada inspección con el nombre del operario usando su sesión activa.

### C. Sistema de Solicitudes y Corrección (Auditoría Ciega)
Para proteger la data, los registros guardados son inmutables. 
1.  **Solicitud:** Los operadores piden "Permiso de Edición", justificando el error a los administradores.
2.  **Edición Controlada:** Si el Admin lo autoriza, la edición bloquea el registro a otros (modo Lock) por un tiempo límite (1h).
3.  **Trazabilidad:** Cualquier cambio queda registrado permanentemente mostrando qué campo o foto cambió (Diferencia Rojo/Verde en `history_edits`), logrando un Audit Trail normado.

---

## 4. Funcionalidades del Módulo de Escaneo de Códigos (Barcode)

Para simplificar la logística, el módulo aísla Operaciones de Producto y Operaciones de Caja.

### A. Escaneo de Producto
*   Lectura de códigos estándar (EAN-13, EAN-8).
*   Identificación de un ítem individual (`productos_barcode`) mostrando vida útil, registro sanitario, y presentación.
*   **Lote Obligatorio:** Solamente el campo "Lote Interno" requiere ingreso manual/teclado para asociar el escaneo físico con un conjunto del sistema y guardarse en el `historial_escaneos_productos`.

### B. Escaneo de Caja Master/Pack
*   Lectura de códigos que corresponden a configuraciones de empaque (`cajas_barcode`).
*   Informa al operador la capacidad y presentación configurada.
*   Igual que el producto, se requiere un "Lote" específico antes de conformar el registro en el `historial_escaneos_cajas`.

---

## 5. Reportabilidad, Offline e Infraestructura

### A. Historial y Buscador (SWR Server-Side)
El historial carga bloques (Paginación nativa RPC) de manera ultrasónica con caché cliente-servidor, permitiendo encontrar tickets por ID visual ("ENE0042") o fecha.

### B. Descargas Masivas en Paralelo
*   Proceso de lotes *background*: Las grandes exportaciones de PDF se agrupan en lotes y se devuelven en ZIP, guardando el histórico de solicitudes para que el servidor Node/Next.js no se asfixie.
*   **Encabezados Snapshot:** Los encabezados legales del documento (Aprobado Por, Edición) quedan "congelados en el tiempo" según cuándo se inspeccionó algo. A esto se le suma el Módulo Configuración PDF para cambiar los metadatos normativos hacia el futuro.

### C. Resiliencia (Offline-First)
En condiciones de baja conectividad dentro de las plantas (zonas oscuras):
*   **PWA / IndexedDB (TemporalDB):** El sistema almacena catálogos y colas de inspección localmente.
*   Al recuperar señal, se provee de un botón visual para sincronizar manual o automáticamente vía peticiones asíncronas seguras hacia Supabase.

---

## 6. Arquitectura Cloud Nativa (Next.js + Supabase)

*   **Frontend / Backend For Frontend (BFF):** Next.js 14+ con App Router. Lógica combinada en Server y Client Components limitando las dependencias. 
*   **Estado Visual y UI:** Vanilla CSS + Diseño visual enriquecido con Skeletors (Loading), Empty States (No data) garantizando excelente experiencia. Inmutabilidad en variables y tokens de diseño sin hardcodings manuales.
*   **Base de Datos / Backend Real:** PostgreSQL servido vía Supabase, con Políticas de Seguridad Row-Level (RLS) que evitan la consulta maliciosa directa, validado todo por el token JWT emitido desde el server de autenticación integrado.
