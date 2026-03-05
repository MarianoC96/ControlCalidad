# Documentación Técnica y Funcional: Sistema "Control de Calidad" (v2.0)

Este documento proporciona una visión exhaustiva de todas las capacidades del sistema, detallando los procesos de seguridad, flujos de trabajo de calidad y herramientas administrativas.

---

## 1. Sistema de Seguridad y Control de Acceso (RBAC)

A diferencia de un sistema simple de "Admin/User", esta plataforma implementa un Control de Acceso Basado en Roles (RBAC) dinámico integrado con el motor de autenticación de Supabase.

### A. Gestión de Personal (Módulo Usuarios)
Este módulo permite administrar las cuentas de los inspectores y administradores que operan el sistema:
*   **Sincronización de Autenticación:** Al registrar un nuevo usuario, el sistema crea automáticamente una cuenta en *Supabase Auth*. Se genera un correo interno (`@controlcalidad.local`) basado en el nombre de usuario para simplificar el acceso.
*   **Estado de Cuenta:** Los administradores pueden habilitar o bloquear el acceso de cualquier usuario en tiempo real mediante un switch de estado ("Activo/Inactivo").
*   **Eliminación Lógica (Soft-Delete):** Para preservar la integridad de los reportes históricos (saber quién realizó una inspección hace meses), el sistema no borra físicamente al usuario de la base de datos local. En su lugar, lo marca como `is_deleted` y elimina solo su cuenta de autenticación para liberar el nombre de usuario.
*   **Protección del Super Administrador:** El usuario `@sadmin` (ID:1) posee reglas de protección integradas, impidiendo su edición o eliminación accidental para garantizar que la planta nunca pierda el acceso administrativo.

### B. Gestión Dinámica de Roles (Módulo Accesos)
El sistema permite definir la estructura jerárquica de la planta mediante roles personalizados:
*   **Creación ilimitada:** Se pueden crear roles como *Jefe de Aseguramiento*, *Operario Especialista*, etc.
*   **Reordenamiento Jerárquico:** Los administradores pueden mover los roles hacia arriba o abajo en la lista. Esto define el orden de importancia y visualización en los selectores del sistema.
*   **Roles de Sistema:** Existen roles marcados como `is_system` (como el del Super Admin) que poseen permisos totales bloqueados y no pueden ser alterados por otros administradores.

### C. Matriz de Permisos por Módulo
Cada rol posee una matriz de habilitación que controla el acceso a las siguientes secciones críticas:
*   **Registrar:** Acceso al formulario de captura de datos en planta.
*   **Historial:** Consulta de los registros de calidad realizados.
*   **Historial de Descargas:** Acceso a los ZIPs de exportación masiva.
*   **Solicitudes:** Módulo para autorizar ediciones de registros ya guardados.
*   **Productos:** Configuración de la base de datos de productos y sus parámetros.
*   **Parámetros Maestros:** Administración del catálogo central de medición.
*   **Usuarios:** Gestión del personal (solo para roles con alto privilegio).
*   **Edición de PDF:** Configuración del encabezado normativo de los reportes.
*   **Accesos a Sistema:** Control total de la matriz de permisos y creación de roles (Permiso exclusivo de nivel superior).

---

## 2. Gestión de Catálogo de Productos
Esta sección permite a los administradores definir la "receta" o estándar de calidad que cada producto debe cumplir.

### A. Estructura de un Producto
Cada producto en el sistema no es solo un nombre, sino un conjunto de **Parámetros de Control** que definen su estándar técnico:
*   **Nombre Oficial:** Identificador único del producto en reportes.
*   **Parámetros Técnicos:** Lista de ensayos o verificaciones que se le aplican.

### B. Configuración de Parámetros (Tipos de Evaluación)
El sistema permite configurar tres tipos de comportamientos para los ensayos:
1.  **Evaluación por Texto (Cualitativa):** Se define un valor esperado fijo (Ej: "Presenta logo", "Sin manchas"). Útil para inspecciones visuales.
2.  **Evaluación Numérica (Objetivo Fijo):** Se define un valor exacto a alcanzar con una unidad de medida (Ej: Peso: 500g).
3.  **Evaluación por Rango (Tolerancia):** Se definen límites de **Mínimo** y **Máximo** Aceptables (Ej: Humedad 5% - 12%). El sistema usará estos límites para marcar automáticamente si un registro está "Fuera de Rango".

