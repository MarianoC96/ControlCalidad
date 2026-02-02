import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    try {
        const cookieStore = await cookies();
        const userId = cookieStore.get('user_id')?.value;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!
        );

        // Check ownership
        const { data: record, error: fetchError } = await supabase
            .from('download_history')
            .select('*')
            .eq('id', params.id)
            .single();

        if (fetchError || !record) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        if (record.user_id !== parseInt(userId)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        if (!record.zip_path) {
            return NextResponse.json({ error: 'File not ready' }, { status: 404 });
        }

        // Generate Signed URL
        const { data, error } = await supabase
            .storage
            .from('downloads')
            .createSignedUrl(record.zip_path, 3600, {
                download: record.zip_name || 'download.zip'
            });

        if (error || !data) {
            return NextResponse.json({ error: 'Error generating link' }, { status: 500 });
        }

        return NextResponse.redirect(data.signedUrl);

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
