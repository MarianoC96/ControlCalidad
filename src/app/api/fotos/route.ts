import { NextRequest, NextResponse } from 'next/server';
import { createApiClient } from '@/lib/supabase/api-client';

/**
 * POST /api/fotos
 * Upload a photo for a registro
 * Stores base64 image data in the database (matching original PHP behavior)
 */
export async function POST(request: NextRequest) {
    const supabase = await createApiClient();

    // Get session from cookie
    const sessionId = request.cookies.get('session_id')?.value;
    if (!sessionId) {
        return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // Verify session
    const { data: session } = await supabase
        .from('sesiones')
        .select('usuario_id')
        .eq('id', sessionId)
        .gt('expires_at', new Date().toISOString())
        .single();

    if (!session) {
        return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }

    const body = await request.json();
    const { registro_id, datos_base64, descripcion } = body;

    if (!registro_id || !datos_base64) {
        return NextResponse.json(
            { error: 'registro_id y datos_base64 son requeridos' },
            { status: 400 }
        );
    }

    // Validate base64 format
    if (!datos_base64.startsWith('data:image/')) {
        return NextResponse.json(
            { error: 'Formato de imagen inválido' },
            { status: 400 }
        );
    }

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
}

/**
 * GET /api/fotos?registro_id=123
 * Get all photos for a registro
 */
export async function GET(request: NextRequest) {
    const supabase = await createApiClient();
    const { searchParams } = new URL(request.url);
    const registroId = searchParams.get('registro_id');

    if (!registroId) {
        return NextResponse.json(
            { error: 'registro_id es requerido' },
            { status: 400 }
        );
    }

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
    const supabase = await createApiClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    // Get session from cookie
    const sessionId = request.cookies.get('session_id')?.value;
    if (!sessionId) {
        return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // Verify session - only admins can delete
    const { data: session } = await supabase
        .from('sesiones')
        .select('usuario_id')
        .eq('id', sessionId)
        .gt('expires_at', new Date().toISOString())
        .single();

    if (!session) {
        return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }

    const { data: user } = await supabase
        .from('usuarios')
        .select('roles')
        .eq('id', session.usuario_id)
        .single();

    if (!user || user.roles !== 'administrador') {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    if (!id) {
        return NextResponse.json({ error: 'id es requerido' }, { status: 400 });
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
}
