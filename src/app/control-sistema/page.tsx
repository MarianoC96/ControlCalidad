'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function ControlSistemaGateway() {
    const router = useRouter();
    const [isAdmin, setIsAdmin] = useState(false);
    const [userPerms, setUserPerms] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPermissions = async () => {
            try {
                const res = await fetch('/api/auth/me');
                if (res.ok) {
                    const data = await res.json();
                    const hasControlAccess = data.role_permisos?.includes('control-sistema');
                    setUserPerms(data.role_permisos || []);
                    if (hasControlAccess) {
                        setIsAdmin(true);
                    } else {
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
                    <p className="text-slate-500 font-semibold uppercase tracking-widest text-sm">Validando credenciales...</p>
                </div>
            </div>
        );
    }

    if (!isAdmin) return null;

    return (
        <div className="min-h-screen bg-[#f8fafc] flex flex-col transition-all overflow-x-hidden pb-32 relative">
            
            {/* Ambient Background Effects */}
            <div className="ambient-background">
                <div className="ambient-sphere-1"></div>
                <div className="ambient-sphere-2"></div>
            </div>

            <main className="relative z-10 flex-1 flex flex-col p-6 lg:py-10 lg:px-8 w-full max-w-[1000px] mx-auto animate-in">
                
                {/* Header Premium Stack */}
                <div className="header-premium-stack mb-12">
                    <div className="badge-system-premium mb-4">
                        <span className="dot-pulse"></span>
                        <span className="badge-text">CENTRO DE CONTROL MAESTRO</span>
                    </div>
                    
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div>
                            <h1 className="title-premium">Gestión de Sistema</h1>
                            <p className="subtitle-premium">Configuración global de accesos, parámetros operativos y registros maestros del ecosistema El Olivar.</p>
                        </div>
                        
                        <div className="stats-box-premium">
                            <div className="stat-mini">
                                <span className="label">ESTADO SERVICIO</span>
                                <span className="val text-green-500 font-black flex items-center gap-1">
                                    <i className="bi bi-shield-check"></i> ACTIVO
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Grid Modules Premium */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                    
                    {/* Tarjeta 1: Usuarios */}
                    {userPerms.includes('usuarios') && (
                        <Link href="/control-sistema/gestion-usuarios" className="card-module-premium group">
                            <div className="icon-wrapper bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white">
                                <i className="bi bi-people-fill"></i>
                            </div>
                            <div className="card-body">
                                <h3>Gestión de Usuarios</h3>
                                <p>Administra cuentas, roles y niveles de acceso para todo el personal.</p>
                            </div>
                            <div className="card-footer">
                                <span>CONFIGURAR</span>
                                <i className="bi bi-arrow-right"></i>
                            </div>
                            <div className="ambient-glow bg-emerald-400/10"></div>
                        </Link>
                    )}

                    {/* Tarjeta 2: Solicitudes */}
                    {userPerms.includes('solicitudes') && (
                        <Link href="/control-sistema/centro-solicitudes" className="card-module-premium group">
                            <div className="icon-wrapper bg-rose-50 text-rose-600 group-hover:bg-rose-600 group-hover:text-white">
                                <i className="bi bi-patch-check-fill"></i>
                            </div>
                            <div className="card-body">
                                <h3>Centro de Solicitudes</h3>
                                <p>Supervisa y autoriza ediciones extraordinarias en registros históricos.</p>
                            </div>
                            <div className="card-footer">
                                <span className="text-rose-600">REVISAR</span>
                                <i className="bi bi-arrow-right text-rose-600"></i>
                            </div>
                            <div className="ambient-glow bg-rose-400/10"></div>
                        </Link>
                    )}

                    {/* Tarjeta 3: Auditoría */}
                    {userPerms.includes('accesos') && (
                        <Link href="/control-sistema/auditoria-accesos" className="card-module-premium group">
                            <div className="icon-wrapper bg-sky-50 text-sky-600 group-hover:bg-sky-600 group-hover:text-white">
                                <i className="bi bi-terminal-split"></i>
                            </div>
                            <div className="card-body">
                                <h3>Auditoría y Accesos</h3>
                                <p>Trazabilidad completa de conexiones y operaciones críticas en el sistema.</p>
                            </div>
                            <div className="card-footer">
                                <span className="text-sky-600">VER REGISTROS</span>
                                <i className="bi bi-arrow-right text-sky-600"></i>
                            </div>
                            <div className="ambient-glow bg-sky-400/10"></div>
                        </Link>
                    )}

                    {/* Tarjeta 4: Reportes */}
                    {(userPerms.includes('admin/config-pdf') || userPerms.includes('admin/config-reportes')) && (
                        <Link href="/control-sistema/config-reporte" className="card-module-premium group">
                            <div className="icon-wrapper bg-violet-50 text-violet-600 group-hover:bg-violet-600 group-hover:text-white">
                                <i className="bi bi-file-earmark-pdf-fill"></i>
                            </div>
                            <div className="card-body">
                                <h3>Config. de Reportes</h3>
                                <p>Personalización de logos, firmas y márgenes para documentos PDF.</p>
                            </div>
                            <div className="card-footer">
                                <span className="text-violet-600">AJUSTAR</span>
                                <i className="bi bi-arrow-right text-violet-600"></i>
                            </div>
                            <div className="ambient-glow bg-violet-400/10"></div>
                        </Link>
                    )}

                </div>

                {/* Footer contextual */}
                <div className="mt-20 pt-10 border-t border-slate-200/60 flex flex-col md:flex-row items-center justify-between gap-6 text-slate-400 text-sm font-medium">
                    <div className="flex items-center gap-6">
                        <span className="flex items-center gap-2">
                            <i className="bi bi-cpu"></i> v2.4.0 Stable
                        </span>
                        <span className="flex items-center gap-2 text-emerald-500/80">
                            <i className="bi bi-check-all"></i> Todos los sistemas operativos
                        </span>
                    </div>
                    <div className="hover:text-slate-600 transition-colors cursor-help">
                        Manual Administrativo <i className="bi bi-question-circle ml-1"></i>
                    </div>
                </div>

            </main>

            <style jsx>{`
                .ambient-background {
                    position: fixed;
                    inset: 0;
                    pointer-events: none;
                    z-index: 0;
                    overflow: hidden;
                }
                .ambient-sphere-1 {
                    position: absolute;
                    top: -10%;
                    right: -5%;
                    width: 500px;
                    height: 500px;
                    background: radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, rgba(16, 185, 129, 0) 70%);
                    filter: blur(80px);
                }
                .ambient-sphere-2 {
                    position: absolute;
                    bottom: -10%;
                    left: -5%;
                    width: 400px;
                    height: 400px;
                    background: radial-gradient(circle, rgba(99, 102, 241, 0.08) 0%, rgba(99, 102, 241, 0) 70%);
                    filter: blur(80px);
                }

                .animate-in {
                    animation: fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1);
                }
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                .badge-system-premium {
                    display: inline-flex;
                    align-items: center;
                    gap: 10px;
                    background: white;
                    padding: 8px 18px;
                    border-radius: 50px;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
                    border: 1px solid #f1f5f9;
                }
                .dot-pulse { width: 8px; height: 8px; background: #10b981; border-radius: 50%; position: relative; }
                .dot-pulse::after {
                    content: ''; position: absolute; inset: 0; border-radius: 50%;
                    background: #10b981; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
                }
                @keyframes ping { 75%, 100% { transform: scale(3.5); opacity: 0; } }
                .badge-text { font-size: 0.7rem; font-weight: 900; color: #64748b; letter-spacing: 0.1em; }

                .title-premium {
                    font-size: 3.2rem;
                    font-weight: 900;
                    color: #0f172a;
                    letter-spacing: -0.04em;
                    line-height: 1;
                    margin: 0;
                }
                .subtitle-premium {
                    font-size: 1.15rem;
                    color: #64748b;
                    margin-top: 1rem;
                    max-width: 600px;
                    line-height: 1.6;
                    font-weight: 500;
                }

                .stats-box-premium {
                    background: white;
                    padding: 1rem 1.5rem;
                    border-radius: 20px;
                    border: 1px solid #f1f5f9;
                    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.03);
                }
                .stat-mini .label { display: block; font-size: 0.65rem; font-weight: 900; color: #94a3b8; letter-spacing: 0.05em; margin-bottom: 4px; }
                .stat-mini .val { font-size: 1rem; }

                .card-module-premium {
                    background: white;
                    border: 1px solid #f1f5f9;
                    border-radius: 32px;
                    padding: 32px;
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                    transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                    position: relative;
                    overflow: hidden;
                    text-decoration: none;
                    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02);
                }
                .card-module-premium:hover {
                    transform: translateY(-8px) scale(1.02);
                    border-color: #e2e8f0;
                    box-shadow: 0 30px 60px -12px rgba(0, 0, 0, 0.08);
                }

                .icon-wrapper {
                    width: 64px;
                    height: 64px;
                    border-radius: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.8rem;
                    transition: all 0.3s;
                    box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);
                }

                .card-body h3 { font-size: 1.3rem; font-weight: 800; color: #1e293b; margin-bottom: 8px; }
                .card-body p { font-size: 0.95rem; color: #64748b; line-height: 1.5; font-weight: 500; }

                .card-footer {
                    margin-top: auto;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 0.75rem;
                    font-weight: 900;
                    letter-spacing: 0.05em;
                    color: #10b981;
                }
                .card-footer i { font-size: 1.2rem; transition: transform 0.3s; }
                .card-module-premium:hover .card-footer i { transform: translateX(6px); }

                .ambient-glow {
                    position: absolute;
                    bottom: -20px;
                    right: -20px;
                    width: 120px;
                    height: 120px;
                    border-radius: 50%;
                    filter: blur(40px);
                    opacity: 0;
                    transition: opacity 0.4s;
                }
                .card-module-premium:hover .ambient-glow { opacity: 1; }

                @media (max-width: 992px) {
                    .title-premium { font-size: 2.2rem; }
                    .header-premium-stack { margin-bottom: 2rem; }
                }
            `}</style>
        </div>
    );
}

