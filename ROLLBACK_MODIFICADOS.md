# Guía de Reversión: Sección 'Registros Modificados'

Si deseas eliminar completamente esta nueva sección y volver al estado anterior de la aplicación, sigue estos pasos:

### 1. Eliminar nuevos archivos creados:
- Borrar el directorio: `src/app/registros-modificados/` (incluye `page.tsx` y `RegistrosModificadosClient.tsx`)
- Borrar el archivo: `src/app/api/registros/modificados/route.ts`

### 2. Deshacer cambios en archivos existentes:

#### `src/components/Navbar.tsx`
Busca y elimina este bloque dentro del array `navLinks`:
```tsx
    {
      href: '/registros-modificados',
      label: 'Registros Modificados',
      moduleKey: 'registros-modificados',
      icon: (
        <svg className="w-6 h-6" ... />
      ),
    },
```

#### `src/app/api/auth/permisos/route.ts`
Elimina la cadena `'registros-modificados',` de todas las listas `allowedModules` (hay 3 lugares: sadmin, administrador y trabajador).

### 3. Limpieza de Cache (Opcional):
- Reiniciar el servidor de desarrollo (`npm run dev`) para asegurar que las rutas se actualicen.

---
**Nota:** Estos cambios son puramente de código y no afectan la base de datos (ya que solo leen de `history_edits`), por lo que revertirlos dejará el sistema exactamente como estaba.
