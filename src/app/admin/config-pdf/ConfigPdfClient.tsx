'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
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
        checkAuth();
        loadConfig();
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
            router.push('/registro-productos');
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

    if (loading) return <div className="p-5 text-center">Cargando...</div>;

    return (
        <>
            <Navbar userName={userName} userRole={userRole as any} onLogout={async () => {
                await fetch('/api/auth/logout', { method: 'POST' });
                router.push('/');
            }} />

            <div className="container py-5">
                <div className="mx-auto" style={{ maxWidth: '850px' }}>
                    {/* Header Principal */}
                    <div className="text-center mb-5">
                        <h2 className="fw-bold" style={{ color: 'var(--primary-800)' }}>Configuración de Reportes</h2>
                        <p className="text-muted">Personaliza la cabecera oficial de tus documentos PDF</p>
                    </div>

                    {/* Card de Configuración */}
                    <div className="card shadow-sm border-0 mb-5 overflow-hidden">
                        <div className={`py-4 px-4 transition-all ${isEditing ? 'bg-warning bg-opacity-10' : 'bg-light'}`} style={{ borderBottom: '1px solid var(--border)', transition: 'background-color 0.3s ease' }}>
                            <div>
                                <h5 className="mb-0 fw-bold d-block" style={{ color: 'var(--primary-800)', fontSize: '1.25rem' }}>
                                    {isEditing ? 'Configurando Encabezado' : 'Valores del Encabezado'}
                                </h5>
                                <span className="text-muted small d-block">
                                    {isEditing ? 'Estás editando la información oficial del reporte' : 'Consulta la información actual del PDF'}
                                </span>
                            </div>
                        </div>

                        <div className="card-body p-4 p-md-5">
                            {message && (
                                <div className={`alert alert-${message.type === 'success' ? 'success' : 'danger'} mb-4 d-flex align-items-center`}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="me-2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                                    {message.text}
                                </div>
                            )}

                            <form onSubmit={handleSave}>
                                <div className="mb-4">
                                    <label className="form-label text-uppercase small ls-1">Título del Reporte</label>
                                    <input
                                        type="text"
                                        className="form-control form-control-lg"
                                        value={config.titulo}
                                        onChange={e => setConfig({ ...config, titulo: e.target.value })}
                                        disabled={!isEditing}
                                        style={{ fontWeight: '500' }}
                                    />
                                </div>

                                <div className="row g-3">
                                    <div className="col-md-4">
                                        <label className="form-label text-uppercase small ls-1">Código</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            value={config.codigo}
                                            onChange={e => setConfig({ ...config, codigo: e.target.value })}
                                            disabled={!isEditing}
                                        />
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label text-uppercase small ls-1">Edición</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            value={config.edicion}
                                            onChange={e => setConfig({ ...config, edicion: e.target.value })}
                                            disabled={!isEditing}
                                        />
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label text-uppercase small ls-1">Aprobado Por</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            value={config.aprobado_por}
                                            onChange={e => setConfig({ ...config, aprobado_por: e.target.value })}
                                            disabled={!isEditing}
                                        />
                                    </div>
                                </div>

                                <div className="mt-5 d-flex justify-content-end gap-3 pt-4 border-top">
                                    {!isEditing ? (
                                        <button
                                            type="button"
                                            className="btn btn-primary px-5 py-2 shadow-sm"
                                            style={{ backgroundColor: 'var(--primary-600)' }}
                                            onClick={(e) => { e.preventDefault(); setIsEditing(true); }}
                                        >
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="me-2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                            HABILITAR EDICIÓN
                                        </button>
                                    ) : (
                                        <>
                                            <button type="button" className="btn btn-outline-secondary px-4" onClick={handleCancelEdit}>
                                                Cancelar
                                            </button>
                                            <button type="submit" className="btn btn-success px-5 py-2 shadow-sm fw-bold" disabled={saving}>
                                                {saving ? 'Guardando...' : 'GUARDAR CAMBIOS'}
                                            </button>
                                        </>
                                    )}
                                </div>
                            </form>
                        </div>
                    </div>

                    {/* Vista Previa */}
                    <div className="card shadow-sm border-0 overflow-hidden">
                        <div className="bg-light py-3 px-4 border-bottom d-flex align-items-center">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-secondary me-2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                            <h6 className="mb-0 fw-bold text-secondary text-uppercase small">Vista Previa Real del Documento</h6>
                        </div>
                        <div className="card-body p-4 p-md-5 bg-secondary bg-opacity-10 d-flex justify-content-center">
                            <div className="document-sheet shadow-lg">
                                <div className="pdf-header-wrapper">
                                    <div className="header-cell logo-cell">
                                        <img
                                            src="/logo.png"
                                            alt="Logo"
                                            className="header-logo"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).style.display = 'none';
                                                (e.target as HTMLImageElement).nextElementSibling?.classList.remove('d-none');
                                            }}
                                        />
                                        <div className="logo-placeholder d-none">LOGO</div>
                                    </div>

                                    <div className="header-cell title-cell">
                                        <div className="header-title">{config.titulo || 'SIN TÍTULO'}</div>
                                    </div>

                                    <div className="header-cell info-cell">
                                        <div className="info-row">{config.codigo || 'CÓDIGO'}</div>
                                        <div className="info-row">{config.edicion || 'EDICIÓN'}</div>
                                        <div className="info-row last">{config.aprobado_por || 'APROBACIÓN'}</div>
                                    </div>
                                </div>
                                <div className="mt-4 opacity-50">
                                    <div style={{ height: '10px', background: '#e9ecef', width: '30%', marginBottom: '10px' }}></div>
                                    <div style={{ height: '5px', background: '#f1f3f5', width: '100%', marginBottom: '5px' }}></div>
                                    <div style={{ height: '5px', background: '#f1f3f5', width: '90%', marginBottom: '5px' }}></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .document-sheet {
                    background: white;
                    width: 100%;
                    max-width: 650px;
                    padding: 30px;
                    border: 1px solid #dee2e6;
                }

                .ls-1 { letter-spacing: 0.5px; }

                .pdf-header-wrapper {
                    border: 2px solid black;
                    height: 80px;
                    display: flex;
                    width: 100%;
                }

                .header-cell {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-right: 1px solid black;
                }

                .logo-cell {
                    width: 25%;
                    padding: 5px;
                }

                .header-logo {
                    max-height: 100%;
                    max-width: 100%;
                    object-fit: contain;
                }

                .logo-placeholder {
                    font-size: 10px;
                    color: #999;
                    font-weight: bold;
                }

                .title-cell {
                    width: 55%;
                    padding: 5px;
                }

                .header-title {
                    font-size: 0.9rem;
                    font-weight: bold;
                    text-transform: uppercase;
                    text-align: center;
                    font-family: Arial, sans-serif;
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
                    border-bottom: 1px solid black;
                    font-size: 0.7rem;
                    font-weight: bold;
                    font-family: Arial, sans-serif;
                }

                .info-row.last {
                    border-bottom: none;
                }

                @media (max-width: 768px) {
                    .document-sheet {
                        padding: 15px;
                    }
                    .pdf-header-wrapper {
                        height: 60px;
                    }
                    .header-title { font-size: 0.7rem; }
                    .info-row { font-size: 0.6rem; }
                }
            `}</style>
        </>
    );
}
