import { createClient } from '@supabase/supabase-js';

export interface PdfConfig {
    titulo: string;
    codigo: string;
    edicion: string;
    aprobado_por: string;
}

export const DEFAULT_CONFIG: PdfConfig = {
    titulo: "REPORTE DE CONTROL DE CALIDAD",
    codigo: "PE C - CC001",
    edicion: "ED. 01",
    aprobado_por: "Aprob. J. Calidad"
};

// Initialize Supabase client
const getSupabase = () => {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
    );
};

export async function getPdfConfig(): Promise<PdfConfig> {
    try {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('configuracion_pdf')
            .select('*')
            .limit(1)
            .single();

        if (error || !data) {
            console.warn("Could not fetch config from DB (or table empty), using default.", error);
            return DEFAULT_CONFIG;
        }

        return {
            titulo: data.titulo,
            codigo: data.codigo,
            edicion: data.edicion,
            aprobado_por: data.aprobado_por
        };
    } catch (error) {
        console.error("Error reading PDF config:", error);
        return DEFAULT_CONFIG;
    }
}

export async function updatePdfConfig(config: PdfConfig): Promise<void> {
    try {
        const supabase = getSupabase();

        // Check if a record exists
        const { data: existing } = await supabase
            .from('configuracion_pdf')
            .select('id')
            .limit(1)
            .maybeSingle();

        if (existing) {
            const { error } = await supabase
                .from('configuracion_pdf')
                .update({
                    titulo: config.titulo,
                    codigo: config.codigo,
                    edicion: config.edicion,
                    aprobado_por: config.aprobado_por,
                    updated_at: new Date().toISOString()
                })
                .eq('id', existing.id);

            if (error) throw error;
        } else {
            const { error } = await supabase
                .from('configuracion_pdf')
                .insert([{
                    ...config
                }]);

            if (error) throw error;
        }
    } catch (error) {
        console.error("Error writing PDF config:", error);
        throw error;
    }
}
