import { NextResponse } from 'next/server';
import { getAuthUserId, createServiceClient } from '@/lib/api/withAuth';
import { getPdfConfig } from '@/lib/config-helper';

// Helper Service Role Client
const createAdminClient = () => createServiceClient();

// Cache for available dates (refreshed every 60 seconds)
let cachedDates: { years: number[]; monthsByYear: Record<string, number[]> } | null = null;
let cachedDatesTimestamp = 0;
const CACHE_TTL = 60_000; // 60 seconds

async function getAvailableDates(supabase: ReturnType<typeof createAdminClient>) {
    const now = Date.now();
    if (cachedDates && (now - cachedDatesTimestamp) < CACHE_TTL) {
        return cachedDates;
    }

    const { data, error } = await supabase.rpc('get_available_dates');

    if (error || !data) {
        console.error('Error fetching available dates via RPC:', error);
        return cachedDates || { years: [], monthsByYear: {} };
    }

    cachedDates = {
        years: data.years || [],
        monthsByYear: data.months_by_year || {}
    };
    cachedDatesTimestamp = now;
    return cachedDates;
}

export async function GET(request: Request) {
    try {
        const auth = await getAuthUserId();
        const userId = auth?.userId;

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

        // Only select the columns we need for the list view (no heavy data)
        const selectColumns = 'id,lote_interno,lote_producto,guia,marca,cantidad,producto_id,producto_nombre,usuario_id,usuario_nombre,observaciones_generales,verificado_por,fecha_registro,pdf_titulo,pdf_codigo,pdf_edicion,pdf_aprobado_por,es_offline,fecha_sincronizacion,edit_started_at,edit_expires_at,edit_started_by';

        let query = supabase
            .from('registros')
            .select(selectColumns, { count: 'exact' });

        if (year) {
            // Use Peru timezone offset (GMT-5) so filter boundaries align with local calendar
            query = query.gte('fecha_registro', `${year}-01-01T00:00:00-05:00`)
                .lt('fecha_registro', `${parseInt(year) + 1}-01-01T00:00:00-05:00`);
        }

        if (month && year) {
            const m = parseInt(month);
            const startStr = `${year}-${String(m + 1).padStart(2, '0')}-01T00:00:00-05:00`;
            const nextMonth = m === 11 ? 0 : m + 1;
            const nextYear = m === 11 ? parseInt(year) + 1 : parseInt(year);
            const endStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-01T00:00:00-05:00`;

            query = supabase.from('registros').select(selectColumns, { count: 'exact' })
                .gte('fecha_registro', startStr)
                .lt('fecha_registro', endStr);
        }

        if (search) {
            const isNumeric = /^\d+$/.test(search);
            const matchFormatId = search.toUpperCase().match(/^[A-Z]{3}(\d+)$/);

            let idSearchCondition = '';
            if (isNumeric) {
                idSearchCondition = `id.eq.${search},`;
            } else if (matchFormatId) {
                const num = parseInt(matchFormatId[1], 10);
                idSearchCondition = `id.eq.${num},`;
            }

            let dateSearchCondition = '';
            const cleanSearch = search.trim();
            const datePatternDDMMYYYY = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/;
            const datePatternYYYYMMDD = /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/;
            const datePatternMMYYYY = /^(\d{1,2})[\/\-](\d{4})$/;
            const datePatternDDMM = /^(\d{1,2})[\/\-](\d{1,2})$/;

            let startDate: Date | null = null;
            let endDate: Date | null = null;

            if (datePatternDDMMYYYY.test(cleanSearch)) {
                const [, d, m, y] = cleanSearch.match(datePatternDDMMYYYY)!;
                startDate = new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T00:00:00.000-05:00`);
                endDate = new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T23:59:59.999-05:00`);
            } else if (datePatternYYYYMMDD.test(cleanSearch)) {
                const [, y, m, d] = cleanSearch.match(datePatternYYYYMMDD)!;
                startDate = new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T00:00:00.000-05:00`);
                endDate = new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T23:59:59.999-05:00`);
            } else if (datePatternMMYYYY.test(cleanSearch)) {
                const [, m, y] = cleanSearch.match(datePatternMMYYYY)!;
                startDate = new Date(`${y}-${m.padStart(2, '0')}-01T00:00:00.000-05:00`);
                const endDoc = new Date(parseInt(y), parseInt(m), 0);
                endDate = new Date(`${y}-${m.padStart(2, '0')}-${String(endDoc.getDate()).padStart(2, '0')}T23:59:59.999-05:00`);
            } else if (datePatternDDMM.test(cleanSearch)) {
                const [, d, m] = cleanSearch.match(datePatternDDMM)!;
                const y = new Date().getFullYear();
                startDate = new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T00:00:00.000-05:00`);
                endDate = new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T23:59:59.999-05:00`);
            }

            if (startDate && endDate && !isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
                dateSearchCondition = `and(fecha_registro.gte.${startDate.toISOString()},fecha_registro.lte.${endDate.toISOString()}),`;
            }

            query = query.or(
                `${idSearchCondition}${dateSearchCondition}lote_interno.ilike.%${search}%,producto_nombre.ilike.%${search}%,guia.ilike.%${search}%,verificado_por.ilike.%${search}%,usuario_nombre.ilike.%${search}%`
            );
        }

        // Run both queries in parallel for speed
        const [registrosResult, datesResult] = await Promise.all([
            query
                .order('fecha_registro', { ascending: false })
                .range(offset, offset + limit - 1),
            getAvailableDates(supabase)
        ]);

        const { data, error, count } = registrosResult;

        if (error) {
            console.error('Error fetching registros:', error);
            throw error;
        }

        const yearsOut = datesResult.years;
        const monthsOut = year && datesResult.monthsByYear[year]
            ? datesResult.monthsByYear[year]
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
        const auth = await getAuthUserId();
        const userId = auth?.userId;

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
                usuario_nombre: verificado_por,
                usuario_id: parseInt(userId),
                pdf_titulo: pdfConfig.titulo,
                pdf_codigo: pdfConfig.codigo,
                pdf_edicion: pdfConfig.edicion,
                pdf_aprobado_por: pdfConfig.aprobado_por,
                es_offline: es_offline ? true : false,
                fecha_registro: fecha_registro ? fecha_registro : new Date().toISOString(),
                fecha_sincronizacion: es_offline ? new Date().toISOString() : null
            })
            .select()
            .single();

        if (regError) throw regError;

        // Invalidate dates cache when new record is created
        cachedDates = null;

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
            }));

            const { error: controlError } = await supabase
                .from('controles')
                .insert(controlesToInsert);

            if (controlError) {
                console.error('Error guardando controles:', controlError);
                throw controlError;
            }
        }

        return NextResponse.json({ success: true, registro_id: registro.id });

    } catch (error: any) {
        console.error('Error creating registro:', error);
        return NextResponse.json({ error: error.message || 'Error al guardar registro' }, { status: 500 });
    }
}
