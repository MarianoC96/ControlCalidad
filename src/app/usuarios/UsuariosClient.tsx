'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { createClient } from '@/lib/supabase/client';
import type { Usuario } from '@/lib/supabase/types';

export default function UsuariosClient() {
    const router = useRouter();
    const supabase = createClient();

    const [usuarios, setUsuarios] = useState<Usuario[]>([]);
    const [loading, setLoading] = useState(true);
    const [userName, setUserName] = useState('');
    const [userRole, setUserRole] = useState<'administrador' | 'trabajador'>('trabajador');

    // Modal states
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState<Usuario | null>(null);
    const [formData, setFormData] = useState({
        nombre_completo: '',
        usuario: '',
        email: '',
        password: '',
        roles: 'trabajador' as 'administrador' | 'trabajador',
        activo: true,
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        checkAuth();
        loadUsuarios();
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

    const loadUsuarios = async () => {
        try {
            // Usar la API segura en lugar de cliente directo para saltar RLS
            const response = await fetch('/api/usuarios');
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const errorMessage = errorData.error || `Error ${response.status}: ${response.statusText}`;

                if (response.status === 403) {
                    setError(`Acceso denegado: No tienes permisos de administrador. (${errorMessage})`);
                    return;
                }
                throw new Error(errorMessage);
            }
            const data = await response.json();
            // Verificar si data es un array
            if (Array.isArray(data)) {
                if (data.length === 0) {
                    setError('La lista de usuarios está vacía.');
                }
                setUsuarios(data);
            } else {
                console.error('Data received is not an array:', data);
                setError('Error: Formato de datos incorrecto recibido del servidor.');
            }
        } catch (err) {
            console.error('Error loading usuarios:', err);
            setError(err instanceof Error ? err.message : 'Error al cargar la lista de usuarios');
        } finally {
            setLoading(false);
        }
    };

    const openNewModal = () => {
        setEditingUser(null);
        setFormData({
            nombre_completo: '',
            usuario: '',
            email: '',
            password: '',
            roles: 'trabajador',
            activo: true,
        });
        setError('');
        setShowModal(true);
    };

    const openEditModal = (user: Usuario) => {
        setEditingUser(user);
        setFormData({
            nombre_completo: user.nombre_completo,
            usuario: user.usuario,
            email: user.email || '',
            password: '',
            roles: user.roles,
            activo: user.activo,
        });
        setError('');
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!formData.nombre_completo.trim() || !formData.usuario.trim()) {
            setError('Nombre y usuario son requeridos');
            return;
        }

        if (!editingUser && !formData.password) {
            setError('La contraseña es requerida para nuevos usuarios');
            return;
        }

        setSaving(true);
        setError('');

        try {
            const response = await fetch('/api/usuarios', {
                method: editingUser ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: editingUser?.id,
                    ...formData,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Error al guardar');
            }

            setShowModal(false);
            loadUsuarios();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al guardar');
        } finally {
            setSaving(false);
        }
    };

    const toggleActive = async (user: Usuario) => {
        try {
            const response = await fetch('/api/usuarios', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: user.id,
                    activo: !user.activo,
                    nombre_completo: user.nombre_completo,
                    usuario: user.usuario,
                    email: user.email,
                    roles: user.roles
                }),
            });

            if (!response.ok) throw new Error('Error al actualizar estado');
            loadUsuarios();
        } catch (err) {
            console.error('Error toggling active:', err);
            alert('No se pudo cambiar el estado del usuario');
        }
    };

    const handleDelete = async (user: Usuario) => {
        if (!confirm('¿Estás seguro de que deseas eliminar este usuario?')) return;

        try {
            const response = await fetch('/api/usuarios', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: user.id,
                    is_deleted: true,
                    // Send other required fields just in case validation needs them, 
                    // though usually partial updates should be fine if logic allows.
                    // Based on my previous PUT logic, it updates distinct fields.
                    nombre_completo: user.nombre_completo,
                    usuario: user.usuario,
                    email: user.email,
                    roles: user.roles,
                    activo: user.activo
                }),
            });

            if (!response.ok) throw new Error('Error al eliminar usuario');
            loadUsuarios();
        } catch (err) {
            console.error('Error deleting user:', err);
            alert('No se pudo eliminar el usuario');
        }
    };

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/');
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
        <>
            <Navbar userName={userName} userRole={userRole} onLogout={handleLogout} />

            <div className="container mt-4">
                <h2 className="text-center mb-4">Gestión de Usuarios</h2>

                <div className="actions-bar">
                    <button className="btn btn-success" onClick={openNewModal}>
                        + Agregar Usuario
                    </button>
                </div>

                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th style={{ width: '20%' }}>Nombre</th>
                                <th style={{ width: '15%' }}>Usuario</th>
                                <th style={{ width: '25%' }}>Email</th>
                                <th style={{ width: '10%' }}>Rol</th>
                                <th style={{ width: '10%' }}>Estado</th>
                                <th style={{ width: '5%' }}>2FA</th>
                                <th style={{ width: '1%', whiteSpace: 'nowrap' }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {usuarios.map((user) => (
                                <tr key={user.id}>
                                    <td>{user.nombre_completo}</td>
                                    <td>{user.usuario}</td>
                                    <td>{user.email || '-'}</td>
                                    <td>
                                        <span className={`badge ${user.roles === 'administrador' ? 'badge-primary' : 'badge-secondary'}`}>
                                            {user.roles}
                                        </span>
                                    </td>
                                    <td>
                                        <span className={`badge ${user.activo ? 'badge-success' : 'badge-danger'}`}>
                                            {user.activo ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </td>
                                    <td>
                                        {user.two_factor_secret ? (
                                            <span className="badge badge-success">Habilitado</span>
                                        ) : (
                                            <span className="badge badge-secondary">No</span>
                                        )}
                                    </td>
                                    <td>
                                        <div className="btn-group">
                                            {user.usuario === 'admin' ? (
                                                <span className="badge badge-secondary" style={{ padding: '0.5rem' }}>Sistema</span>
                                            ) : (
                                                <>
                                                    <button
                                                        className="btn btn-primary btn-sm"
                                                        onClick={() => openEditModal(user)}
                                                    >
                                                        Editar
                                                    </button>
                                                    <button
                                                        className={`btn btn-sm ${user.activo ? 'btn-warning' : 'btn-success'}`}
                                                        onClick={() => toggleActive(user)}
                                                    >
                                                        {user.activo ? 'Desactivar' : 'Activar'}
                                                    </button>
                                                    <button
                                                        className="btn btn-danger btn-sm"
                                                        onClick={() => handleDelete(user)}
                                                    >
                                                        Eliminar
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>
                            <button className="close-btn" onClick={() => setShowModal(false)}>×</button>
                        </div>

                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Nombre Completo *</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    value={formData.nombre_completo}
                                    onChange={(e) => setFormData({ ...formData, nombre_completo: e.target.value })}
                                />
                            </div>

                            <div className="form-group mt-3">
                                <label className="form-label">Usuario *</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    value={formData.usuario}
                                    onChange={(e) => setFormData({ ...formData, usuario: e.target.value })}
                                />
                            </div>

                            <div className="form-group mt-3">
                                <label className="form-label">Email</label>
                                <input
                                    type="email"
                                    className="form-control"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>

                            <div className="form-group mt-3">
                                <label className="form-label">
                                    Contraseña {editingUser ? '(dejar vacío para mantener)' : '*'}
                                </label>
                                <input
                                    type="password"
                                    className="form-control"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                />
                            </div>

                            <div className="form-group mt-3">
                                <label className="form-label">Rol *</label>
                                <select
                                    className="form-select"
                                    value={formData.roles}
                                    onChange={(e) => setFormData({ ...formData, roles: e.target.value as 'administrador' | 'trabajador' })}
                                >
                                    <option value="trabajador">Trabajador</option>
                                    <option value="administrador">Administrador</option>
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
            )}

            <style jsx>{`
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

        .badge-primary {
          background-color: #607d8b;
        }

        .badge-secondary {
          background-color: #6c757d;
        }

        .badge-warning {
          background-color: #ffc107;
          color: #212529;
        }

        .btn-warning {
          background-color: #ffc107;
          color: #212529;
        }

        .btn-warning:hover {
          background-color: #e0a800;
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
        </>
    );
}
