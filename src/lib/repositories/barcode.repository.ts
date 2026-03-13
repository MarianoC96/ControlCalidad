import { createClient } from '@/lib/supabase/client';
import { PostgrestSingleResponse } from '@supabase/supabase-js';

export interface BarcodeProduct {
    barcode: string;
    vida_util?: string;
    registro_sanitario?: string;
    presentacion: string;
    unidades_por_caja: number;
    imagen_url?: string;
}

export interface BarcodeBox {
    barcode: string;
    tipo_caja: string;
    capacidad_max: number;
    imagen_url?: string;
}

export interface BarcodeTransaction {
    barcode: string;
    lote: string;
    usuario_id: number | null;
    metadata?: any;
}

/**
 * BarcodeRepository for Supabase access
 * Following SoC (Separation of Concerns) and Adapter Pattern logic.
 */
export const BarcodeRepository = {
    /**
     * Looks up a product or box by barcode
     */
    async findByBarcode(barcode: string, mode: 'producto' | 'caja'): Promise<PostgrestSingleResponse<any>> {
        const supabase = createClient();
        const table = mode === 'producto' ? 'productos_barcode' : 'cajas_barcode';

        return await supabase
            .from(table)
            .select('*')
            .eq('barcode', barcode)
            .eq('is_active', true)
            .single();
    },

    /**
     * Saves a scan transaction to history
     */
    async saveTransaction(transaction: BarcodeTransaction, mode: 'producto' | 'caja'): Promise<PostgrestSingleResponse<null>> {
        const supabase = createClient();
        const table = mode === 'producto' ? 'historial_escaneos_productos' : 'historial_escaneos_cajas';
        const metadataField = mode === 'producto' ? 'metadata_producto' : 'metadata_caja';

        const payload = {
            barcode: transaction.barcode,
            lote: transaction.lote,
            usuario_id: transaction.usuario_id,
            [metadataField]: transaction.metadata
        };

        return await supabase
            .from(table)
            .insert(payload);
    },

    /**
     * Registers a new product in the master barcode table
     */
    async registerProduct(product: BarcodeProduct): Promise<PostgrestSingleResponse<null>> {
        const supabase = createClient();

        return await supabase
            .from('productos_barcode')
            .upsert({ ...product, is_active: true });
    },

    /**
     * Updates an existing product
     */
    async updateProduct(barcode: string, product: Partial<BarcodeProduct>): Promise<PostgrestSingleResponse<null>> {
        const supabase = createClient();

        return await supabase
            .from('productos_barcode')
            .update(product)
            .eq('barcode', barcode);
    },

    /**
     * Deletes a product
     */
    async deleteProduct(barcode: string): Promise<PostgrestSingleResponse<null>> {
        const supabase = createClient();

        return await supabase
            .from('productos_barcode')
            .update({ is_active: false } as any)
            .eq('barcode', barcode);
    },

    /**
     * Gets all products from master barcode catalog
     */
    async getAllProducts(): Promise<PostgrestSingleResponse<BarcodeProduct[]>> {
        const supabase = createClient();

        return await supabase
            .from('productos_barcode')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: false });
    },

    /**
     * Registers a new box type
     */
    async registerCaja(caja: BarcodeBox): Promise<PostgrestSingleResponse<null>> {
        const supabase = createClient();

        return await supabase
            .from('cajas_barcode')
            .upsert({ ...caja, is_active: true });
    },

    /**
     * Updates a box type
     */
    async updateCaja(barcode: string, caja: Partial<BarcodeBox>): Promise<PostgrestSingleResponse<null>> {
        const supabase = createClient();

        return await supabase
            .from('cajas_barcode')
            .update(caja)
            .eq('barcode', barcode);
    },

    /**
     * Deletes a box type
     */
    async deleteCaja(barcode: string): Promise<PostgrestSingleResponse<null>> {
        const supabase = createClient();

        return await supabase
            .from('cajas_barcode')
            .update({ is_active: false } as any)
            .eq('barcode', barcode);
    },

    /**
     * Gets all box types
     */
    async getAllCajas(): Promise<PostgrestSingleResponse<BarcodeBox[]>> {
        const supabase = createClient();

        return await supabase
            .from('cajas_barcode')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: false });
    },

    /**
     * Fetches scan history for products or boxes
     */
    async getHistory(mode: 'productos' | 'cajas'): Promise<PostgrestSingleResponse<any[]>> {
        const supabase = createClient();
        const table = mode === 'productos' ? 'historial_escaneos_productos' : 'historial_escaneos_cajas';
        const masterTable = mode === 'productos' ? 'productos_barcode' : 'cajas_barcode';
        const metadataColumn = mode === 'productos' ? 'metadata_producto' : 'metadata_caja';

        return await supabase
            .from(table)
            .select(`
                id,
                barcode,
                lote,
                created_at,
                edit_started_at,
                edit_expires_at,
                edit_started_by,
                ${metadataColumn},
                usuarios!usuario_id(nombre_completo),
                ${masterTable}(*)
            `)
            .order('created_at', { ascending: false });
    }
};
