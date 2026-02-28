import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
    try {
        const { identifier } = await request.json();

        if (!identifier) {
            return NextResponse.json({ error: 'Identificador requerido' }, { status: 400 });
        }

        // Usamos la Service Role Key para saltar el RLS solo para esta búsqueda de correo
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        );

        // Buscamos el correo vinculado al usuario o al mismo correo
        const { data: userData, error } = await supabaseAdmin
            .from('usuarios')
            .select('email')
            .or(`usuario.eq.${identifier.toLowerCase()},email.eq.${identifier.toLowerCase()}`)
            .maybeSingle();

        if (error) throw error;

        return NextResponse.json({ email: userData?.email || identifier });
    } catch (error: any) {
        console.error('Error in resolve-identifier:', error);
        return NextResponse.json({ error: 'Error al procesar identidad' }, { status: 500 });
    }
}
