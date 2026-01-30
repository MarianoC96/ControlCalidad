import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const userId = cookieStore.get('user_id')?.value;

        if (!userId) {
            return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
        }

        const body = await request.json();
        const { registro_id, datos_base64, descripcion } = body;

        if (!registro_id || !datos_base64) {
            return NextResponse.json(
                { error: 'registro_id y datos_base64 son requeridos' },
                { status: 400 }
            );
        }

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!,
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        );

        // Insert photo
        const { data, error } = await supabase
            .from('fotos')
            .insert({
                registro_id,
                datos_base64,
                descripcion: descripcion || null,
            })
            .select()
            .single();

        if (error) {
            console.error('Error uploading photo:', error);
            return NextResponse.json(
                { error: 'Error al guardar la foto' },
                { status: 500 }
            );
        }

        return NextResponse.json(data, { status: 201 });

    } catch (error) {
        console.error('Unexpected error uploading photo:', error);
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}

/**
 * GET /api/fotos?registro_id=123
 * Get all photos for a registro
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const registroId = searchParams.get('registro_id');

    if (!registroId) {
        return NextResponse.json(
            { error: 'registro_id es requerido' },
            { status: 400 }
        );
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
    );

    const { data, error } = await supabase
        .from('fotos')
        .select('*')
        .eq('registro_id', registroId)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error fetching photos:', error);
        return NextResponse.json(
            { error: 'Error al obtener las fotos' },
            { status: 500 }
        );
    }

    return NextResponse.json(data);
}

/**
 * DELETE /api/fotos?id=123
 * Delete a photo
 */
export async function DELETE(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const userId = cookieStore.get('user_id')?.value;

        if (!userId) {
            return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'id es requerido' }, { status: 400 });
        }

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { persistSession: false } }
        );

        // Check if user is admin
        const { data: user } = await supabase
            .from('usuarios')
            .select('roles')
            .eq('id', userId)
            .single();

        if (!user || user.roles !== 'administrador') {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        }

        const { error } = await supabase
            .from('fotos')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting photo:', error);
            return NextResponse.json(
                { error: 'Error al eliminar la foto' },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}
