'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { createClient } from '@/lib/supabase/client';
import type { ParametroMaestro } from '@/lib/supabase/types';

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

    const getSupabase = () => {
        if (!supabaseRef.current) {
            supabaseRef.current = createClient();
        }
        return supabaseRef.current;
    };

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

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/');
    };

    const getTipoBadge = (tipo: string) => {
        const classes: Record<string, string> = {
            texto: 'badge-secondary',
            numero: 'badge-info',
            rango: 'badge-success',
        };
        return classes[tipo] || 'badge-secondary';
    };

    if (loading) {
        return (
            <>
                <Navbar userName={userName} userRole={userRole} onLogout={handleLogout} />
                <div className="container mt-4">
                    <div className="text-center">
                        <div className="spinner"></div>
                        <p>Cargando...</p>
                    </div>
                </div>
            </>
        );
    }

    return (
        <div className="page-wrapper">
            <Navbar userName={userName} userRole={userRole} onLogout={handleLogout} />

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
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" style={{ marginRight: '8px' }}>
                                <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z" />
                            </svg>
                            <span>Agregar Parámetro</span>
                        </button>
                    </div>
                </div>

                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Nombre</th>
                                <th>Tipo</th>
                                <th>Fecha Creación</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {parametros.map((param) => (
                                <tr key={param.id}>
                                    <td>{param.nombre}</td>
                                    <td>
                                        <span className={`badge ${getTipoBadge(param.tipo)}`}>
                                            {param.tipo.toUpperCase()}
                                        </span>
                                    </td>
                                    <td>{new Date(param.created_at).toLocaleDateString('es-PE')}</td>
                                    <td>
                                        <div className="btn-group">
                                            <button
                                                className="btn btn-primary btn-sm"
                                                onClick={() => openEditModal(param)}
                                            >
                                                Editar
                                            </button>
                                            <button
                                                className="btn btn-danger btn-sm"
                                                onClick={() => handleDelete(param.id)}
                                            >
                                                Eliminar
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </main>

            {/* Modal */}
            {
                showModal && (
                    <div className="modal-overlay" onClick={() => setShowModal(false)}>
                        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h3>{editingParam ? 'Editar Parámetro' : 'Nuevo Parámetro'}</h3>
                                <button className="close-btn" onClick={() => setShowModal(false)}>×</button>
                            </div>

                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Nombre *</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        value={formData.nombre}
                                        onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                                        placeholder="Nombre del parámetro"
                                    />
                                </div>

                                <div className="form-group mt-3">
                                    <label className="form-label">Tipo *</label>
                                    <select
                                        className="form-select"
                                        value={formData.tipo}
                                        onChange={(e) => setFormData({ ...formData, tipo: e.target.value as 'texto' | 'numero' | 'rango' })}
                                    >
                                        <option value="texto">Texto</option>
                                        <option value="numero">Número</option>
                                        <option value="rango">Rango</option>
                                    </select>
                                </div>

                                {error && <div className="alert alert-danger mt-3">{error}</div>}
                            </div>

                            <div className="modal-footer">
                                <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                                    Cancelar
                                </button>
                                <button className="btn btn-success" onClick={handleSave} disabled={saving}>
                                    {saving ? 'Guardando...' : 'Guardar'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            <style jsx>{`
        /* Page Layout */
        .page-wrapper {
            min-height: 100vh;
            background-color: #f0f2f5;
            font-family: 'Inter', system-ui, sans-serif;
        }
        .main-content {
            max-width: 1100px;
            margin: 0 auto;
            padding: 40px 20px;
        }

        /* Header Premium */
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
            color: #0369a1;
            font-weight: 800;
            font-size: 0.7rem;
            margin-bottom: 10px;
        }
        .dot-pulse {
            width: 8px;
            height: 8px;
            background: #0369a1;
            border-radius: 50%;
            animation: pulse-dot 2s infinite;
        }
        @keyframes pulse-dot {
            0% { box-shadow: 0 0 0 0 rgba(3,105,161,0.4); }
            70% { box-shadow: 0 0 0 6px rgba(3,105,161,0); }
            100% { box-shadow: 0 0 0 0 rgba(3,105,161,0); }
        }
        .title {
            font-size: 1.6rem;
            font-weight: 900;
            color: #1e293b;
            margin: 0;
        }
        .subtitle {
            color: #64748b;
            font-size: 0.9rem;
            margin: 5px 0 0 0;
        }
        .header-stats {
            display: flex;
            gap: 15px;
            align-items: center;
        }
        .stat-pill {
            background: #f8fafc;
            padding: 8px 15px;
            border-radius: 12px;
            border: 1px solid #e2e8f0;
            display: flex;
            flex-direction: column;
            text-align: center;
        }
        .stat-pill .val {
            font-weight: 900;
            font-size: 1.2rem;
            line-height: 1;
            color: #1e293b;
        }
        .stat-pill .lab {
            font-size: 0.6rem;
            font-weight: 800;
            color: #94a3b8;
        }
        .btn-add-premium {
            background: #10b981;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 14px;
            font-weight: 800;
            font-size: 0.85rem;
            display: flex;
            align-items: center;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            cursor: pointer;
        }
        .btn-add-premium:hover {
            transform: translateY(-2px);
            background: #059669;
            box-shadow: 0 10px 15px -3px rgba(16, 185, 129, 0.3);
        }

        @media (max-width: 768px) {
            .header-container {
                flex-direction: column;
                text-align: center;
                gap: 20px;
            }
            .header-stats {
                flex-direction: column;
                width: 100%;
            }
            .btn-add-premium {
                width: 100%;
                justify-content: center;
            }
        }

        .actions-bar {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 1.5rem;
        }

        .table-container {
          overflow-x: auto;
        }

        .btn-group {
          display: flex;
          gap: 0.5rem;
        }

        .btn-sm {
          padding: 0.25rem 0.75rem;
          font-size: 0.875rem;
        }

        .badge-secondary {
          background-color: #6c757d;
        }

        .badge-info {
          background-color: #17a2b8;
        }

        /* Modal Styles */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1rem;
        }

        .modal-content {
          background: white;
          border-radius: 0.5rem;
          width: 100%;
          max-width: 500px;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.5rem;
          border-bottom: 1px solid #dee2e6;
        }

        .modal-header h3 {
          margin: 0;
        }

        .close-btn {
          background: none;
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
          color: #6c757d;
        }

        .modal-body {
          padding: 1.5rem;
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 0.5rem;
          padding: 1rem 1.5rem;
          border-top: 1px solid #dee2e6;
        }
      `}</style>
        </div>
    );
}
