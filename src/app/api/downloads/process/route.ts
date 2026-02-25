import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import JSZip from 'jszip';
import { generateServerPDF } from '@/lib/server-pdf-generator';

// Process PDFs in batches for parallelism without overwhelming the server
const BATCH_SIZE = 5;

async function processBatch(registros: any[], zip: JSZip): Promise<number> {
    let successCount = 0;

    for (let i = 0; i < registros.length; i += BATCH_SIZE) {
        const batch = registros.slice(i, i + BATCH_SIZE);

        const results = await Promise.allSettled(
            batch.map(async (registro) => {
                const pdfBuffer = await generateServerPDF(registro);

                const dateStr = new Date(registro.fecha_registro).toISOString().split('T')[0];
                const sanitize = (str: string) => (str || 'Unknown').replace(/[^a-z0-9]/gi, '_');
                const product = sanitize(registro.producto_nombre);
                const verifiedBy = sanitize(registro.verificado_por || registro.usuario_nombre);

                return { pdfBuffer, dateStr, product, verifiedBy };
            })
        );

        for (const result of results) {
            if (result.status === 'fulfilled') {
                const { pdfBuffer, dateStr, product, verifiedBy } = result.value;

                let fileName = `${dateStr}__${product}__${verifiedBy}.pdf`;
                let counter = 1;
                while (zip.file(fileName)) {
                    fileName = `${dateStr}__${product}__${verifiedBy}_(${counter}).pdf`;
                    counter++;
                }

                const recordDate = new Date();
                const peruDateStr = recordDate.toLocaleString('en-US', { timeZone: 'America/Lima' });
                const peruDate = new Date(peruDateStr);

                zip.file(fileName, pdfBuffer, { date: peruDate });
                successCount++;
            } else {
                console.error('Error processing PDF in batch:', result.reason);
            }
        }
    }

    return successCount;
}

export async function POST(req: NextRequest) {
    let downloadId: number | null = null;
    let userId: string | undefined;

    try {
        const cookieStore = await cookies();
        userId = cookieStore.get('user_id')?.value;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!
        );

        const body = await req.json();
        downloadId = body.downloadId;

        if (!downloadId) {
            return NextResponse.json({ error: 'Download ID required' }, { status: 400 });
        }

        // 1. Fetch Request
        const { data: downloadRecord, error: fetchError } = await supabase
            .from('download_history')
            .select('id, user_id, start_date, end_date, status')
            .eq('id', downloadId)
            .single();

        if (fetchError || !downloadRecord) {
            return NextResponse.json({ error: 'Download not found' }, { status: 404 });
        }

        if (downloadRecord.user_id !== parseInt(userId)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        // Start processing
        await supabase.from('download_history').update({ status: 'processing', error_message: null }).eq('id', downloadId);

        // 2. Fetch Data - only select needed columns
        const startDate = new Date(downloadRecord.start_date);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(downloadRecord.end_date);
        endDate.setHours(23, 59, 59, 999);

        // First get registros count to handle pagination for large datasets
        const { count: totalCount } = await supabase
            .from('registros')
            .select('id', { count: 'exact', head: true })
            .gte('fecha_registro', startDate.toISOString())
            .lte('fecha_registro', endDate.toISOString());

        if (!totalCount || totalCount === 0) {
            await supabase.from('download_history').update({
                status: 'ready',
                total_files: 0,
                error_message: 'No hay registros en el rango seleccionado'
            }).eq('id', downloadId);
            return NextResponse.json({ success: true, message: 'No records found' });
        }

        // Fetch all registros with controles and fotos - paginate if over 1000
        let allRegistros: any[] = [];
        const PAGE_SIZE = 500;

        for (let offset = 0; offset < totalCount; offset += PAGE_SIZE) {
            const { data: batch, error: batchError } = await supabase
                .from('registros')
                .select(`
                    id, lote_interno, lote_producto, guia, marca, cantidad,
                    producto_id, producto_nombre, usuario_id, usuario_nombre,
                    observaciones_generales, verificado_por, fecha_registro,
                    pdf_titulo, pdf_codigo, pdf_edicion, pdf_aprobado_por,
                    controles (id, parametro_nombre, rango_completo, valor_control, texto_control, parametro_tipo, observacion, fuera_de_rango),
                    fotos (id, datos_base64, descripcion)
                `)
                .gte('fecha_registro', startDate.toISOString())
                .lte('fecha_registro', endDate.toISOString())
                .order('fecha_registro', { ascending: true })
                .range(offset, offset + PAGE_SIZE - 1);

            if (batchError) throw new Error(batchError.message);
            if (batch) allRegistros = allRegistros.concat(batch);
        }

        // 3. Generate PDFs in parallel batches
        const zip = new JSZip();
        const successCount = await processBatch(allRegistros, zip);

        // 4. Generate ZIP with compression
        const zipContent = await zip.generateAsync({
            type: 'nodebuffer',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });

        // 5. Upload to Storage
        const zipName = `Descarga_${downloadRecord.start_date}_a_${downloadRecord.end_date}.zip`;
        const filePath = `${userId}/${Date.now()}_${zipName}`;

        const { error: uploadError } = await supabase
            .storage
            .from('downloads')
            .upload(filePath, zipContent, {
                contentType: 'application/zip',
                upsert: true
            });

        if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

        // 6. Update History
        await supabase.from('download_history').update({
            status: 'ready',
            total_files: successCount,
            zip_name: zipName,
            zip_path: filePath,
        }).eq('id', downloadId);

        return NextResponse.json({ success: true, count: successCount });

    } catch (err: any) {
        console.error("Processing error:", err);

        if (downloadId) {
            const supabase = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!
            );
            await supabase.from('download_history').update({
                status: 'error',
                error_message: err.message
            }).eq('id', downloadId);
        }

        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
