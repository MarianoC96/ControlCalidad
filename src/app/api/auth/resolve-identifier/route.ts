import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/admin-client';

/**
 * POST /api/auth/resolve-identifier  (PÚBLICO)
 *
 * Resuelve un usuario o correo al email interno con el que autenticar el flujo
 * de "olvidé mi contraseña".
 *
 * SEGURIDAD:
 *  - El `identifier` se VALIDA estrictamente (longitud + charset) antes de tocar
 *    la BD. Lo que no cumpla se rechaza.
 *  - Las búsquedas usan `.eq()` PARAMETRIZADO (el valor viaja como parámetro, lo
 *    escapa el cliente), nunca interpolación dentro de `.or()`. Esto cierra la
 *    inyección de filtros PostgREST.
 *  - Respuesta UNIFORME: siempre 200 con `{ email }`. Si no se encuentra, se
 *    devuelve el propio identifier, de modo que la respuesta no revela si la
 *    cuenta existe (frena la enumeración) sin romper el flujo de recuperación.
 */

// Longitud máxima defensiva.
const MAX_IDENTIFIER_LENGTH = 254;

// Email válido (simple y suficiente) y nombre de usuario válido (sin espacios
// ni metacaracteres). Solo se aceptan estos dos formatos.
const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
const USERNAME_RE = /^[a-z0-9._-]+$/;

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => null);
        const rawIdentifier = body?.identifier;

        if (typeof rawIdentifier !== 'string' || !rawIdentifier.trim()) {
            return NextResponse.json({ error: 'Identificador requerido' }, { status: 400 });
        }

        const identifier = rawIdentifier.trim().toLowerCase();

        if (identifier.length > MAX_IDENTIFIER_LENGTH) {
            return NextResponse.json({ error: 'Identificador inválido' }, { status: 400 });
        }

        const isEmail = EMAIL_RE.test(identifier);
        const isUsername = USERNAME_RE.test(identifier);

        if (!isEmail && !isUsername) {
            return NextResponse.json({ error: 'Identificador inválido' }, { status: 400 });
        }

        const supabaseAdmin = createServiceClient();

        // Búsqueda parametrizada (sin interpolación en filtros).
        // Primero por usuario; si no, por email. `.eq()` escapa el valor.
        let email: string | null = null;

        const byUsuario = await supabaseAdmin
            .from('usuarios')
            .select('email')
            .eq('usuario', identifier)
            .maybeSingle();
        if (byUsuario.error) throw byUsuario.error;
        email = byUsuario.data?.email ?? null;

        if (!email && isEmail) {
            const byEmail = await supabaseAdmin
                .from('usuarios')
                .select('email')
                .eq('email', identifier)
                .maybeSingle();
            if (byEmail.error) throw byEmail.error;
            email = byEmail.data?.email ?? null;
        }

        // Respuesta uniforme: no revela existencia de la cuenta.
        return NextResponse.json({ email: email || identifier });
    } catch (error: any) {
        console.error('Error in resolve-identifier:', error);
        return NextResponse.json({ error: 'Error al procesar identidad' }, { status: 500 });
    }
}
