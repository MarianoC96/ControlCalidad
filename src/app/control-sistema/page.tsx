'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function ControlSistemaGateway() {
    const router = useRouter();
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPermissions = async () => {
            try {
                const res = await fetch('/api/auth/me');
                if (res.ok) {
                    const data = await res.json();
                    if (data.roles === 'administrador') {
                        setIsAdmin(true);
                    } else {
                        // Redirect if not admin
                        router.push('/dashboard');
                    }
                } else {
                    router.push('/');
                }
            } catch (err) {
                console.error("Error fetching permissions", err);
                router.push('/');
            } finally {
                setLoading(false);
            }
        };

        fetchPermissions();
    }, [router]);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center pl-0 lg:pl-[var(--sidebar-width)] transition-all">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-slate-200 border-t-[#208754] rounded-full animate-spin"></div>
                    <p className="text-slate-500 font-semibold uppercase tracking-widest text-sm">Cargando...</p>
                </div>
            </div>
        );
    }

    if (!isAdmin) return null; // Prevent flash before redirect

    return (
        <div className="min-h-screen bg-[#f8fafc] flex flex-col pl-0 lg:pl-0 transition-all overflow-x-hidden pb-32">
            
            {/* Background Ambient Effects */}
            <div className="absolute top-0 right-0 w-full h-96 bg-gradient-to-b from-[#f1f5f9]/80 to-transparent pointer-events-none -z-10"></div>
            <div className="absolute top-1/4 -right-20 w-72 h-72 bg-[#969836]/5 rounded-full blur-[80px] pointer-events-none -z-10"></div>

            <main className="relative z-10 flex-1 flex flex-col p-6 sm:p-10 w-full max-w-6xl mx-auto">
                
                {/* Header */}
                <div className="mb-10 animate-in fade-in slide-in-from-top-4 duration-700">
                    <div className="flex items-center gap-4 mb-2">
                        <Link href="/dashboard" className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-[#208754] hover:bg-[#208754]/5 hover:border-[#208754]/20 transition-all shadow-sm">
                            <i className="bi bi-arrow-left"></i>
                        </Link>
                        <h1 className="text-3xl sm:text-4xl font-black text-[#1e293b] tracking-tight m-0 bg-clip-text text-transparent bg-gradient-to-r from-[#1e293b] to-[#475569]">
                            Control de Sistema
                        </h1>
                    </div>
                    <p className="text-slate-500 text-lg max-w-2xl ml-14">
                        Administración centralizada de usuarios, parámetros operativos y registros de auditoría.
                    </p>
                </div>

                {/* Grid Modules */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
                    
                    {/* Usuarios */}
                    <Link href="/control-sistema/gestion-usuarios" className="group">
                        <div className="h-full bg-white border border-slate-200 rounded-3xl p-6 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] hover:shadow-[0_20px_40px_-10px_rgba(32,135,84,0.15)] hover:border-[#208754]/30 transition-all duration-300 relative overflow-hidden flex flex-col gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#208754]/10 to-[#208754]/5 border border-[#208754]/10 text-[#208754] flex items-center justify-center text-2xl group-hover:bg-[#208754] group-hover:text-white transition-all duration-300 shadow-inner">
                                <i className="bi bi-people-fill"></i>
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-800 mb-1 group-hover:text-[#208754] transition-colors">Gestión de Usuarios</h3>
                                <p className="text-sm text-slate-500 leading-relaxed">
                                    Administra accesos, roles, y cuentas de los colaboradores del sistema.
                                </p>
                            </div>
                            <div className="mt-auto pt-4 flex items-center text-[#208754] font-semibold text-sm group-hover:translate-x-2 transition-transform">
                                <span className="uppercase tracking-wider text-[11px] font-bold">Ingresar</span> <i className="bi bi-arrow-right ml-2 text-lg leading-none"></i>
                            </div>
                        </div>
                    </Link>


                    {/* Solicitudes */}
                    <Link href="/control-sistema/centro-solicitudes" className="group">
                        <div className="h-full bg-white border border-slate-200 rounded-3xl p-6 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] hover:shadow-[0_20px_40px_-10px_rgba(239,68,68,0.15)] hover:border-red-500/30 transition-all duration-300 relative overflow-hidden flex flex-col gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500/10 to-red-500/5 border border-red-500/10 text-red-500 flex items-center justify-center text-2xl group-hover:bg-red-500 group-hover:text-white transition-all duration-300 shadow-inner">
                                <i className="bi bi-inboxes-fill"></i>
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-800 mb-1 group-hover:text-red-600 transition-colors">Centro de Solicitudes</h3>
                                <p className="text-sm text-slate-500 leading-relaxed">
                                    Revisa y aprueba solicitudes de edición de registros enviadas por trabajadores.
                                </p>
                            </div>
                            <div className="mt-auto pt-4 flex items-center text-red-500 font-semibold text-sm group-hover:translate-x-2 transition-transform">
                                <span className="uppercase tracking-wider text-[11px] font-bold">Ingresar</span> <i className="bi bi-arrow-right ml-2 text-lg leading-none"></i>
                            </div>
                        </div>
                    </Link>

                    {/* Accesos a Sistema */}
                    <Link href="/control-sistema/auditoria-accesos" className="group">
                        <div className="h-full bg-white border border-slate-200 rounded-3xl p-6 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] hover:shadow-[0_20px_40px_-10px_rgba(14,165,233,0.15)] hover:border-sky-500/30 transition-all duration-300 relative overflow-hidden flex flex-col gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-500/10 to-sky-500/5 border border-sky-500/10 text-sky-500 flex items-center justify-center text-2xl group-hover:bg-sky-500 group-hover:text-white transition-all duration-300 shadow-inner">
                                <i className="bi bi-shield-lock-fill"></i>
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-800 mb-1 group-hover:text-sky-600 transition-colors">Auditoría y Accesos</h3>
                                <p className="text-sm text-slate-500 leading-relaxed">
                                    Visualiza la bitácora de conexiones y accesos al sistema por fecha y usuario.
                                </p>
                            </div>
                            <div className="mt-auto pt-4 flex items-center text-sky-500 font-semibold text-sm group-hover:translate-x-2 transition-transform">
                                <span className="uppercase tracking-wider text-[11px] font-bold">Ingresar</span> <i className="bi bi-arrow-right ml-2 text-lg leading-none"></i>
                            </div>
                        </div>
                    </Link>

                    {/* Edición de PDF (Settings) */}
                    <Link href="/control-sistema/config-reporte" className="group">
                        <div className="h-full bg-white border border-slate-200 rounded-3xl p-6 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] hover:shadow-[0_20px_40px_-10px_rgba(139,92,246,0.15)] hover:border-purple-500/30 transition-all duration-300 relative overflow-hidden flex flex-col gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/10 text-purple-500 flex items-center justify-center text-2xl group-hover:bg-purple-500 group-hover:text-white transition-all duration-300 shadow-inner">
                                <i className="bi bi-file-earmark-pdf-fill"></i>
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-800 mb-1 group-hover:text-purple-600 transition-colors">Configuración de Reportes</h3>
                                <p className="text-sm text-slate-500 leading-relaxed">
                                    Personaliza los márgenes, logos o firmas de los PDF generados en el sistema.
                                </p>
                            </div>
                            <div className="mt-auto pt-4 flex items-center text-purple-500 font-semibold text-sm group-hover:translate-x-2 transition-transform">
                                <span className="uppercase tracking-wider text-[11px] font-bold">Ingresar</span> <i className="bi bi-arrow-right ml-2 text-lg leading-none"></i>
                            </div>
                        </div>
                    </Link>

                </div>

            </main>
        </div>
    );
}
