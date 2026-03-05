# Manual de Usuario: Sistema "Control de Calidad" (v2.0)

Este documento explica de forma sencilla cómo funciona tu nueva plataforma de calidad. Está diseñado para que cualquier persona pueda entender qué puede hacer en el sistema sin necesidad de saber programación.

---

## 1. Acceso y Seguridad (¿Quién entra y qué puede hacer?)

El sistema no es igual para todos; cada persona tiene un rol asignado que determina a qué partes de la página puede entrar.

*   **Tu Cuenta Personal:** Entras con un nombre de usuario y contraseña únicos. Si olvidas tu clave, un administrador puede resetearla.
*   **Roles de Trabajo:** Los jefes pueden crear "Roles" (ej. Supervisor, Inspector, Auditor) y marcar qué botones o secciones puede ver cada uno.
*   **Bloqueo de Seguridad:** Si alguien deja de trabajar en la empresa, su cuenta se bloquea para que no pueda entrar más, pero sus registros de calidad antiguos se guardan para siempre con su nombre.
*   **Super Administrador (@sadmin):** Es el usuario principal que tiene acceso a todo y es el único que puede configurar la seguridad.

---

## 2. Configuración de Productos (La "Receta" de Calidad)

Antes de medir en planta, debemos decirle al sistema qué vamos a inspeccionar.

*   **Ficha del Producto:** Cada producto (ej: Jarabe, Tableta, Sobre) tiene su nombre oficial.
*   **Reglas de Medición:** Para cada producto, definimos qué vamos a medir. Hay 3 formas de medir:
    1.  **Por Texto:** Solo marcamos si cumple o no (ej: "Logo visible").
    2.  **Por Número Fijo:** Un valor exacto que debe alcanzar (ej: "Peso 500g").
    3.  **Por Rango (Mín/Máx):** Lo más común. Definimos un límite bajo y uno alto (ej: "Humedad entre 5% y 10%"). Si el trabajador pone un número fuera de estos límites, el sistema avisará en rojo.
*   **Nombres Estándar:** Usamos un "Catálogo Maestro" para que todos escriban "Peso" de la misma forma y no existan confusiones como "Pessoo" o "Peso Neto".

---

## 3. Trabajo en Planta (Registro de Inspecciones)

Es la parte donde los trabajadores anotan los resultados del día a día.

*   **Búsqueda Rápida:** Solo escribes las primeras letras del producto y el sistema lo encuentra.
*   **Ayuda en Vivo:** Mientras el trabajador escribe los resultados, el sistema le dice al instante si el lote está aprobado o tiene errores.
*   **Fotos de Evidencia:** Se pueden tomar hasta 2 fotos por cada inspección para demostrar que el lote está bien.
*   **Firma Digital:** El sistema guarda automáticamente quién hizo el registro, el día y la hora exacta.

---

## 4. Archivo de Datos (Historial)

Aquí es donde se guarda todo para consultarlo después.

*   **Buscador Inteligente:** Puedes buscar por nombre de producto, por número de lote, por inspector o por fecha (como "15/05/2024").
*   **Ahorro de Tiempo:** El historial es muy rápido y te permite ver años de información en segundos.
*   **Alertas de Edición:** Si un registro fue cambiado después de guardarse, aparecerá un ícono especial que te avisa que hubo una modificación.

---

## 5. Corrección de Errores (Solicitudes de Edición)

Para que nadie cambie los datos a escondidas, el sistema tiene un proceso de seguridad:

1.  **El Pedido:** Si un inspector se equivocó, pide permiso al sistema explicando por qué.
2.  **La Aprobación:** Un jefe revisa el pedido y decide si le da permiso para editar.
3.  **El Cambio:** Si le dan el permiso, puede corregir el error **una sola vez**.
4.  **El Historial de Auditoría:** ¡Nada se borra realmente! Dentro del editor, existe una sección de **"Detalles de Edición"** que funciona como una máquina del tiempo:
    *   **Diferencia de Colores:** Verás en **rojo (tachado)** lo que se borró y en **verde** el nuevo dato ingresado.
    *   **Fotos del Pasado:** El sistema incluso te muestra qué fotos se agregaron nuevas y cuáles fueron eliminadas en cada edición.
    *   **Responsable:** Te dice exactamente qué usuario hizo el cambio y a qué hora.
5.  **Acceso Rápido:** Los jefes pueden editar directamente usando su contraseña sin pedir permiso, pero el sistema igual guarda todo el rastro detallado arriba.

---

## 6. Reportes y Descargas (Para Jefes y Auditores)

Cuando necesites entregar informes a una autoridad o auditoría:

*   **Descarga Masiva:** Puedes elegir un mes entero y pedirle al sistema que te prepare todos los informes en un solo archivo ZIP.
*   **Proceso en Segundo Plano:** Como generar muchos PDFs demora un poco, el sistema lo hace solito mientras tú sigues trabajando en otras cosas. Cuando termina, te avisa que ya puedes descargarlo.
*   **Encabezados Oficiales:** Los jefes pueden cambiar el Título, el Código y la Edición del reporte PDF desde una pantalla especial.
*   **Memoria Documental:** Si hoy cambias el título del reporte, los reportes que bajaste el año pasado NO cambian. Se quedan como estaban en ese momento para no tener problemas en auditorías.

---

## 7. ¿Qué pasa si se va el Internet? (Modo Offline)

El sistema está preparado para plantas donde el Wi-Fi no llega a todos lados.

*   **Guardado en el Dispositivo:** Si se corta el Wi-Fi, los datos se guardan temporalmente en el celular o tablet.
*   **Nube de Sincronización:** Cuando el trabajador recupera el Wi-Fi, le da a un botón y todos los datos suben a la oficina central automáticamente.
