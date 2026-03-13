'use client';

import { useState, useEffect } from 'react';
import LoadingOverlay from '@/components/LoadingOverlay';
import { useRouter } from 'next/navigation';

export default function ConfigPdfClient() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [userName, setUserName] = useState('');
    const [userRole, setUserRole] = useState('');
    const [config, setConfig] = useState({
        titulo: '',
        codigo: '',
        edicion: '',
        aprobado_por: ''
    });
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        // Run auth check and config load in PARALLEL
        Promise.all([checkAuth(), loadConfig()]);
    }, []);

    const checkAuth = async () => {
        const response = await fetch('/api/auth/me');
        if (!response.ok) {
            router.push('/');
            return;
        }
        const user = await response.json();
        setUserName(user.nombre_completo);
        setUserRole(user.roles);

        if (user.roles !== 'administrador') {
            router.push('/control-calidad/registro-productos');
        }
    };

    const loadConfig = async () => {
        try {
            const res = await fetch('/api/config/pdf');
            if (res.ok) {
                const data = await res.json();
                setConfig(data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
        setMessage(null);
        loadConfig(); // Revert changes
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);

        try {
            const res = await fetch('/api/config/pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });

            if (res.ok) {
                setMessage({ type: 'success', text: 'Configuración guardada exitosamente' });
                setIsEditing(false);
            } else {
                setMessage({ type: 'error', text: 'Error al guardar configuración' });
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Error de conexión' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="page-wrapper relative min-h-screen overflow-x-hidden">
            {/* Background Ambient Effects */}
            <div className="absolute top-0 right-0 w-full h-screen bg-[radial-gradient(circle_at_top_right,_var(--primary-100)_0%,_transparent_25%),_radial-gradient(circle_at_bottom_left,_var(--accent-100)_0%,_transparent_25%)] pointer-events-none -z-10 opacity-50"></div>
            
            <main className="main-content relative z-10">
                {/* Header Premium con Retorno */}
                <div className="mb-10 animate-in fade-in slide-in-from-top-4 duration-700">
                    <div className="flex items-center gap-4 mb-2">
                        <button 
                            onClick={() => router.push('/dashboard')}
                            className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 transition-all shadow-sm group"
                        >
                            <i className="bi bi-arrow-left group-hover:-translate-x-1 transition-transform"></i>
                        </button>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="flex items-center gap-1.5 bg-indigo-100 text-indigo-700 text-[9px] px-2.5 py-1 rounded-full font-black uppercase tracking-widest ring-1 ring-indigo-200">
                                    <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-pulse"></span>
                                    Administración Central
                                </span>
                            </div>
                            <h1 className="text-3xl font-black text-[#1e293b] tracking-tighter uppercase m-0">
                                Configuración de Reportes
                            </h1>
                        </div>
                    </div>
                    <p className="text-slate-500 text-sm font-medium ml-14">
                        Personaliza los metadatos y la identidad visual de los documentos PDF generados por el sistema.
                    </p>
                </div>

                {loading ? (
                    <LoadingOverlay message="Cargando configuración..." />
                ) : (
                    <>
                        {/* Card de Configuración */}
                        <div className="bg-white border border-slate-200 rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden mb-8 group transition-all hover:shadow-[0_20px_50px_rgba(0,0,0,0.08)]">
                            <div className={`p-6 flex items-center justify-between border-b border-slate-100 transition-all ${isEditing ? 'bg-amber-50/50' : 'bg-white'}`}>
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-inner transition-all ${isEditing ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                        <i className={`bi ${isEditing ? 'bi-pencil-square' : 'bi-file-earmark-text'}`}></i>
                                    </div>
                                    <div>
                                        <h2 className="text-sm font-black text-[#1e293b] uppercase tracking-tight m-0">
                                            {isEditing ? 'Editando Encabezado' : 'Datos del Encabezado'}
                                        </h2>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest m-0 leading-none mt-1">
                                            {isEditing ? 'Modificando información oficial' : 'Información actual del sistema'}
                                        </p>
                                    </div>
                                </div>
                                {!isEditing && (
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        className="bg-indigo-600 text-white px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95 flex items-center gap-2"
                                    >
                                        <i className="bi bi-pencil-fill"></i> Habilitar Edición
                                    </button>
                                )}
                            </div>

                            <div className="p-8">
                                {message && (
                                    <div className={`mb-6 p-4 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>
                                        <i className={`bi ${message.type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'}`}></i>
                                        <span className="text-sm font-bold">{message.text}</span>
                                    </div>
                                )}

                                <form onSubmit={handleSave} className="space-y-8">
                                    <div className="space-y-2">
                                        <label className="text-[10px] text-[#94a3b8] uppercase font-bold tracking-widest ml-1">Título del Reporte</label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                className={`w-full bg-white border rounded-2xl px-6 py-4 text-[#1e293b] font-bold outline-none transition-all ${isEditing ? 'border-indigo-200 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-50 shadow-sm' : 'border-slate-100 bg-slate-50/50 cursor-not-allowed text-slate-500'}`}
                                                value={config.titulo}
                                                onChange={e => setConfig({ ...config, titulo: e.target.value })}
                                                disabled={!isEditing}
                                                placeholder="EJ: PROTOCOLO DE INSPECCIÓN DE PRODUCTO TERMINADO"
                                            />
                                            <i className={`bi bi-fonts absolute right-5 top-1/2 -translate-y-1/2 ${isEditing ? 'text-indigo-400' : 'text-slate-300'}`}></i>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] text-[#94a3b8] uppercase font-bold tracking-widest ml-1">Código de Doc.</label>
                                            <input
                                                type="text"
                                                className={`w-full bg-white border rounded-2xl px-5 py-3 text-[#1e293b] font-bold outline-none transition-all ${isEditing ? 'border-indigo-200 focus:border-indigo-600' : 'border-slate-100 bg-slate-50/50 cursor-not-allowed'}`}
                                                value={config.codigo}
                                                onChange={e => setConfig({ ...config, codigo: e.target.value })}
                                                disabled={!isEditing}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] text-[#94a3b8] uppercase font-bold tracking-widest ml-1">Edición / Versión</label>
                                            <input
                                                type="text"
                                                className={`w-full bg-white border rounded-2xl px-5 py-3 text-[#1e293b] font-bold outline-none transition-all ${isEditing ? 'border-indigo-200 focus:border-indigo-600' : 'border-slate-100 bg-slate-50/50 cursor-not-allowed'}`}
                                                value={config.edicion}
                                                onChange={e => setConfig({ ...config, edicion: e.target.value })}
                                                disabled={!isEditing}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] text-[#94a3b8] uppercase font-bold tracking-widest ml-1">Vigencia</label>
                                            <input
                                                type="date"
                                                className={`w-full bg-white border rounded-2xl px-5 py-3 text-[#1e293b] font-bold outline-none transition-all ${isEditing ? 'border-indigo-200 focus:border-indigo-600' : 'border-slate-100 bg-slate-50/50 cursor-not-allowed'}`}
                                                value={config.aprobado_por}
                                                onChange={e => setConfig({ ...config, aprobado_por: e.target.value })}
                                                disabled={!isEditing}
                                            />
                                        </div>
                                    </div>

                                    {isEditing && (
                                        <div className="pt-6 flex justify-end gap-4 border-t border-slate-100 animate-in fade-in slide-in-from-bottom-2">
                                            <button
                                                type="button"
                                                onClick={handleCancelEdit}
                                                className="px-6 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-colors"
                                            >
                                                Descartar
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={saving}
                                                className="px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 flex items-center gap-2"
                                            >
                                                {saving ? 'Guardando...' : <><i className="bi bi-cloud-check-fill"></i> Guardar Cambios</>}
                                            </button>
                                        </div>
                                    )}
                                </form>
                            </div>
                        </div>

                        {/* Vista Previa */}
                        <div className="bg-slate-900 rounded-[32px] overflow-hidden shadow-2xl relative">
                            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-slate-800 text-indigo-400 flex items-center justify-center">
                                        <i className="bi bi-eye-fill"></i>
                                    </div>
                                    <div>
                                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest m-0">Previsualización en Tiempo Real</h3>
                                        <p className="text-[9px] font-medium text-slate-500 uppercase m-0">Renderizado simétrico del documento oficial</p>
                                    </div>
                                </div>
                                <div className="flex gap-1.5">
                                    <div className="w-2.5 h-2.5 rounded-full bg-slate-700"></div>
                                    <div className="w-2.5 h-2.5 rounded-full bg-slate-700"></div>
                                    <div className="w-2.5 h-2.5 rounded-full bg-slate-700"></div>
                                </div>
                            </div>

                            <div className="p-8 sm:p-12 bg-[#1e293b] flex justify-center overflow-x-auto">
                                <div className="document-sheet shadow-[0_30px_60px_rgba(0,0,0,0.5)] transform hover:scale-[1.02] transition-transform duration-500 scale-90 sm:scale-100 origin-center">
                                    <div className="pdf-header-wrapper">
                                        <div className="header-cell logo-cell">
                                            <img
                                                src="/logo.png"
                                                alt="Logo"
                                                className="header-logo"
                                                onError={(e) => {
                                                    const target = e.target as HTMLImageElement;
                                                    target.style.display = 'none';
                                                    if (target.nextElementSibling) {
                                                        target.nextElementSibling.classList.remove('d-none');
                                                    }
                                                }}
                                            />
                                            <div className="logo-placeholder d-none">EL OLIVAR</div>
                                        </div>

                                        <div className="header-cell title-cell">
                                            <div className="header-title">{config.titulo || 'PROTOCOLO DE CONTROL DE CALIDAD - PRODUCTO TERMINADO'}</div>
                                        </div>

                                        <div className="header-cell info-cell">
                                            <div className="info-row">CÓD.: {config.codigo || 'S-CC-OP-01'}</div>
                                            <div className="info-row">EDICIÓN: {config.edicion || '01'}</div>
                                            <div className="info-row last">
                                                {config.aprobado_por
                                                    ? (() => {
                                                        const dateVal = config.aprobado_por;
                                                        if (/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
                                                            const [y, m, d] = dateVal.split('-');
                                                            return `VIG.: ${d}-${m}-${y}`;
                                                        }
                                                        return `VIG.: ${dateVal}`;
                                                    })()
                                                    : 'VIGENCIA'}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Document Anatomy Simulation */}
                                    <div className="mt-8 space-y-4 opacity-10">
                                        <div className="h-4 bg-slate-900 rounded w-1/3"></div>
                                        <div className="grid grid-cols-4 gap-2">
                                            {[1,2,3,4].map(i => <div key={i} className="h-2 bg-slate-700 rounded"></div>)}
                                        </div>
                                        <div className="space-y-2">
                                            {[1,2,3,4,5].map(i => <div key={i} className="h-1 bg-slate-500 rounded w-full"></div>)}
                                        </div>
                                        <div className="pt-8 flex justify-between">
                                            <div className="w-32 h-1 bg-slate-900 mt-12"></div>
                                            <div className="w-32 h-1 bg-slate-900 mt-12"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </main>

            <style jsx>{`
                .main-content {
                    max-width: 1000px;
                    margin: 0 auto;
                    padding: 40px 24px;
                }

                .document-sheet {
                    background: white;
                    width: 100%;
                    max-width: 680px;
                    padding: 48px;
                    border: 1px solid #e1e8f0;
                }

                .pdf-header-wrapper {
                    border: 1.5px solid #000;
                    height: 85px;
                    display: flex;
                    width: 100%;
                }

                .header-cell {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-right: 1.5px solid #000;
                }

                .logo-cell {
                    width: 25%;
                    padding: 8px;
                }

                .header-logo {
                    max-height: 100%;
                    max-width: 100%;
                    object-fit: contain;
                }

                .logo-placeholder {
                    font-size: 11px;
                    color: #000;
                    font-weight: 900;
                    letter-spacing: 1px;
                }

                .title-cell {
                    width: 55%;
                    padding: 10px;
                }

                .header-title {
                    font-size: 0.95rem;
                    font-weight: 900;
                    text-transform: uppercase;
                    text-align: center;
                    font-family: 'Helvetica', Arial, sans-serif;
                    line-height: 1.2;
                }

                .info-cell {
                    width: 20%;
                    border-right: none;
                    flex-direction: column;
                }

                .info-row {
                    flex: 1;
                    width: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-bottom: 1.5px solid #000;
                    font-size: 0.65rem;
                    font-weight: 900;
                    font-family: 'Helvetica', Arial, sans-serif;
                }

                .info-row.last {
                    border-bottom: none;
                }

                .animate-in {
                    animation: slide-up 0.6s ease-out forwards;
                }

                @keyframes slide-up {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                @media (max-width: 768px) {
                    .document-sheet {
                        padding: 24px;
                    }
                    .pdf-header-wrapper {
                        height: 70px;
                    }
                    .header-title { font-size: 0.75rem; }
                    .info-row { font-size: 0.6rem; }
                }
            `}</style>
        </div>
    );
}
