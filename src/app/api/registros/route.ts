import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { getPdfConfig } from '@/lib/config-helper';

// Helper Service Role Client
const createAdminClient = () => {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        }
    );
};

export async function GET(request: Request) {
    try {
        const cookieStore = await cookies();
        const userId = cookieStore.get('user_id')?.value;

        if (!userId) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const supabase = createAdminClient();

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '25');
        const year = searchParams.get('year');
        const month = searchParams.get('month');
        const search = searchParams.get('search');

        const offset = (page - 1) * limit;

        let query = supabase
            .from('registros')
            .select('*', { count: 'exact' });

        if (year) {
            query = query.gte('fecha_registro', `${year}-01-01T00:00:00Z`)
                .lt('fecha_registro', `${parseInt(year) + 1}-01-01T00:00:00Z`);
        }

        if (month && year) {
            // Note: If both year and month are provided, we refine the date range.
            // Month is 0-indexed in JS but let's assume month passed is 0-11 as string
            const m = parseInt(month);
            const startStr = `${year}-${String(m + 1).padStart(2, '0')}-01T00:00:00Z`;
            // Calculate next month
            const nextMonth = m === 11 ? 0 : m + 1;
            const nextYear = m === 11 ? parseInt(year) + 1 : parseInt(year);
            const endStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-01T00:00:00Z`;

            // Re-apply specific month range instead of year range
            query = supabase.from('registros').select('*', { count: 'exact' })
                .gte('fecha_registro', startStr)
                .lt('fecha_registro', endStr);
        }

        if (search) {
            query = query.or(`lote_interno.ilike.%${search}%,producto_nombre.ilike.%${search}%,guia.ilike.%${search}%`);
        }

        const { data, error, count } = await query
            .order('fecha_registro', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            console.error('Error fetching registros:', error);
            throw error;
        }

        // Lightweight query to get unique years and months
        // Since we don't have an RPC, we fetch only the `fecha_registro` column for all items.
        // Supabase limits to 1000 rows by default, so we need to bypass or paginate if huge, but let's try a simple fetch.
        // A better approach is caching this, but for now we fetch it.
        const { data: dateData } = await supabase.from('registros').select('fecha_registro').limit(100000);
        const availableYears = new Set<number>();
        const availableMonthsByYear: Record<number, Set<number>> = {};

        if (dateData) {
            dateData.forEach(d => {
                const date = new Date(d.fecha_registro);
                const y = date.getFullYear();
                const m = date.getMonth();
                availableYears.add(y);
                if (!availableMonthsByYear[y]) availableMonthsByYear[y] = new Set();
                availableMonthsByYear[y].add(m);
            });
        }

        const yearsOut = Array.from(availableYears).sort((a, b) => b - a);
        const monthsOut = year && availableMonthsByYear[parseInt(year)]
            ? Array.from(availableMonthsByYear[parseInt(year)]).sort((a, b) => a - b)
            : [];

        return NextResponse.json({
            data,
            meta: {
                total: count,
                page,
                limit,
                totalPages: count ? Math.ceil(count / limit) : 0,
                availableYears: yearsOut,
                availableMonths: monthsOut
            }
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const cookieStore = await cookies();
        const userId = cookieStore.get('user_id')?.value;

        if (!userId) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const body = await request.json();
        const {
            lote_interno,
            lote_producto,
            guia,
            marca,
            cantidad,
            producto_id,
            producto_nombre,
            observaciones_generales,
            verificado_por,
            controles,
            es_offline,
            fecha_registro
        } = body;

        const supabase = createAdminClient();

        // Obtener configuración PDF actual para snapshot
        let pdfConfig;
        try {
            pdfConfig = await getPdfConfig();
        } catch (e) {
            console.error('Error fetching PDF config for snapshot', e);
            pdfConfig = { titulo: null, codigo: null, edicion: null, aprobado_por: null };
        }

        // 1. Crear el Registro
        const { data: registro, error: regError } = await supabase
            .from('registros')
            .insert({
                lote_interno,
                lote_producto,
                guia,
                marca,
                cantidad,
                producto_id,
                producto_nombre,
                observaciones_generales,
                verificado_por,
                usuario_nombre: verificado_por, // Required by DB
                usuario_id: parseInt(userId), // Asociar con el usuario logueado
                // Snapshot PDF Config
                pdf_titulo: pdfConfig.titulo,
                pdf_codigo: pdfConfig.codigo,
                pdf_edicion: pdfConfig.edicion,
                pdf_aprobado_por: pdfConfig.aprobado_por,
                // Offline support
                es_offline: es_offline ? true : false,
                fecha_registro: fecha_registro ? fecha_registro : new Date().toISOString(),
                fecha_sincronizacion: es_offline ? new Date().toISOString() : null
            })
            .select()
            .single();

        if (regError) throw regError;

        // 2. Crear los Controles asociados
        if (controles && controles.length > 0) {
            const controlesToInsert = controles.map((c: any) => ({
                registro_id: registro.id,
                parametro_nombre: c.parametroNombre,
                rango_completo: c.rangoCompleto,
                valor_control: c.valorControl,
                texto_control: c.textoControl,
                parametro_tipo: c.parametroTipo,
                observacion: c.observacion,
                fuera_de_rango: c.fueraDeRango,
                // Nota: mensajeAlerta no se suele guardar en BD a menos que haya col.
            }));

            const { error: controlError } = await supabase
                .from('controles')
                .insert(controlesToInsert);

            if (controlError) {
                // Idealmente rollback de registro, pero por ahora lanzamos error
                console.error('Error guardando controles:', controlError);
                // No borramos el registro para no perder datos parciales, pero avisamos.
                throw controlError;
            }
        }

        return NextResponse.json({ success: true, registro_id: registro.id });

    } catch (error: any) {
        console.error('Error creating registro:', error);
        return NextResponse.json({ error: error.message || 'Error al guardar registro' }, { status: 500 });
    }
}
