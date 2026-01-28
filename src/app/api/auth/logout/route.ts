import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
    try {
        const cookieStore = await cookies();

        // Clear all session cookies
        cookieStore.delete('session_id');
        cookieStore.delete('user_id');
        cookieStore.delete('user_name');
        cookieStore.delete('user_role');

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Logout error:', error);
        return NextResponse.json(
            { error: 'Error al cerrar sesión' },
            { status: 500 }
        );
    }
}
