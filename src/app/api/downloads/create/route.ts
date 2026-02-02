import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
    try {
        const cookieStore = await cookies();
        const userId = cookieStore.get('user_id')?.value;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Use Service Role to bypass RLS since we handle auth via cookie ID
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!
        );

        const { startDate, endDate } = await req.json();

        if (!startDate || !endDate) {
            return NextResponse.json({ error: 'Fechas requeridas' }, { status: 400 });
        }

        // Create initial record
        const { data, error } = await supabase
            .from('download_history')
            .insert({
                user_id: parseInt(userId),
                start_date: startDate,
                end_date: endDate,
                status: 'pending',
                total_files: 0
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating download record:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (e: any) {
        console.error("Create download error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
