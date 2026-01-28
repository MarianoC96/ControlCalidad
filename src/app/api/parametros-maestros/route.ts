import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
    try {
        const cookieStore = await cookies();
        const userId = cookieStore.get('user_id')?.value;

        if (!userId) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!
        );

        const { data, error } = await supabase
            .from('parametros_maestros')
            .select('*')
            .order('id', { ascending: true });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data);

    } catch (error) {
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    return handleRequest(request, async (supabase, body) => {
        const { data, error } = await supabase
            .from('parametros_maestros')
            .insert(body)
            .select()
            .single();
        if (error) throw error;
        return data;
    });
}

export async function PUT(request: Request) {
    return handleRequest(request, async (supabase, body) => {
        const { id, ...updates } = body;
        const { data, error } = await supabase
            .from('parametros_maestros')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data;
    });
}

export async function DELETE(request: Request) {
    return handleRequest(request, async (supabase, body) => {
        const { id } = body; // Expect { id: X } in body or query param? Let's use body for consistency
        const { error } = await supabase
            .from('parametros_maestros')
            .delete()
            .eq('id', id);
        if (error) throw error;
        return { success: true };
    });
}

// Helper to handle auth and service client creation
async function handleRequest(request: Request, action: (supabase: any, body: any) => Promise<any>) {
    try {
        const cookieStore = await cookies();
        const userId = cookieStore.get('user_id')?.value;
        if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

        const body = await request.json().catch(() => ({}));

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!
        );

        const result = await action(supabase, body);
        return NextResponse.json(result);
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
    }
}
