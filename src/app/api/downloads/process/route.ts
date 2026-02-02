import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import JSZip from 'jszip';
import { generateServerPDF } from '@/lib/server-pdf-generator';

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
            .select('*')
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

        // 2. Fetch Data
        const startDate = new Date(downloadRecord.start_date);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(downloadRecord.end_date);
        endDate.setHours(23, 59, 59, 999);

        const { data: registrosRaw, error: regError } = await supabase
            .from('registros')
            .select(`
                *,
                controles (*),
                fotos (*)
            `)
            .gte('fecha_registro', startDate.toISOString())
            .lte('fecha_registro', endDate.toISOString());

        if (regError) throw new Error(regError.message);

        const registros = registrosRaw as any[] || [];

        if (registros.length === 0) {
            await supabase.from('download_history').update({
                status: 'ready',
                total_files: 0,
                error_message: 'No hay registros en el rango seleccionado'
            }).eq('id', downloadId);
            return NextResponse.json({ success: true, message: 'No records found' });
        }

        // 3. Generate Content
        const zip = new JSZip();

        for (const registro of registros) {
            try {
                // Generate PDF
                const pdfBuffer = await generateServerPDF(registro);

                const dateStr = new Date(registro.fecha_registro).toISOString().split('T')[0];
                const sanitize = (str: string) => (str || 'Unknown').replace(/[^a-z0-9]/gi, '_');
                const product = sanitize(registro.producto_nombre);
                let verifiedBy = sanitize(registro.verificado_por || registro.usuario_nombre);

                let fileName = `${dateStr}__${product}__${verifiedBy}.pdf`;

                // Collision handling
                let counter = 1;
                while (zip.file(fileName)) {
                    fileName = `${dateStr}__${product}__${verifiedBy}_(${counter}).pdf`;
                    counter++;
                }

                zip.file(fileName, pdfBuffer);
            } catch (innerErr) {
                console.error(`Error processing PDF for registro ${registro.id}`, innerErr);
            }
        }

        // 4. Generate ZIP
        const zipContent = await zip.generateAsync({ type: 'nodebuffer' });

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
            total_files: registros.length,
            zip_name: zipName,
            zip_path: filePath,
        }).eq('id', downloadId);

        return NextResponse.json({ success: true, count: registros.length });

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