### C. Catálogo de Parámetros Maestros
Para garantizar la máxima integridad de los datos, el sistema implementa una política de **Estandarización Obligatoria**:
*   **Catálogo Centralizado:** Todos los parámetros de control deben ser seleccionados exclusivamente del "Catálogo Maestro". Esto asegura que conceptos como "Humedad" o "Peso" se midan bajo el mismo estándar en toda la empresa.
*   **Buscador Inteligente (Smart Selector):** Al configurar un producto, el administrador dispone de un buscador en tiempo real conectado al catálogo maestro.
*   **Protección de Definiciones:** Una vez seleccionado un parámetro maestro, su nombre y tipo quedan bloqueados en la configuración del producto. Solo se permite definir la unidad de medida y los valores objetivo (mín/máx).
*   **Eliminación de Parámetros Ad-hoc:** Se ha deshabilitado la creación de parámetros "personalizados" o "locales" desde el modal de productos para evitar la proliferación de datos duplicados o inconsistentes.

### D. Proceso Detallado para Agregar un Producto
El registro de un nuevo producto sigue un flujo estructurado en un modal de alta gama diseñado para la precisión:

1.  **Definición de Identidad:**
    *   Se ingresa el nombre oficial del producto (ej: "Leche Entera 1L").
    *   El sistema requiere este campo como obligatorio para habilitar el guardado.

2.  **Configuración de Parámetros (Split-View):**
    *   **Navegación Lateral:** Los parámetros se gestionan en una barra lateral que permite añadir, eliminar y saltar entre ensayos rápidamente.
    *   **Buscador Inteligente (Smart Selector):** Al configurar un parámetro, se dispone de un buscador que filtra el catálogo maestro en tiempo real. 
    *   **Bloqueo Preventivo:** Si se elige un parámetro maestro, el sistema bloquea la edición del nombre y tipo para asegurar que se sigan los estándares globales de medición de la planta.

3.  **Personalización Técnica:**
    *   Para cada parámetro, el administrador define la **Unidad de Medida** (kg, %, °C, etc.) y los **Valores Objetivo**.
    *   En parámetros de tipo **Rango**, se capturan los límites inferiores y superiores que servirán de base para las alertas automáticas en planta.

4.  **Validación y Persistencia:**
    *   El sistema valida que no existan parámetros vacíos antes de permitir la creación.
    *   Al guardar, se realiza una operación atómica que vincula el producto con todos sus parámetros técnicos en la base de datos, dejándolo disponible de inmediato para todos los inspectores en sus dispositivos (incluso en modo offline tras la sincronización automática).

---

## 3. Gestión de Parámetros Maestros
Los Parámetros Maestros son el corazón técnico del sistema. Su función es centralizar las definiciones para que la data recolectada en planta sea siempre comparable y auditable.

### A. Tipos de Parámetros Maestros
Al definir un parámetro maestro, se establece su comportamiento lógico:
1.  **Texto Libre:** Para observaciones descriptivas (ej: "Estado de Limpieza", "Color").
2.  **Numérico:** Para valores puntuales con unidad de medida (ej: "Peso Neto", "Volumen").
3.  **Rango Mín/Máx (Tolerancia):** Para variables críticas que deben operar dentro de límites técnicos (ej: "pH", "Temperatura").

### B. Mantenimiento del Catálogo
Dado que el sistema ahora exige el uso de parámetros maestros desde el origen (alta de productos), la gestión se centra en:
*   **Creación Centralizada:** Nuevos ensayos deben ser dados de alta primero en este módulo antes de ser asignados a cualquier producto.
*   **Edición Global:** Si se corrige el nombre de un parámetro maestro, el cambio se refleja automáticamente en la configuración de todos los productos vinculados.
*   **Validación de Unicidad:** El sistema impide nombres duplicados para mantener un catálogo limpio y eficiente.

