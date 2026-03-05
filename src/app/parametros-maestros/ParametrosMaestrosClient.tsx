'use client';

import { useState, useEffect, useRef } from 'react';
import LoadingOverlay from '@/components/LoadingOverlay';
import { useRouter } from 'next/navigation';

import { createClient } from '@/lib/supabase/client';
import type { ParametroMaestro } from '@/lib/supabase/types';

/**
 * ParametrosMaestrosClient
 * 
 * Gestión centralizada de parámetros maestros.
 * Se eliminó la sección de parámetros locales/estandarización para forzar
 * el uso exclusivo del catálogo maestro desde la creación del producto.
 */
export default function ParametrosMaestrosClient() {
    const router = useRouter();
    const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
    const [mounted, setMounted] = useState(false);

    const [parametros, setParametros] = useState<ParametroMaestro[]>([]);
    const [loading, setLoading] = useState(true);
    const [userName, setUserName] = useState('');
    const [userRole, setUserRole] = useState<'administrador' | 'trabajador'>('trabajador');

    // Modal states
    const [showModal, setShowModal] = useState(false);
    const [editingParam, setEditingParam] = useState<ParametroMaestro | null>(null);
    const [formData, setFormData] = useState({ nombre: '', tipo: 'texto' as 'texto' | 'numero' | 'rango' });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // Pagination & Search states
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8;

    // Initialize on mount only
    useEffect(() => {
        setMounted(true);
        supabaseRef.current = createClient();
    }, []);

    useEffect(() => {
        if (mounted && supabaseRef.current) {
            checkAuth();
            loadParametros();
        }
    }, [mounted]);

    const checkAuth = async () => {
        try {
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
        } catch {
            router.push('/');
        }
    };

    const loadParametros = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/parametros-maestros');
            if (!response.ok) throw new Error('Error al cargar parámetros');
            const data = await response.json();
            setParametros(data || []);
        } catch (err) {
            console.error('Error loading parametros:', err);
        } finally {
            setLoading(false);
        }
    };

    const openNewModal = () => {
        setEditingParam(null);
        setFormData({ nombre: '', tipo: 'texto' });
        setError('');
        setShowModal(true);
    };

    const openEditModal = (param: ParametroMaestro) => {
        setEditingParam(param);
        setFormData({ nombre: param.nombre, tipo: param.tipo });
        setError('');
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!formData.nombre.trim()) {
            setError('El nombre es requerido');
            return;
        }

        setSaving(true);
        setError('');

        try {
            const method = editingParam ? 'PUT' : 'POST';
            const body = editingParam
                ? { id: editingParam.id, nombre: formData.nombre, tipo: formData.tipo }
                : { nombre: formData.nombre, tipo: formData.tipo };

            const response = await fetch('/api/parametros-maestros', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Error al guardar');
            }

            setShowModal(false);
            loadParametros();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al guardar');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('¿Está seguro de eliminar este parámetro maestro?')) return;

        try {
            const response = await fetch('/api/parametros-maestros', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Error al eliminar');
            }

            loadParametros();
        } catch (err) {
            console.error('Error deleting:', err);
            alert('No se puede eliminar (posiblemente esté en uso)');
        }
    };

    const filteredParametros = parametros.filter((p) =>
        p.nombre.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Pagination logic
    const totalPages = Math.ceil(filteredParametros.length / itemsPerPage);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredParametros.slice(indexOfFirstItem, indexOfLastItem);

    // Reset page on search
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    const getTipoBadge = (tipo: string) => {
        const classes: Record<string, string> = {
            texto: 'badge-texto',
            numero: 'badge-numero',
            rango: 'badge-rango',
        };
        const labels: Record<string, string> = {
            texto: 'Texto Libre',
            numero: 'Numérico',
            rango: 'Rango Mín/Máx',
        };
        return {
            className: classes[tipo] || 'badge-texto',
            label: labels[tipo] || tipo.toUpperCase()
        };
    };

    if (loading) {
        return <LoadingOverlay message="Cargando Parámetros..." />;
    }

    return (
        <div className="page-wrapper">
            <main className="main-content">
                {/* Header Premium */}
                <div className="header-container shadow-sm border">
                    <div className="header-info">
                        <div className="badge-system"><span className="dot-pulse"></span>CONFIGURACIÓN</div>
                        <h1 className="title">Parámetros Maestros</h1>
                        <p className="subtitle">Defina los parámetros base que se pueden usar en productos.</p>
                    </div>
                    <div className="header-stats">
                        <div className="stat-pill">
                            <span className="val">{parametros.length}</span>
                            <span className="lab">TOTAL</span>
                        </div>
                        <button className="btn-add-premium shadow-sm" onClick={openNewModal}>
                            <i className="bi bi-plus-lg me-2"></i>
                            <span>Nuevo Parámetro</span>
                        </button>
                    </div>
                </div>

                <div className="table-container-card shadow-sm border">
                    <div className="toolbar-section border-bottom">
                        <div className="search-group">
                            <i className="bi bi-search"></i>
                            <input
                                type="text"
                                className="toolbar-input"
                                placeholder="Buscar parámetro maestro..."
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    setCurrentPage(1);
                                }}
                            />
                        </div>
                    </div>

                    <div className="table-responsive">
                        <table className="table-premium">
                            <thead>
                                <tr>
                                    <th style={{ width: '40%' }}>NOMBRE DEL PARÁMETRO</th>
                                    <th className="text-center" style={{ width: '25%' }}>TIPO DE DATO</th>
                                    <th className="text-center" style={{ width: '20%' }}>FECHA ALTA</th>
                                    <th className="text-end" style={{ width: '15%', paddingRight: '24px' }}>ACCIONES</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentItems.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="text-center py-5">
                                            <div className="empty-state-table">
                                                <i className="bi bi-search fs-1 mb-2"></i>
                                                <p>No se encontraron parámetros maestros</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    currentItems.map((param) => {
                                        const badge = getTipoBadge(param.tipo);
                                        return (
                                            <tr key={param.id} className="row-hover">
                                                <td>
                                                    <div className="param-info-cell">
                                                        <div className="param-avatar">
                                                            <i className="bi bi-gear-fill"></i>
                                                        </div>
                                                        <span className="param-name-txt">{param.nombre}</span>
                                                    </div>
                                                </td>
                                                <td className="text-center">
                                                    <span className={`type-badge ${badge.className}`}>
                                                        {badge.label}
                                                    </span>
                                                </td>
                                                <td className="text-center">
                                                    <span className="date-txt">{new Date(param.created_at).toLocaleDateString('es-PE')}</span>
                                                </td>
                                                <td className="text-end" style={{ paddingRight: '24px' }}>
                                                    <div className="d-flex justify-content-end gap-2">
                                                        <button
                                                            className="btn-action edit"
                                                            onClick={() => openEditModal(param)}
                                                            title="Editar"
                                                        >
                                                            <i className="bi bi-pencil-fill"></i>
                                                        </button>
                                                        <button
                                                            className="btn-action delete"
                                                            onClick={() => handleDelete(param.id)}
                                                            title="Eliminar"
                                                        >
                                                            <i className="bi bi-trash3-fill"></i>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Bar */}
                    {totalPages > 1 && (
                        <div className="pagination-bar border-top">
                            <span className="pagination-info">
                                Mostrando <b>{indexOfFirstItem + 1} - {Math.min(indexOfLastItem, filteredParametros.length)}</b> de {filteredParametros.length}
                            </span>
                            <div className="pagination-controls">
                                <button
                                    className="page-btn"
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(prev => prev - 1)}
                                >
                                    <i className="bi bi-chevron-left"></i>
                                </button>
                                {[...Array(totalPages)].map((_, i) => (
                                    <button
                                        key={i + 1}
                                        className={`page-btn ${currentPage === i + 1 ? 'active' : ''}`}
                                        onClick={() => setCurrentPage(i + 1)}
                                    >
                                        {i + 1}
                                    </button>
                                ))}
                                <button
                                    className="page-btn"
                                    disabled={currentPage === totalPages}
                                    onClick={() => setCurrentPage(prev => prev + 1)}
                                >
                                    <i className="bi bi-chevron-right"></i>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Premium Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content premium-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header-premium border-bottom shadow-sm">
                            <div className="d-flex flex-column">
                                <span className="text-uppercase small fw-bold text-muted mb-1" style={{ fontSize: '0.7rem', letterSpacing: '1px' }}>
                                    {editingParam ? 'Modificando Registro' : 'Definiendo Nuevo'}
                                </span>
                                <h3 className="mb-0 fw-bold text-dark" style={{ fontSize: '1.4rem' }}>
                                    {editingParam ? 'Editar Parámetro' : 'Nuevo Parámetro Maestro'}
                                </h3>
                            </div>
                            <button className="btn-close-custom" onClick={() => setShowModal(false)}>
                                <i className="bi bi-x-lg"></i>
                            </button>
                        </div>

                        <div className="modal-body-premium p-4">
                            <div className="form-group mb-4">
                                <label className="form-label fw-bold text-dark small text-uppercase">Nombre del Parámetro <span className="text-danger">*</span></label>
                                <input
                                    type="text"
                                    className="form-control form-control-lg border-0 bg-light fw-semibold"
                                    value={formData.nombre}
                                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                                    placeholder="Ej: Humedad Relativa"
                                    autoFocus
                                />
                                <div className="form-text mt-2 small text-muted">Use un nombre descriptivo (ej. Presión, Color, Temperatura).</div>
                            </div>

                            <div className="form-group">
                                <label className="form-label fw-bold text-dark small text-uppercase">Tipo de Evaluación <span className="text-danger">*</span></label>
                                <div className="row g-3">
                                    {(['texto', 'numero', 'rango'] as const).map((t) => (
                                        <div className="col-4" key={t}>
                                            <div
                                                className={`type-selector-card ${formData.tipo === t ? 'active' : ''}`}
                                                onClick={() => setFormData({ ...formData, tipo: t })}
                                            >
                                                <div className="type-icon">
                                                    {t === 'texto' && <i className="bi bi-fonts"></i>}
                                                    {t === 'numero' && <i className="bi bi-123"></i>}
                                                    {t === 'rango' && <i className="bi bi-arrows-expand"></i>}
                                                </div>
                                                <span className="type-label">{t.charAt(0).toUpperCase() + t.slice(1)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {error && (
                                <div className="alert alert-danger mt-4 d-flex align-items-center gap-2 border-0 bg-danger bg-opacity-10 text-danger rounded-3">
                                    <i className="bi bi-exclamation-triangle-fill"></i>
                                    <span className="small fw-semibold">{error}</span>
                                </div>
                            )}
                        </div>

                        <div className="modal-footer-premium p-3 border-top bg-light d-flex justify-content-end gap-2">
                            <button className="btn btn-link text-decoration-none text-secondary fw-bold px-4" onClick={() => setShowModal(false)}>
                                Cancelar
                            </button>
                            <button
                                className="btn btn-primary fw-bold px-5 rounded-pill shadow-sm"
                                onClick={handleSave}
                                disabled={saving}
                                style={{ background: 'linear-gradient(135deg, #0d6efd 0%, #0a58ca 100%)', border: 'none' }}
                            >
                                {saving ? (
                                    <><span className="spinner-border spinner-border-sm me-2"></span>Guardando...</>
                                ) : 'Guardar Parámetro'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .page-wrapper {
                    min-height: 100vh;
                    background-color: #f8fafc;
                }
                .main-content {
                    max-width: 1000px;
                    margin: 0 auto;
                    padding: 40px 20px;
                }
                .header-container {
                    background: white;
                    border-radius: 24px;
                    padding: 25px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 24px;
                }
                .badge-system {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    color: #2563eb;
                    font-weight: 800;
                    font-size: 0.7rem;
                    margin-bottom: 10px;
                }
                .dot-pulse {
                    width: 8px;
                    height: 8px;
                    background: #2563eb;
                    border-radius: 50%;
                    animation: pulse-dot 2s infinite;
                }
                @keyframes pulse-dot {
                    0% { box-shadow: 0 0 0 0 rgba(3,105,161,0.4); }
                    70% { box-shadow: 0 0 0 6px rgba(3,105,161,0); }
                    100% { box-shadow: 0 0 0 0 rgba(3,105,161,0); }
                }
                .title { font-size: 1.6rem; font-weight: 900; color: #1e293b; margin: 0; }
                .subtitle { color: #64748b; font-size: 0.9rem; margin: 5px 0 0 0; }
                .header-stats { display: flex; gap: 15px; align-items: center; }
                .stat-pill {
                    background: #f8fafc;
                    padding: 8px 15px;
                    border-radius: 12px;
                    border: 1px solid #e2e8f0;
                    display: flex;
                    flex-direction: column;
                    text-align: center;
                }
                .stat-pill .val { font-weight: 900; font-size: 1.2rem; line-height: 1; color: #1e293b; }
                .stat-pill .lab { font-size: 0.6rem; font-weight: 800; color: #94a3b8; }
                .btn-add-premium {
                    background: #10b981;
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 14px;
                    font-weight: 800;
                    font-size: 0.85rem;
                    display: flex;
                    align-items: center;
                    transition: all 0.2s;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    cursor: pointer;
                }
                .btn-add-premium:hover {
                    transform: translateY(-2px);
                    background: #059669;
                    box-shadow: 0 10px 15px -3px rgba(16, 185, 129, 0.3);
                }
                .toolbar-section {
                    background: white;
                    border-radius: 16px;
                    padding: 14px 24px;
                    display: flex;
                    align-items: center;
                }
                .search-group {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    gap: 14px;
                    color: #94a3b8;
                }
                .toolbar-input {
                    border: none;
                    outline: none;
                    width: 100%;
                    font-size: 0.95rem;
                    color: #1e293b;
                    font-weight: 500;
                    background: transparent;
                }
                .table-container-card {
                    background: white;
                    border-radius: 20px;
                    overflow: hidden;
                }
                .table-premium {
                    width: 100%;
                    border-collapse: separate;
                    border-spacing: 0;
                }
                .table-premium thead th {
                    background: #f8fafc;
                    padding: 18px 24px;
                    font-size: 0.75rem;
                    font-weight: 800;
                    color: #64748b;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    border-bottom: 1px solid #e2e8f0;
                }
                .table-premium tbody td {
                    padding: 16px 24px;
                    border-bottom: 1px solid #f1f5f9;
                    vertical-align: middle;
                }
                .row-hover:hover { background: #f8fafc; }
                .param-info-cell { display: flex; align-items: center; gap: 16px; }
                .param-avatar {
                    width: 36px;
                    height: 36px;
                    background: #f1f5f9;
                    color: #64748b;
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.1rem;
                }
                .param-name-txt { font-weight: 700; color: #1e293b; font-size: 0.95rem; }
                .date-txt { font-size: 0.85rem; color: #64748b; font-weight: 500; }
                .type-badge {
                    padding: 5px 14px;
                    border-radius: 20px;
                    font-size: 0.75rem;
                    font-weight: 800;
                    text-transform: uppercase;
                    display: inline-block;
                }
                .badge-texto { background: #f1f5f9; color: #475569; }
                .badge-numero { background: #e0f2fe; color: #0369a1; }
                .badge-rango { background: #dcfce7; color: #15803d; }
                .btn-action {
                    width: 36px;
                    height: 36px;
                    border-radius: 10px;
                    border: none;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .btn-action.edit { background: #f1f5f9; color: #64748b; }
                .btn-action.edit:hover { background: #e0f2fe; color: #0284c7; }
                .btn-action.delete { background: #f1f5f9; color: #64748b; }
                .btn-action.delete:hover { background: #fee2e2; color: #ef4444; }
                .pagination-bar {
                    padding: 16px 24px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: #f8fafc;
                }
                .pagination-info { font-size: 0.85rem; color: #64748b; }
                .pagination-controls { display: flex; gap: 6px; }
                .page-btn {
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 8px;
                    border: 1px solid #e2e8f0;
                    background: white;
                    font-size: 0.85rem;
                    font-weight: 600;
                    cursor: pointer;
                }
                .page-btn.active { background: #3b82f6; color: white; border-color: #3b82f6; }
                .page-btn:disabled { opacity: 0.5; cursor: not-allowed; }
                .modal-overlay {
                    position: fixed; inset: 0;
                    background: rgba(15, 23, 42, 0.5);
                    display: flex; align-items: center; justify-content: center;
                    z-index: 1000; padding: 20px;
                    backdrop-filter: blur(4px);
                }
                .modal-content.premium-modal {
                    background: white; border-radius: 20px;
                    width: 100%; max-width: 500px;
                    overflow: hidden;
                    box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
                }
                .modal-header-premium { padding: 24px; display: flex; justify-content: space-between; align-items: center; }
                .btn-close-custom { background: none; border: none; color: #94a3b8; font-size: 1.2rem; cursor: pointer; }
                .type-selector-card {
                    border: 2px solid #f1f5f9;
                    border-radius: 14px;
                    padding: 16px 10px;
                    text-align: center;
                    cursor: pointer;
                    transition: all 0.2s;
                    display: flex; flex-direction: column; gap: 8px;
                }
                .type-selector-card:hover { border-color: #3b82f6; background: #eff6ff; }
                .type-selector-card.active { border-color: #3b82f6; background: #3b82f6; color: white; }
                .type-icon { font-size: 1.5rem; }
                .type-label { font-size: 0.75rem; font-weight: 800; text-transform: uppercase; }

                @media (max-width: 768px) {
                    .header-container { flex-direction: column; text-align: center; gap: 20px; }
                    .header-info { text-align: center; }
                    .header-stats { width: 100%; flex-direction: column; }
                    .stat-pill { width: 100%; }
                    .btn-add-premium { width: 100%; justify-content: center; }
                }
            `}</style>
        </div>
    );
}
