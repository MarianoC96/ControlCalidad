-- =====================================================
-- Escaneo Permissions - Supabase Database Migration
-- =====================================================

-- Add boolean columns to control access to scanning modules
ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS permiso_escaneo BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS permiso_escaneo_productos BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS permiso_escaneo_cajas BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS permiso_escaneo_historial BOOLEAN DEFAULT false;

-- Add comment to explain behavior
COMMENT ON COLUMN usuarios.permiso_escaneo IS 'Acceso principal al módulo de escaneo';
COMMENT ON COLUMN usuarios.permiso_escaneo_productos IS 'Permite agregar/editar/eliminar productos de escaneo';
COMMENT ON COLUMN usuarios.permiso_escaneo_cajas IS 'Permite agregar/editar/eliminar cajas de escaneo';
COMMENT ON COLUMN usuarios.permiso_escaneo_historial IS 'Permite visualizar el historial de escaneos';