### C. Flujo para Agregar un Parámetro Maestro
1.  **Ingreso de Nombre:** Se define el término técnico estándar (ej: "pH", "Brix", "Peso Neto").
2.  **Asignación de Tipo:** Se elige cómo se debe comportar al ser llenado en planta.
3.  **Validación de Unicidad:** El sistema impide crear parámetros con nombres duplicados para mantener la limpieza del catálogo.

---

## 4. Flujo de Trabajo de Control de Calidad

### A. Registro e Inspección
1.  **Identificación Digital:** Selección de producto mediante búsqueda inteligente (Autocomplete).
2.  **Validación de Parámetros:** 
    *   Los parámetros se cargan según el producto (pueden ser numéricos, de texto o de rango).
    *   El sistema calcula en tiempo real si el valor ingresado cumple con la norma técnica.
    *   **Alertas Visuales:** Se generan advertencias inmediatas si los valores están "Fuera de Rango".
3.  **Evidencia Fotográfica:** Captura de hasta 2 fotos por registro (procesadas en JPEG para optimización de almacenamiento).
4.  **Conclusión General:** El inspector debe proporcionar una evaluación final del lote.

### B. Proceso de Edición Restrictiva (Solicitudes)
Para garantizar la integridad de los datos, **los registros son inmutables una vez guardados**. Si se requiere una corrección:
1.  **Petición:** El trabajador solicita permiso de edición desde el historial, indicando el **motivo**.
2.  **Auditoría de Solicitud:** La petición llega al módulo de **Solicitudes**.
3.  **Resolución:** Un administrador aprueba o rechaza la solicitud.
4.  **Edición Única:** Si se aprueba, el trabajador tiene permiso para editar el registro **una sola vez**.
5.  **Log de Cambios:** El sistema guarda un registro en `history_edits` con el detalle de quién editó, cuándo y qué archivos (fotos) se añadieron o eliminaron.

### C. Flujo de Edición Rápida (Usuarios Autorizados)
Si un usuario tiene habilitado el módulo de **"Solicitudes"** en su rol (o es `@sadmin`/`administrador`), puede omitir el proceso de petición formal:
1.  **Validación Directa:** Al intentar editar, el sistema no le pide crear una solicitud, sino que solicita su **contraseña de acceso**.
2.  **Bloqueo de Seguridad:** Si la contraseña es correcta, el sistema genera un bloqueo de edición inmediato por 1 hora.
3.  **Privilegio Administrativo:** Este flujo está diseñado para que los supervisores puedan corregir errores críticos al instante sin esperar aprobaciones externas.

---

## 5. Historial de Registros y Auditoría de Datos

El módulo de Historial es el núcleo de consulta del sistema, diseñado para manejar grandes volúmenes de datos con alta eficiencia.

### A. Gestión de Datos y Rendimiento
*   **Carga Inteligente (SWR):** Utiliza la librería SWR para manejar la caché en el cliente, permitiendo una navegación instantánea entre páginas y filtros sin tiempos de carga repetitivos.
*   **Paginación del Lado del Servidor:** Los registros se obtienen en bloques (por defecto 25), lo que garantiza que el navegador no se ralentice incluso con miles de registros en la base de datos.
*   **Filtros Dinámicos:** Los selectores de Año y Mes se autocompletan basándose únicamente en las fechas en las que existen registros reales, optimizados mediante una función RPC en la base de datos y caché en el servidor de 60 segundos.

### B. Motor de Búsqueda Inteligente
El buscador no es una simple coincidencia de texto; posee lógica para interpretar diferentes entradas:
*   **Soporte de Formatos de Fecha:** Entiende búsquedas como `15/05/2024`, `05-2024` o simplemente el día `15/05` (asumiendo el año actual).
*   **Búsqueda por ID:** Reconoce tanto el ID numérico puro como el formato visual del reporte (ej. `ENE0042`).
*   **Atributos Técnicos:** Permite localizar registros por Lote Interno, Nombre de Producto, Guía de Remisión o Nombre del Inspector.

