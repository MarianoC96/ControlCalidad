import { NextResponse } from 'next/server';
import { getAuthUserId, createServiceClient } from '@/lib/api/withAuth';
import { getPdfConfig } from '@/lib/config-helper';

// Helper Service Role Client
const createAdminClient = () => createServiceClient();

// Sin caché en variables de módulo: en serverless cada instancia tiene su
// propia copia y la invalidación del POST no cruza instancias (fechas viejas
// hasta expirar el TTL). El RPC es barato; se llama siempre.
async function getAvailableDates(supabase: ReturnType<typeof createAdminClient>) {
    const { data, error } = await supabase.rpc('get_available_dates');

    if (error || !data) {
        console.error('Error fetching available dates via RPC:', error);
        return { years: [], monthsByYear: {} as Record<string, number[]> };
    }

    return {
        years: (data.years || []) as number[],
        monthsByYear: (data.months_by_year || {}) as Record<string, number[]>,
    };
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
        // Clamp defensivo: evita NaN y topes excesivos (DoS / count exact sobre
        // toda la tabla). page >= 1; 1 <= limit <= 100.
        const page = Math.max(parseInt(searchParams.get('page') || '1', 10) || 1, 1);
        const limit = Math.min(
            Math.max(parseInt(searchParams.get('limit') || '25', 10) || 25, 1),
            100
        );
        const year = searchParams.get('year');
        const month = searchParams.get('month');
        const search = searchParams.get('search');

        const offset = (page - 1) * limit;

        // Only select the columns we need for the list view (no heavy data)
        const selectColumns = 'id,lote_interno,lote_producto,guia,marca,cantidad,producto_id,producto_nombre,usuario_id,usuario_nombre,observaciones_generales,verificado_por,fecha_registro,pdf_titulo,pdf_codigo,pdf_edicion,pdf_aprobado_por,es_offline,fecha_sincronizacion,edit_started_at,edit_expires_at,edit_started_by';

        let query = supabase
            .from('registros')
            .select(selectColumns, { count: 'exact' });

        if (year && year !== 'all') {
            // Use Peru timezone offset (GMT-5) so filter boundaries align with local calendar
            query = query.gte('fecha_registro', `${year}-01-01T00:00:00-05:00`)
                .lt('fecha_registro', `${parseInt(year) + 1}-01-01T00:00:00-05:00`);
        }

        if (month && year && year !== 'all' && month !== 'all') {
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

            // Condición por ID. El valor es SIEMPRE numérico (derivado de regex),
            // por lo que no admite metacaracteres de PostgREST. Sin coma final:
            // las condiciones se unen más abajo con un join controlado.
            let idSearchCondition = '';
            if (isNumeric) {
                idSearchCondition = `id.eq.${parseInt(search, 10)}`;
            } else if (matchFormatId) {
                const num = parseInt(matchFormatId[1], 10);
                idSearchCondition = `id.eq.${num}`;
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

            // Rango de fechas. Los valores son ISO strings derivados de Date, no
            // input crudo. Sin coma final (se une con join más abajo).
            if (startDate && endDate && !isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
                dateSearchCondition = `and(fecha_registro.gte.${startDate.toISOString()},fecha_registro.lte.${endDate.toISOString()})`;
            }

            // SANEO ANTIINYECCIÓN: el término libre se interpola en filtros ilike,
            // así que eliminamos los metacaracteres que podrían alterar la
            // estructura del .or de PostgREST (coma, paréntesis) y los comodines
            // LIKE (%, *, \). Se conservan letras, números, espacios y los
            // separadores usados en lotes/guías (- / .).
            const safeSearch = search.replace(/[,()%*\\]/g, ' ').trim();

            const ilikeFields = [
                'lote_interno',
                'producto_nombre',
                'guia',
                'verificado_por',
                'usuario_nombre',
            ];
            const ilikeCondition = safeSearch
                ? ilikeFields.map((field) => `${field}.ilike.%${safeSearch}%`).join(',')
                : '';

            // Une solo las condiciones no vacías (evita comas colgantes que
            // PostgREST interpretaría como filtros vacíos).
            const orFilter = [idSearchCondition, dateSearchCondition, ilikeCondition]
                .filter(Boolean)
                .join(',');

            if (orFilter) {
                query = query.or(orFilter);
            }
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

        // Alta atómica de registro + controles vía RPC transaccional (evita
        // registros huérfanos si falla la inserción de controles).
        // ⚠️ REQUIERE migración 20260624000003_rpc_registro_con_controles.sql
        //    aplicada en la BD; sin ella, esta ruta responderá error.
        const registroPayload = {
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
            fecha_sincronizacion: es_offline ? new Date().toISOString() : null,
        };

        const controlesPayload = (controles || []).map((c: any) => ({
            parametro_nombre: c.parametroNombre,
            rango_completo: c.rangoCompleto,
            valor_control: c.valorControl,
            texto_control: c.textoControl,
            parametro_tipo: c.parametroTipo,
            observacion: c.observacion,
            fuera_de_rango: c.fueraDeRango,
        }));

        const { data: nuevoRegistroId, error: rpcError } = await supabase.rpc(
            'crear_registro_con_controles',
            { p_registro: registroPayload, p_controles: controlesPayload }
        );

        if (rpcError) throw rpcError;

        return NextResponse.json({ success: true, registro_id: nuevoRegistroId });

    } catch (error: any) {
        console.error('Error creating registro:', error);
        return NextResponse.json({ error: error.message || 'Error al guardar registro' }, { status: 500 });
    }
}
