import { createClient } from '@supabase/supabase-js';

/**
 * Cliente de Supabase con Service Role (omite RLS — acceso total a la BD).
 *
 * SEGURIDAD: usar EXCLUSIVAMENTE en código de servidor (rutas API, Server
 * Components, helpers de servidor). NUNCA importar desde un componente
 * `'use client'`.
 *
 * La clave se lee de `SUPABASE_SERVICE_ROLE_KEY` (SIN el prefijo
 * `NEXT_PUBLIC_`). Ese prefijo es lo que haría que Next.js la incrustara en el
 * bundle del navegador; al no llevarlo, la clave solo existe en el servidor.
 *
 * Esta es la ÚNICA factory de cliente service-role del proyecto. Todo el código
 * que necesite privilegios de servicio debe importar `createServiceClient`
 * desde aquí (o reexportado desde `@/lib/api/withAuth`).
 */
export function createServiceClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        }
    );
}
