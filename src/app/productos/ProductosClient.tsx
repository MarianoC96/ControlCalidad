'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { createClient } from '@/lib/supabase/client';
import type { Producto, ParametroMaestro, Parametro } from '@/lib/supabase/types';

interface ParametroForm {
    parametro_maestro_id: number | null;
    nombre: string;
    tipo: 'texto' | 'numero' | 'rango';
    valor: string;
    rango_min: string;
    rango_max: string;
    unidad: string;
}

export default function ProductosClient() {
    const router = useRouter();
    const supabase = createClient();

    const [productos, setProductos] = useState<Producto[]>([]);
    const [parametrosMaestros, setParametrosMaestros] = useState<ParametroMaestro[]>([]);
    const [loading, setLoading] = useState(true);
    const [userName, setUserName] = useState('');
    const [userRole, setUserRole] = useState<'administrador' | 'trabajador'>('trabajador');
    const [searchTerm, setSearchTerm] = useState('');

    // Modal states
    const [showModal, setShowModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Producto | null>(null);
    const [productName, setProductName] = useState('');
    const [parametrosForm, setParametrosForm] = useState<ParametroForm[]>([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        checkAuth();
        loadData();
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

    const loadData = async () => {
        try {
            const [productosRes, maestrosRes] = await Promise.all([
                fetch('/api/productos'),
                fetch('/api/parametros-maestros'),
            ]);

            if (!productosRes.ok) throw new Error('Error loading productos');
            if (!maestrosRes.ok) throw new Error('Error loading maestros');

            const productos = await productosRes.json();
            const maestros = await maestrosRes.json();

            setProductos(productos || []);
            setParametrosMaestros(maestros || []);
        } catch (err) {
            console.error('Error loading data:', err);
        } finally {
            setLoading(false);
        }
    };

    const openNewModal = () => {
        setEditingProduct(null);
        setProductName('');
        setParametrosForm([createEmptyParametro()]);
        setError('');
        setShowModal(true);
    };

    const openEditModal = async (producto: Producto) => {
        setEditingProduct(producto);
        setProductName(producto.nombre);
        setError('');

        // Load product parameters from API
        try {
            const res = await fetch(`/api/productos?id=${producto.id}`);
            if (res.ok) {
                const productWithParams = await res.json();
                const params = productWithParams.parametros;

                if (params && params.length > 0) {
                    setParametrosForm(params.map((p: Parametro) => ({
                        parametro_maestro_id: p.parametro_maestro_id,
                        nombre: p.nombre,
                        tipo: p.tipo,
                        valor: p.valor || '',
                        rango_min: p.rango_min?.toString() || '',
                        rango_max: p.rango_max?.toString() || '',
                        unidad: p.unidad || '',
                    })));
                } else {
                    setParametrosForm([createEmptyParametro()]);
                }
            }
        } catch (err) {
            console.error('Error fetching details', err);
            setParametrosForm([createEmptyParametro()]);
        }

        setShowModal(true);
    };

    const createEmptyParametro = (): ParametroForm => ({
        parametro_maestro_id: null,
        nombre: '',
        tipo: 'texto',
        valor: '',
        rango_min: '',
        rango_max: '',
        unidad: '',
    });

    const addParametro = () => {
        setParametrosForm([...parametrosForm, createEmptyParametro()]);
    };

    const removeParametro = (index: number) => {
        if (parametrosForm.length > 1) {
            setParametrosForm(parametrosForm.filter((_, i) => i !== index));
        }
    };

    const handleParametroChange = (index: number, field: keyof ParametroForm, value: string | number | null) => {
        setParametrosForm((prev) => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };

            // If selecting a master parameter, update name and type
            if (field === 'parametro_maestro_id' && value) {
                const maestro = parametrosMaestros.find((m) => m.id === value);
                if (maestro) {
                    updated[index].nombre = maestro.nombre;
                    updated[index].tipo = maestro.tipo;
                }
            }

            return updated;
        });
    };

    const handleSave = async () => {
        if (!productName.trim()) {
            setError('El nombre del producto es requerido');
            return;
        }

        setSaving(true);
        setError('');

        try {
            // Prepare payload
            const parametros = parametrosForm
                .filter((p) => p.nombre.trim())
                .map((p) => ({
                    parametro_maestro_id: p.parametro_maestro_id,
                    nombre: p.nombre,
                    tipo: p.tipo,
                    valor: p.tipo === 'texto' ? p.valor : null,
                    rango_min: p.tipo === 'rango' ? parseFloat(p.rango_min) || null : null,
                    rango_max: p.tipo === 'rango' ? parseFloat(p.rango_max) || null : null,
                    unidad: p.unidad || null,
                    // Legacy field support if needed by API logic
                    valor_texto: p.tipo === 'texto' ? p.valor : null,
                    es_rango: p.tipo === 'rango'
                }));

            const method = editingProduct ? 'PUT' : 'POST';
            const body = {
                id: editingProduct ? editingProduct.id : undefined,
                nombre: productName,
                parametros
            };

            const response = await fetch('/api/productos', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Error al guardar');
            }

            setShowModal(false);
            loadData();

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al guardar');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('¿Está seguro de eliminar este producto?')) return;

        try {
            const response = await fetch('/api/productos', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Error al eliminar');
            }

            loadData();
        } catch (err) {
            console.error('Error deleting product:', err);
            alert('No se puede eliminar (es posible que tenga registros asociados)');
        }
    };

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/');
    };

    const filteredProducts = productos.filter((p) =>
        p.nombre.toLowerCase().includes(searchTerm.toLowerCase())
    );

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
                <h2 className="text-center mb-4">Gestión de Productos</h2>

                <div className="actions-bar">
                    <input
                        type="text"
                        className="form-control search-input"
                        placeholder="Buscar producto..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <button className="btn btn-success" onClick={openNewModal}>
                        + Agregar Producto
                    </button>
                </div>

                {filteredProducts.length === 0 ? (
                    <div className="empty-state">
                        <p>No se encontraron productos</p>
                    </div>
                ) : (
                    <div className="products-grid">
                        {filteredProducts.map((producto) => (
                            <div key={producto.id} className="card product-card">
                                <div className="card-body">
                                    <h3>{producto.nombre}</h3>
                                    <div className="card-actions">
                                        <button
                                            className="btn btn-primary btn-sm"
                                            onClick={() => openEditModal(producto)}
                                        >
                                            Editar
                                        </button>
                                        <button
                                            className="btn btn-danger btn-sm"
                                            onClick={() => handleDelete(producto.id)}
                                        >
                                            Eliminar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{editingProduct ? 'Editar Producto' : 'Nuevo Producto'}</h3>
                            <button className="close-btn" onClick={() => setShowModal(false)}>×</button>
                        </div>

                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Nombre del Producto *</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    value={productName}
                                    onChange={(e) => setProductName(e.target.value)}
                                    placeholder="Nombre del producto"
                                />
                            </div>

                            <h4 className="mt-4">Parámetros</h4>

                            {parametrosForm.map((param, index) => (
                                <div key={index} className="parametro-row">
                                    <div className="param-grid">
                                        <div className="form-group">
                                            <label className="form-label small">Parámetro Maestro</label>
                                            <select
                                                className="form-select"
                                                value={param.parametro_maestro_id || ''}
                                                onChange={(e) =>
                                                    handleParametroChange(index, 'parametro_maestro_id',
                                                        e.target.value ? parseInt(e.target.value) : null)
                                                }
                                            >
                                                <option value="">Seleccionar...</option>
                                                {parametrosMaestros.map((m) => (
                                                    <option key={m.id} value={m.id}>{m.nombre}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="form-group">
                                            <label className="form-label small">Tipo</label>
                                            <select
                                                className="form-select"
                                                value={param.tipo}
                                                onChange={(e) =>
                                                    handleParametroChange(index, 'tipo', e.target.value as 'texto' | 'numero' | 'rango')
                                                }
                                            >
                                                <option value="texto">Texto</option>
                                                <option value="numero">Número</option>
                                                <option value="rango">Rango</option>
                                            </select>
                                        </div>

                                        {param.tipo === 'texto' && (
                                            <div className="form-group">
                                                <label className="form-label small">Valor Esperado</label>
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    value={param.valor}
                                                    onChange={(e) => handleParametroChange(index, 'valor', e.target.value)}
                                                    placeholder="Valor esperado"
                                                />
                                            </div>
                                        )}

                                        {param.tipo === 'rango' && (
                                            <>
                                                <div className="form-group">
                                                    <label className="form-label small">Mínimo</label>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        className="form-control"
                                                        value={param.rango_min}
                                                        onChange={(e) => handleParametroChange(index, 'rango_min', e.target.value)}
                                                        placeholder="Mín"
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label className="form-label small">Máximo</label>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        className="form-control"
                                                        value={param.rango_max}
                                                        onChange={(e) => handleParametroChange(index, 'rango_max', e.target.value)}
                                                        placeholder="Máx"
                                                    />
                                                </div>
                                            </>
                                        )}

                                        <div className="form-group">
                                            <label className="form-label small">Unidad</label>
                                            <input
                                                type="text"
                                                className="form-control"
                                                value={param.unidad}
                                                onChange={(e) => handleParametroChange(index, 'unidad', e.target.value)}
                                                placeholder="Unidad"
                                            />
                                        </div>

                                        <button
                                            type="button"
                                            className="btn btn-danger btn-sm remove-btn"
                                            onClick={() => removeParametro(index)}
                                        >
                                            ×
                                        </button>
                                    </div>
                                </div>
                            ))}

                            <button
                                type="button"
                                className="btn btn-secondary mt-2"
                                onClick={addParametro}
                            >
                                + Agregar Parámetro
                            </button>

                            {error && <div className="alert alert-danger mt-3">{error}</div>}
                        </div>

                        <div className="modal-footer">
                            <button
                                className="btn btn-secondary"
                                onClick={() => setShowModal(false)}
                            >
                                Cancelar
                            </button>
                            <button
                                className="btn btn-success"
                                onClick={handleSave}
                                disabled={saving}
                            >
                                {saving ? 'Guardando...' : 'Guardar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
        .actions-bar {
          display: flex;
          gap: 1rem;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
        }

        .search-input {
          flex: 1;
          min-width: 200px;
          max-width: 400px;
        }

        .empty-state {
          text-align: center;
          padding: 3rem;
          color: #6c757d;
        }

        .products-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 1rem;
        }

        .product-card {
          padding: 1rem;
        }

        .product-card h3 {
          font-size: 1.1rem;
          margin: 0 0 1rem 0;
          color: #333;
        }

        .card-actions {
          display: flex;
          gap: 0.5rem;
        }

        .btn-sm {
          padding: 0.25rem 0.75rem;
          font-size: 0.875rem;
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
          max-width: 900px;
          max-height: 90vh;
          overflow-y: auto;
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

        .param-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)) auto;
          gap: 0.5rem;
          align-items: end;
        }

        .form-label.small {
          font-size: 0.75rem;
          margin-bottom: 0.25rem;
        }

        .remove-btn {
          width: 32px;
          height: 32px;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        @media (max-width: 768px) {
          .param-grid {
            grid-template-columns: 1fr;
          }

          .remove-btn {
            width: 100%;
            height: auto;
            padding: 0.25rem;
          }
        }
      `}</style>
        </>
    );
}