### C. Auditoría y Trazabilidad (Audit Trail)
Cada registro cuenta con una línea de tiempo de modificaciones:
*   **Historial de Ediciones:** Si un registro fue modificado, aparece un icono de historial que permite ver una tabla comparativa de los valores antiguos vs. los nuevos.
*   **Trazabilidad de Fotos:** El historial detalla específicamente qué fotos fueron eliminadas y cuáles fueron agregadas en cada edición.
*   **Identificación de Origen:** El sistema etiqueta claramente los registros capturados de forma **Offline** ☁️ y muestra su fecha de sincronización real vs. la fecha de captura.

### D. Proceso Detallado de Edición desde Historial
Cuando un usuario autorizado (vía solicitud aprobada o contraseña directa) inicia una edición, se activa un protocolo de seguridad de tres capas:

1.  **Bloqueo de Concurrencia (Locking System):**
    *   Al entrar al modo edición, el sistema marca el registro en la base de datos con un `edit_started_at` y un `edit_expires_at` (1 hora).
    *   Si otro usuario intenta editar el mismo registro, el sistema lo bloquea informándole quién tiene el control del registro actualmente.

2.  **Interfaz de Edición Controlada:**
    *   **Campos Editables:** Solo se permite modificar metadatos críticos: Lote Interno, Lote Producto, Guía, Marca, Cantidad y Observaciones Generales. Los resultados de los controles técnicos permanecen inmutables para preservar la validez del ensayo.
    *   **Gestión de Evidencias:** Permite eliminar fotos previas y subir nuevas, manteniendo siempre el límite de 2 fotografías totales.
    *   **Temporizador en Vivo:** Una cuenta regresiva visible advierte al usuario del tiempo restante antes de que el bloqueo expire y los cambios no guardados se pierdan.

3.  **Finalización y Persistencia:**
    *   **Validación de Cambios:** El botón de guardar solo se habilita si se ha detectado al menos una modificación real.
    *   **Generación de Auditoría:** En una sola transacción, el sistema guarda los nuevos datos, procesa las fotos (subida/borrado) y genera el registro en `history_edits` con el diferencial de cambios (`field_changes`).
    *   **Liberación de Bloqueo:** Tras guardar exitosamente o cancelar, el sistema libera el registro para que otros puedan solicitar su edición si fuera necesario.

### E. Centro de Auditoría e Historial de Ediciones
El sistema mantiene un registro permanente e inmutable de cada cambio realizado sobre los datos originales para garantizar la transparencia total (Audit Trail).

1.  **Acceso a la Auditoría:**
    *   Disponible dentro del formulario de edición para usuarios autorizados.
    *   Muestra una línea de tiempo cronológica de todas las intervenciones realizadas sobre el registro desde su creación.

2.  **Visualización Comparativa (Diff View):**
    *   **Metadatos:** Al hacer clic en "Detalles", el sistema abre una vista comparativa que resalta en **rojo** el valor eliminado y en **verde** el nuevo valor ingresado.
    *   **Trazabilidad de Fotos:** No solo registra el cambio de texto, sino que permite ver las miniaturas de las evidencias fotográficas que fueron añadidas o marcadas para eliminación en esa edición específica.

3.  **Responsabilidad Vinculada:**
    *   Cada entrada del historial está ligada al nombre completo del usuario que realizó la acción, eliminando el anonimato en las correcciones de datos.

---

## 6. Historial de Descargas Masivas

Este módulo especializado permite la generación y recuperación de grandes volúmenes de reportes en un proceso asíncrono y en segundo plano.

### A. Proceso de Generación por Lotes (Backend)
Para evitar la saturación del servidor y errores de tiempo de espera, el sistema procesa las descargas de la siguiente manera:
*   **Procesamiento en Paralelo:** Los reportes se generan en lotes controlados (Batches de 5) utilizando el motor de PDF del servidor.
*   **Empaquetado Automático:** Una vez generados todos los PDFs del rango solicitado, el sistema crea un archivo comprimido .ZIP que incluye cada reporte individual.
*   **Almacenamiento en la Nube:** Los archivos ZIP resultantes se suben a un bucket de almacenamiento seguro, permitiendo su descarga posterior sin necesidad de regenerarlos.

