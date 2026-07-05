import { createClient } from '@supabase/supabase-js';

/**
 * Re-autenticación por contraseña contra Supabase Auth (fuente única).
 *
 * Antes esto se hacía con bcrypt.compare contra el hash duplicado en
 * usuarios.password, que se desincronizaba del password real de Auth
 * (deuda "doble store bcrypt"): un admin con contraseña correcta era
 * rechazado en el modal de credenciales.
 *
 * Usa un cliente descartable SIN persistencia de sesión: valida la
 * contraseña sin tocar las cookies de la sesión actual del usuario.
 */
export async function verifyUserPassword(usuario: string, password: string): Promise<boolean> {
    if (!usuario || !password) return false;

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } }
    );

    // Misma convención de email interno que /api/auth/login.
    const email = `${usuario.trim().toLowerCase()}@controlcalidad.local`;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.user) return false;

    // Best-effort: revocar el token recién emitido; no afecta el resultado.
    await supabase.auth.signOut().catch(() => undefined);
    return true;
}
