import { createClient } from '@/lib/supabase/client';
import { PostgrestSingleResponse } from '@supabase/supabase-js';

export interface BarcodeProduct {
    barcode: string;
    vida_util?: string;
    registro_sanitario?: string;
    presentacion: string;
    unidades_por_caja: number;
}

export interface BarcodeBox {
    barcode: string;
    tipo_caja: string;
    capacidad_max: number;
}

export interface BarcodeTransaction {
    barcode: string;
    lote: string;
    usuario_id: number | null;
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
            .single();
    },

    /**
     * Saves a scan transaction to history
     */
    async saveTransaction(transaction: BarcodeTransaction, mode: 'producto' | 'caja'): Promise<PostgrestSingleResponse<null>> {
        const supabase = createClient();
        const table = mode === 'producto' ? 'historial_escaneos_productos' : 'historial_escaneos_cajas';

        return await supabase
            .from(table)
            .insert(transaction);
    },

    /**
     * Registers a new product in the master barcode table
     */
    async registerProduct(product: BarcodeProduct): Promise<PostgrestSingleResponse<null>> {
        const supabase = createClient();

        return await supabase
            .from('productos_barcode')
            .insert(product);
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
            .delete()
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
            .order('created_at', { ascending: false });
    },

    /**
     * Registers a new box type
     */
    async registerCaja(caja: BarcodeBox): Promise<PostgrestSingleResponse<null>> {
        const supabase = createClient();

        return await supabase
            .from('cajas_barcode')
            .insert(caja);
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
            .delete()
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
            .order('created_at', { ascending: false });
    },

    /**
     * Fetches scan history for products or boxes
     */
    async getHistory(mode: 'productos' | 'cajas'): Promise<PostgrestSingleResponse<any[]>> {
        const supabase = createClient();
        const table = mode === 'productos' ? 'historial_escaneos_productos' : 'historial_escaneos_cajas';
        const masterTable = mode === 'productos' ? 'productos_barcode' : 'cajas_barcode';
        const masterField = mode === 'productos' ? 'presentacion' : 'tipo_caja';

        return await supabase
            .from(table)
            .select(`
                id,
                barcode,
                lote,
                created_at,
                usuarios(nombre_completo),
                ${masterTable}(${masterField})
            `)
            .order('created_at', { ascending: false });
    }
};
