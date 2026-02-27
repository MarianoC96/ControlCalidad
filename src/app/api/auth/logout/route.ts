import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/auth/logout
 *
 * Chesterton's Fence: previously cleared 4 manual cookies (session_id, user_id,
 * user_name, user_role). Now delegates to Supabase Auth which clears the
 * session JWT cookies automatically via @supabase/ssr.
 */
export async function POST() {
    try {
        const supabase = await createClient();
        await supabase.auth.signOut();

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Logout error:', error);
        return NextResponse.json(
            { error: 'Error al cerrar sesión' },
            { status: 500 }
        );
    }
}