### B. Flujo de Usuario y Estados de Descarga
El usuario puede monitorear el progreso de su solicitud mediante un sistema de estados en tiempo real:
1.  **Pendiente:** La solicitud ha sido registrada y está en cola de procesamiento.
2.  **Procesando:** El servidor está generando los PDFs y construyendo el archivo ZIP.
3.  **Listo:** El archivo ZIP está disponible para descarga inmediata.
4.  **Error:** Si ocurre algún fallo (ej: no hay registros en el rango), se muestra un mensaje informativo.

### C. Herramientas de Consulta y Auditoría
*   **Filtros de Historial:** Permite localizar solicitudes previas por Año, Mes o mediante búsqueda de texto (Usuario o ID de descarga).
*   **Smart Polling:** La interfaz se actualiza automáticamente cada 3 segundos mientras existan tareas activas.
*   **Formato de Salida:** Los archivos individuales dentro del ZIP siguen una nomenclatura estándar: `YYYY-MM-DD__Producto__Verificador.pdf`.

---

## 7. Capacidades de Reportabilidad y Normativa

El sistema está diseñado para cumplir con estándares estrictos de auditoría (ISO/DIGEMID), asegurando que cada reporte sea un documento legal y técnico válido.

### A. Configuración del Encabezado Normativo (Módulo Edición PDF)
Este módulo permite a los administradores personalizar la información oficial que aparece en la parte superior de todos los certificados de calidad:
*   **Título del Reporte:** Nombre oficial del documento (ej: "Protocolo de Análisis de Producto Terminado").
*   **Identificación Técnica:** Gestión de los campos de **Código** del documento y número de **Edición** actual.
*   **Fecha de Vigencia:** Control de la fecha a partir de la cual la normativa actual es aplicable.
*   **Vista Previa en Tiempo Real:** El módulo incluye un simulador que muestra exactamente cómo se verá el encabezado impreso antes de guardar los cambios.

### B. Snapshots Históricos de PDF (Integridad de Datos)
Para garantizar la validez legal en inspecciones futuras, el sistema implementa una política de "Snapshot":
*   **Persistencia Normativa:** Al momento de guardar un control de calidad, el sistema "fotografía" los datos del encabezado (Título, Código, Edición) vigentes en ese instante y los vincula permanentemente al registro.
*   **Inmutabilidad Documental:** Si la normativa cambia el próximo mes, los reportes antiguos seguirán mostrando la información con la que fueron creados. Esto previene que una auditoría de un lote pasado falle por mostrar un código de documento que no existía en su fecha de producción.

---

## 8. Arquitectura de Resiliencia (Offline-First)

El sistema está diseñado para plantas industriales con zonas de sombra de Wi-Fi:
*   **IndexedDB (TemporalDB):** Base de datos en el navegador que almacena el catálogo de productos y registros pendientes.
*   **Detección de Estado:** Un hook `useOnlineStatus` monitorea la conexión.
*   **Sincronización Manual:** En el módulo "Temporal", el usuario puede revisar los registros guardados "en frío" y subirlos cuando recupere la señal.

---

## 9. Estructura de Datos (Esquema simplificado)

*   `usuarios` (vía `role_id` hacia `roles`)
*   `roles` <-> `role_permisos` (Relación M:N para control de secciones)
*   `productos` <-> `parametros` (Configuración de control técnica)
*   `download_history` (Registro de solicitudes de descarga masiva)
*   `registros` <-> `controles` (Datos inspeccionados)
*   `fotos` (Evidencia en Base64 para portabilidad)
*   `edit_requests` (Control de flujo de solicitudes)
*   `history_edits` (Auditoría de cambios)
*   `configuracion_pdf` (Gestión centralizada de encabezados normativos)
