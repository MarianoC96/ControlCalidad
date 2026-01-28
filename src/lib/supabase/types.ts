export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[];

export type Database = {
    public: {
        Tables: {
            usuarios: {
                Row: {
                    id: number;
                    nombre_completo: string;
                    usuario: string;
                    email: string | null;
                    email_verified: boolean;
                    password: string;
                    activo: boolean;
                    created_at: string;
                    updated_at: string;
                    roles: 'administrador' | 'trabajador';
                    two_factor_secret: string | null;
                };
                Insert: {
                    id?: number;
                    nombre_completo: string;
                    usuario: string;
                    email?: string | null;
                    email_verified?: boolean;
                    password: string;
                    activo?: boolean;
                    created_at?: string;
                    updated_at?: string;
                    roles?: 'administrador' | 'trabajador';
                    two_factor_secret?: string | null;
                };
                Update: {
                    id?: number;
                    nombre_completo?: string;
                    usuario?: string;
                    email?: string | null;
                    email_verified?: boolean;
                    password?: string;
                    activo?: boolean;
                    created_at?: string;
                    updated_at?: string;
                    roles?: 'administrador' | 'trabajador';
                    two_factor_secret?: string | null;
                };
            };
            productos: {
                Row: {
                    id: number;
                    nombre: string;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: number;
                    nombre: string;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: number;
                    nombre?: string;
                    created_at?: string;
                    updated_at?: string;
                };
            };
            parametros_maestros: {
                Row: {
                    id: number;
                    nombre: string;
                    tipo: 'texto' | 'numero' | 'rango';
                    created_at: string;
                };
                Insert: {
                    id?: number;
                    nombre: string;
                    tipo?: 'texto' | 'numero' | 'rango';
                    created_at?: string;
                };
                Update: {
                    id?: number;
                    nombre?: string;
                    tipo?: 'texto' | 'numero' | 'rango';
                    created_at?: string;
                };
            };
            parametros: {
                Row: {
                    id: number;
                    producto_id: number;
                    parametro_maestro_id: number | null;
                    nombre: string;
                    tipo: 'texto' | 'numero' | 'rango';
                    valor: string | null;
                    rango_min: number | null;
                    rango_max: number | null;
                    unidad: string | null;
                    created_at: string;
                };
                Insert: {
                    id?: number;
                    producto_id: number;
                    parametro_maestro_id?: number | null;
                    nombre: string;
                    tipo?: 'texto' | 'numero' | 'rango';
                    valor?: string | null;
                    rango_min?: number | null;
                    rango_max?: number | null;
                    unidad?: string | null;
                    created_at?: string;
                };
                Update: {
                    id?: number;
                    producto_id?: number;
                    parametro_maestro_id?: number | null;
                    nombre?: string;
                    tipo?: 'texto' | 'numero' | 'rango';
                    valor?: string | null;
                    rango_min?: number | null;
                    rango_max?: number | null;
                    unidad?: string | null;
                    created_at?: string;
                };
            };
            registros: {
                Row: {
                    id: number;
                    lote_interno: string;
                    guia: string | null;
                    cantidad: number;
                    producto_id: number;
                    producto_nombre: string;
                    usuario_id: number;
                    usuario_nombre: string;
                    observaciones_generales: string | null;
                    verificado_por: string | null;
                    fecha_registro: string;
                };
                Insert: {
                    id?: number;
                    lote_interno: string;
                    guia?: string | null;
                    cantidad: number;
                    producto_id: number;
                    producto_nombre: string;
                    usuario_id: number;
                    usuario_nombre: string;
                    observaciones_generales?: string | null;
                    verificado_por?: string | null;
                    fecha_registro?: string;
                };
                Update: {
                    id?: number;
                    lote_interno?: string;
                    guia?: string | null;
                    cantidad?: number;
                    producto_id?: number;
                    producto_nombre?: string;
                    usuario_id?: number;
                    usuario_nombre?: string;
                    observaciones_generales?: string | null;
                    verificado_por?: string | null;
                    fecha_registro?: string;
                };
            };
            controles: {
                Row: {
                    id: number;
                    registro_id: number;
                    parametro_nombre: string;
                    rango_completo: string;
                    valor_control: number | null;
                    texto_control: string | null;
                    parametro_tipo: string | null;
                    observacion: string | null;
                    fuera_de_rango: boolean;
                    mensaje_alerta: string | null;
                    created_at: string;
                };
                Insert: {
                    id?: number;
                    registro_id: number;
                    parametro_nombre: string;
                    rango_completo: string;
                    valor_control?: number | null;
                    texto_control?: string | null;
                    parametro_tipo?: string | null;
                    observacion?: string | null;
                    fuera_de_rango?: boolean;
                    mensaje_alerta?: string | null;
                    created_at?: string;
                };
                Update: {
                    id?: number;
                    registro_id?: number;
                    parametro_nombre?: string;
                    rango_completo?: string;
                    valor_control?: number | null;
                    texto_control?: string | null;
                    parametro_tipo?: string | null;
                    observacion?: string | null;
                    fuera_de_rango?: boolean;
                    mensaje_alerta?: string | null;
                    created_at?: string;
                };
            };
            fotos: {
                Row: {
                    id: number;
                    registro_id: number;
                    datos_base64: string;
                    descripcion: string | null;
                    created_at: string;
                };
                Insert: {
                    id?: number;
                    registro_id: number;
                    datos_base64: string;
                    descripcion?: string | null;
                    created_at?: string;
                };
                Update: {
                    id?: number;
                    registro_id?: number;
                    datos_base64?: string;
                    descripcion?: string | null;
                    created_at?: string;
                };
            };
        };
        Views: {
            [_ in never]: never;
        };
        Functions: {
            [_ in never]: never;
        };
        Enums: {
            [_ in never]: never;
        };
    };
};

export type Usuario = Database['public']['Tables']['usuarios']['Row'];
export type Producto = Database['public']['Tables']['productos']['Row'];
export type ParametroMaestro = Database['public']['Tables']['parametros_maestros']['Row'];
export type Parametro = Database['public']['Tables']['parametros']['Row'];
export type Registro = Database['public']['Tables']['registros']['Row'];
export type Control = Database['public']['Tables']['controles']['Row'];
export type Foto = Database['public']['Tables']['fotos']['Row'];
