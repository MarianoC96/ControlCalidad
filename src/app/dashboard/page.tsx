'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function DashboardGateway() {
    const router = useRouter();
    const [isAdmin, setIsAdmin] = useState(false);
    const [hasQualityAccess, setHasQualityAccess] = useState(false);
    const [hasSystemAccess, setHasSystemAccess] = useState(false);
    const [hasEscaneo, setHasEscaneo] = useState(false);
    const [pendingSolicitudes, setPendingSolicitudes] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPermissionsAndRedirect = async () => {
            try {
                // 1. Fetch current user data
                const meRes = await fetch('/api/auth/me');
                if (!meRes.ok) throw new Error("Auth failed");
                const userData = await meRes.json();

                if (userData.roles === 'administrador') {
                    setIsAdmin(true);
                }

                // 2. Fetch specific allowed modules keys
                const permsRes = await fetch('/api/auth/permisos');
                if (!permsRes.ok) throw new Error("Permissions failed");
                const permsData = await permsRes.json();
                const modules = permsData.allowedModules || [];

                // 3. Check for specific module categories (Parents)
                const systemAcc = modules.includes('control-sistema') || userData.roles === 'administrador';
                const qualityAcc = modules.includes('control-calidad') || userData.roles === 'administrador';
                const scannerAcc = modules.includes('escaneo') || userData.permiso_escaneo;

                setHasSystemAccess(systemAcc);
                setHasQualityAccess(qualityAcc);
                setHasEscaneo(scannerAcc);

                // 4. Smart Redirect Logic
                const activeParents = [];
                if (systemAcc) activeParents.push('/control-sistema');
                if (qualityAcc) activeParents.push('/control-calidad/registro-productos');
                if (scannerAcc) activeParents.push('/escaner-codigos/escaner');

                // IF exactly ONE parent is accessible, redirect immediately
                if (activeParents.length === 1) {
                    router.push(activeParents[0]);
                    return; // Stop rendering
                }

                // IF only 'solicitudes' or 'temporal' are accessible but no main parents, redirect to solicitudes
                if (activeParents.length === 0 && modules.includes('solicitudes')) {
                    router.push('/control-sistema/centro-solicitudes');
                    return;
                }

                setLoading(false);
            } catch (err) {
                console.error("Error in dashboard initialization", err);
                setLoading(false);
            }
        };

        const fetchPendingSolicitudes = async () => {
            try {
                const res = await fetch('/api/admin/pending-counts');
                if (res.ok) {
                    const data = await res.json();
                    setPendingSolicitudes(data.pendingSolicitudes || 0);
                }
            } catch (err) {
                console.error("Error fetching pending requests", err);
            }
        };

        fetchPermissionsAndRedirect();
        fetchPendingSolicitudes();
    }, [router]);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-slate-600 font-medium animate-pulse">Cargando acceso seguro...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 bg-[radial-gradient(circle_at_top_right,_var(--primary-400)_0%,_transparent_25%),_radial-gradient(circle_at_bottom_left,_var(--accent-400)_0%,_transparent_25%)]">
            {/* Header Section */}
            <div className="text-center mb-12 relative w-full max-w-5xl">
                {/* Solicitudes Floating Badge for Dashboard */}
                {isAdmin && pendingSolicitudes > 0 && (
                    <Link href="/control-sistema/centro-solicitudes" className="absolute top-0 right-4 group">
                        <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-lg border border-red-100 p-3 pr-5 flex items-center gap-3 hover:bg-red-50 hover:border-red-200 transition-all cursor-pointer transform hover:-translate-y-1">
                            <div className="relative">
                                <i className="bi bi-bell-fill text-red-500 text-xl animate-pulse"></i>
                                <span className="absolute -top-1 -right-2 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border-2 border-white">
                                    {pendingSolicitudes}
                                </span>
                            </div>
                            <div className="text-left flex flex-col">
                                <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Solicitudes</span>
                                <span className="text-sm text-red-700 font-bold leading-tight">Pendientes</span>
                            </div>
                        </div>
                    </Link>
                )}

                <h1 className="text-4xl font-bold text-slate-900 mb-4 tracking-tight">
                    Bienvenido al <span className="text-primary">Centro de Operaciones</span>
                </h1>
                <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                    Selecciona el módulo con el que deseas trabajar hoy. Tu sesión está activa y protegida.
                </p>
            </div>

            {/* Gateway Cards Container */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full max-w-6xl px-4">

                {/* Card 1: Control de Sistema */}
                {hasSystemAccess && (
                    <Link href="/control-sistema" className="group">
                        <div className="relative h-[400px] rounded-3xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 cursor-pointer bg-white border border-slate-200">
                            {/* Background Image with Overlay */}
                            <div
                                className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110 bg-slate-800"
                            >
                                <div className="absolute inset-0 bg-gradient-to-br from-[#58623f] px-2 via-[#7b7c2b]/80 to-[#1e293b]/90 opacity-90 group-hover:opacity-100 transition-opacity duration-500"></div>
                            </div>

                            {/* Content */}
                            <div className="absolute inset-0 flex flex-col justify-end p-8">
                                <div className="bg-[#969836]/30 backdrop-blur-md w-14 h-14 rounded-2xl flex items-center justify-center mb-6 border border-white/20 group-hover:bg-[#969836]/50 transition-colors">
                                    <i className="bi bi-cpu text-white text-3xl"></i>
                                </div>
                                <h2 className="text-3xl font-bold text-white mb-3">Control de Sistema</h2>
                                <p className="text-slate-200 text-lg opacity-90 group-hover:opacity-100 transition-opacity">
                                    Administración centralizada de usuarios, parámetros operativos y registros de auditoría.
                                </p>

                                <div className="mt-6 flex items-center text-[#b5b74b] font-semibold text-lg group-hover:translate-x-2 transition-transform">
                                    Gestionar sistema <i className="bi bi-arrow-right ml-2"></i>
                                </div>
                            </div>
                        </div>
                    </Link>
                )}

                {/* Card 2: Control de Calidad */}
                {hasQualityAccess && (
                    <Link href="/control-calidad/registro-productos" className="group">
                        <div className="relative h-[400px] rounded-3xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 cursor-pointer bg-white border border-slate-200">
                            {/* Background Image with Overlay */}
                            <div
                                className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                                style={{ backgroundImage: 'url("/quality-control.png")' }}
                            >
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent group-hover:from-black/90 transition-all duration-500"></div>
                            </div>

                            {/* Content */}
                            <div className="absolute inset-0 flex flex-col justify-end p-8">
                                <div className="bg-primary/20 backdrop-blur-md w-14 h-14 rounded-2xl flex items-center justify-center mb-6 border border-white/20 group-hover:bg-primary/40 transition-colors">
                                    <i className="bi bi-shield-check text-white text-3xl"></i>
                                </div>
                                <h2 className="text-3xl font-bold text-white mb-3">Control de Calidad</h2>
                                <p className="text-slate-200 text-lg opacity-90 group-hover:opacity-100 transition-opacity">
                                    Registro de inspecciones técnicas, validación de parámetros y gestión de protocolos normativos.
                                </p>

                                <div className="mt-6 flex items-center text-primary font-semibold text-lg group-hover:translate-x-2 transition-transform">
                                    Ingresar al módulo <i className="bi bi-arrow-right ml-2"></i>
                                </div>
                            </div>
                        </div>
                    </Link>
                )}

                {/* Card 3: Escaneo de Códigos */}
                {hasEscaneo && (
                    <Link href="/escaner-codigos/escaner" className="group">
                        <div className="relative h-[400px] rounded-3xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 cursor-pointer bg-white border border-slate-200">
                            {/* Background Image with Overlay */}
                            <div
                                className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                                style={{ backgroundImage: 'url("/barcode-scanner.png")' }}
                            >
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/50 to-transparent group-hover:from-slate-900 transition-all duration-500"></div>
                            </div>

                            {/* Content */}
                            <div className="absolute inset-0 flex flex-col justify-end p-8">
                                <div className="bg-blue-500/20 backdrop-blur-md w-14 h-14 rounded-2xl flex items-center justify-center mb-6 border border-white/20 group-hover:bg-blue-500/40 transition-colors">
                                    <i className="bi bi-qr-code-scan text-white text-3xl"></i>
                                </div>
                                <h2 className="text-3xl font-bold text-white mb-3">Escaneo de Códigos</h2>
                                <p className="text-slate-200 text-lg opacity-90 group-hover:opacity-100 transition-opacity">
                                    Identificación rápida de productos y lotes mediante cámara para agilizar la captura de datos.
                                </p>

                                <div className="mt-6 flex items-center text-blue-400 font-semibold text-lg group-hover:translate-x-2 transition-transform">
                                    Ingresar al módulo <i className="bi bi-arrow-right ml-2"></i>
                                </div>
                            </div>
                        </div>
                    </Link>
                )}

            </div>

            {/* Footer Info */}
            <div className="mt-16 text-slate-400 text-sm flex items-center gap-4 animate-in fade-in duration-1000">
                <span className="flex items-center"><i className="bi bi-lock-fill mr-1"></i> Conexión Segura</span>
                <span>•</span>
                <span>Versión 2.5.0</span>
                <span>•</span>
                <span>El Olivar - Calidad Superior</span>
            </div>

            <style jsx>{`
        .animate-in {
          animation: 0.7s ease-out both;
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slide-in-from-top-4 {
          from { transform: translateY(-1rem); }
          to { transform: translateY(0); }
        }
        .fade-in { animation-name: fade-in; }
        .slide-in-from-top-4 { animation-name: slide-in-from-top-4; }
      `}</style>
        </div>
    );
}
