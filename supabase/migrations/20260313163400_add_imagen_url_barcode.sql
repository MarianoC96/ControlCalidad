-- =====================================================
-- Add imagen_url column to barcode master tables
-- Allows storing product/box images as URL or base64
-- =====================================================

ALTER TABLE productos_barcode
ADD COLUMN IF NOT EXISTS imagen_url TEXT;

ALTER TABLE cajas_barcode
ADD COLUMN IF NOT EXISTS imagen_url TEXT;

COMMENT ON COLUMN productos_barcode.imagen_url IS 'URL or base64 encoded image of the product';
COMMENT ON COLUMN cajas_barcode.imagen_url IS 'URL or base64 encoded image of the box/packaging';

-- =====================================================
-- Ensure JSONB snapshot columns exist on historial tables
-- These columns store an IMMUTABLE snapshot of the product/box
-- data at the time of scanning (including imagen_url).
-- This way, if the master record is modified or deleted,
-- old history records retain their original scanned data.
-- =====================================================

ALTER TABLE historial_escaneos_productos
ADD COLUMN IF NOT EXISTS metadata_producto JSONB;

ALTER TABLE historial_escaneos_cajas
ADD COLUMN IF NOT EXISTS metadata_caja JSONB;

COMMENT ON COLUMN historial_escaneos_productos.metadata_producto IS 'Immutable snapshot of product data at scan time (presentacion, unidades, vida_util, registro_sanitario, imagen_url)';
COMMENT ON COLUMN historial_escaneos_cajas.metadata_caja IS 'Immutable snapshot of box data at scan time (tipo_caja, capacidad_max, imagen_url)';

