'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { createClient } from '@/lib/supabase/client';
import { normalizeString } from '@/lib/utils';
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
                        tipo: p.tipo || (p.es_rango ? 'rango' : 'texto'),
                        valor: p.valor || p.valor_texto || '',
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

            // Prevent negative values
            if ((field === 'rango_min' || field === 'rango_max' || (field === 'valor' && updated[index].tipo === 'numero')) && value && typeof value === 'string') {
                const num = parseFloat(value);
                if (!isNaN(num) && num < 0) {
                    value = Math.abs(num).toString();
                }
            }

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
        normalizeString(p.nombre).includes(normalizeString(searchTerm))
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
        <div className="page-wrapper">
            <Navbar userName={userName} userRole={userRole} onLogout={handleLogout} />

            <main className="main-content">
                {/* Header Premium */}
                <div className="header-container shadow-sm border">
                    <div className="header-info">
                        <div className="badge-system"><span className="dot-pulse"></span>GESTIÓN</div>
                        <h1 className="title">Productos</h1>
                        <p className="subtitle">Configure los productos y sus parámetros de control.</p>
                    </div>
                    <div className="header-stats">
                        <div className="stat-pill">
                            <span className="val">{productos.length}</span>
                            <span className="lab">TOTAL</span>
                        </div>
                        <button className="btn-add-premium shadow-sm" onClick={openNewModal}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" style={{ marginRight: '8px' }}>
                                <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z" />
                            </svg>
                            <span>Agregar Producto</span>
                        </button>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="search-bar shadow-sm border">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="search-icon" viewBox="0 0 16 16">
                        <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z" />
                    </svg>
                    <input
                        type="text"
                        className="search-input"
                        placeholder="Buscar producto..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
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
            </main>

            {/* Premium Modal */}
            {
                showModal && (
                    <div className="modal-overlay" onClick={() => setShowModal(false)}>
                        <div className="modal-content premium-modal" onClick={(e) => e.stopPropagation()}>
                            {/* Sticky Header */}
                            {/* Fixed Header */}
                            <div className="modal-header border-bottom shadow-sm d-flex align-items-center position-relative" style={{ flexShrink: 0, padding: '1.25rem 1.75rem', backgroundColor: '#f8fafc' }}>
                                <div className="d-flex flex-column" style={{ maxWidth: '90%', paddingRight: '2rem' }}>
                                    <span className="text-uppercase small fw-bold text-muted mb-1" style={{ fontSize: '0.7rem', letterSpacing: '1px' }}>
                                        {editingProduct ? 'Editando Producto' : 'Nuevo Registro'}
                                    </span>
                                    <h3 className="mb-0 fw-bold text-dark text-truncate" style={{ fontSize: '1.5rem', letterSpacing: '-0.5px' }}>
                                        {productName || (editingProduct ? 'Sin nombre' : 'Nuevo Producto')}
                                    </h3>
                                </div>
                                <button
                                    className="btn-close-custom position-absolute"
                                    onClick={() => setShowModal(false)}
                                    title="Cerrar modal"
                                    style={{ top: '1.25rem', right: '1.25rem' }}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                </button>
                            </div>

                            {/* Scrollable Body */}
                            <div className="modal-body-scrollable bg-light" style={{ overflowY: 'auto', flex: 1, padding: '1.5rem' }}>
                                {/* Product Name Section */}
                                <div className="card border-0 shadow-sm mb-4 rounded-4 overflow-hidden">
                                    <div className="card-body p-4 bg-white">
                                        <label className="form-label fw-bold text-dark mb-2">Nombre del Producto <span className="text-danger">*</span></label>
                                        <input
                                            type="text"
                                            className="form-control form-control-lg bg-light border-0 fw-semibold text-dark"
                                            style={{ fontSize: '1.1rem' }}
                                            value={productName}
                                            onChange={(e) => setProductName(e.target.value)}
                                            placeholder="Ej: Leche Entera 1L"
                                            autoFocus
                                        />
                                        <div className="form-text text-muted ps-1">Este nombre aparecerá en todos los reportes y selectores.</div>
                                    </div>
                                </div>

                                <div className="d-flex justify-content-between align-items-center mb-3 px-1">
                                    <h4 className="fw-bold text-secondary mb-0 d-flex align-items-center gap-2">
                                        Configuración de Parámetros
                                    </h4>
                                    <span className="badge bg-primary bg-opacity-10 text-primary rounded-pill px-3 py-2">
                                        {parametrosForm.length} Parámetro{parametrosForm.length !== 1 ? 's' : ''}
                                    </span>
                                </div>

                                <div className="d-flex flex-column gap-3">
                                    {parametrosForm.map((param, index) => (
                                        <div key={index} className="card border-0 shadow-sm rounded-4 parameter-card">
                                            <div className="card-body p-3">
                                                <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom">
                                                    <span className="badge bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-25 rounded-pill px-2">
                                                        #{index + 1}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        className="btn btn-outline-danger btn-sm rounded-circle d-flex align-items-center justify-content-center p-0 remove-btn-hover"
                                                        style={{ width: '28px', height: '28px', transition: 'all 0.2s' }}
                                                        onClick={() => removeParametro(index)}
                                                        title="Eliminar parámetro"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                                                            <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
                                                        </svg>
                                                    </button>
                                                </div>

                                                <div className="param-grid-premium">
                                                    <div className="form-group mb-0">
                                                        <label className="form-label small fw-bold text-muted">Parámetro Maestro</label>
                                                        <select
                                                            className="form-select border-0 bg-light"
                                                            value={param.parametro_maestro_id || ''}
                                                            onChange={(e) =>
                                                                handleParametroChange(index, 'parametro_maestro_id',
                                                                    e.target.value ? parseInt(e.target.value) : null)
                                                            }
                                                        >
                                                            <option value="">-- Personalizado --</option>
                                                            {parametrosMaestros.map((m) => (
                                                                <option key={m.id} value={m.id}>{m.nombre}</option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    <div className="form-group mb-0">
                                                        <label className="form-label small fw-bold text-muted">Nombre Parámetro</label>
                                                        <div className="position-relative">
                                                            <input
                                                                type="text"
                                                                className={`form-control border-0 ${param.parametro_maestro_id ? 'bg-secondary bg-opacity-10 text-muted fst-italic' : 'bg-light'}`}
                                                                style={param.parametro_maestro_id ? { cursor: 'not-allowed', paddingRight: '25px' } : {}}
                                                                value={param.nombre}
                                                                onChange={(e) => handleParametroChange(index, 'nombre', e.target.value)}
                                                                placeholder="Nombre del parámetro"
                                                                readOnly={!!param.parametro_maestro_id}
                                                            />
                                                            {param.parametro_maestro_id && (
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" className="text-muted position-absolute" style={{ top: '50%', right: '10px', transform: 'translateY(-50%)' }} viewBox="0 0 16 16">
                                                                    <path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
                                                                </svg>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Mostrar selector de tipo solo si NO es parámetro maestro */}
                                                    {!param.parametro_maestro_id && (
                                                        <div className="form-group mb-0">
                                                            <label className="form-label small fw-bold text-muted">Tipo de Dato</label>
                                                            <select
                                                                className="form-select border-0 bg-light"
                                                                value={param.tipo}
                                                                onChange={(e) =>
                                                                    handleParametroChange(index, 'tipo', e.target.value as 'texto' | 'numero' | 'rango')
                                                                }
                                                            >
                                                                <option value="texto">Texto Libre</option>
                                                                <option value="numero">Numérico</option>
                                                                <option value="rango">Rango (Mín-Máx)</option>
                                                            </select>
                                                        </div>
                                                    )}

                                                    {/* Badges informatvos del tipo si es maestro (opcional, para contexto) */}
                                                    {param.parametro_maestro_id && (
                                                        <div className="form-group mb-0 d-flex align-items-end pb-2">
                                                            <span className="badge bg-light text-secondary border fw-normal py-2 px-3 w-100 text-start">
                                                                Tipo: {param.tipo === 'texto' ? 'Texto' : param.tipo === 'numero' ? 'Numérico' : 'Rango'}
                                                            </span>
                                                        </div>
                                                    )}

                                                    {param.tipo === 'texto' && (
                                                        <div className="form-group mb-0" style={{ gridColumn: 'span 2' }}>
                                                            <label className="form-label small fw-bold text-muted">Valor Esperado (Opcional)</label>
                                                            <input
                                                                type="text"
                                                                className="form-control border-0 bg-light"
                                                                value={param.valor}
                                                                onChange={(e) => handleParametroChange(index, 'valor', e.target.value)}
                                                                placeholder="Ej: Cumple / No Cumple"
                                                            />
                                                        </div>
                                                    )}

                                                    {param.tipo === 'numero' && (
                                                        <div className="form-group mb-0" style={{ gridColumn: 'span 2' }}>
                                                            <label className="form-label small fw-bold text-muted">Valor Numérico Esperado</label>
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                min="0"
                                                                onKeyDown={(e) => {
                                                                    if (e.key === '-' || e.key === 'e' || e.key === 'E') e.preventDefault();
                                                                }}
                                                                className="form-control border-0 bg-light"
                                                                value={param.valor}
                                                                onChange={(e) => handleParametroChange(index, 'valor', e.target.value)}
                                                                placeholder="0.00"
                                                            />
                                                        </div>
                                                    )}

                                                    {param.tipo === 'rango' && (
                                                        <>
                                                            <div className="form-group mb-0">
                                                                <label className="form-label small fw-bold text-muted">Mínimo</label>
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0"
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === '-' || e.key === 'e' || e.key === 'E') e.preventDefault();
                                                                    }}
                                                                    className="form-control border-0 bg-light"
                                                                    value={param.rango_min}
                                                                    onChange={(e) => handleParametroChange(index, 'rango_min', e.target.value)}
                                                                    placeholder="Mín"
                                                                />
                                                            </div>
                                                            <div className="form-group mb-0">
                                                                <label className="form-label small fw-bold text-muted">Máximo</label>
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0"
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === '-' || e.key === 'e' || e.key === 'E') e.preventDefault();
                                                                    }}
                                                                    className="form-control border-0 bg-light"
                                                                    value={param.rango_max}
                                                                    onChange={(e) => handleParametroChange(index, 'rango_max', e.target.value)}
                                                                    placeholder="Máx"
                                                                />
                                                            </div>
                                                        </>
                                                    )}

                                                    {param.tipo !== 'texto' && (
                                                        <div className="form-group mb-0">
                                                            <label className="form-label small fw-bold text-muted">Unidad</label>
                                                            <input
                                                                type="text"
                                                                className={`form-control border-0 ${param.parametro_maestro_id ? 'bg-secondary bg-opacity-10 text-muted' : 'bg-light'}`}
                                                                style={param.parametro_maestro_id ? { cursor: 'not-allowed' } : {}}
                                                                value={param.unidad}
                                                                onChange={(e) => handleParametroChange(index, 'unidad', e.target.value)}
                                                                placeholder="Ej: kg, %, °C"
                                                                readOnly={!!param.parametro_maestro_id}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <button
                                    type="button"
                                    className="btn btn-outline-primary dashed-border w-100 py-3 mt-4 rounded-3 fw-bold d-flex align-items-center justify-content-center gap-2 hover-scale"
                                    onClick={addParametro}
                                    style={{ borderStyle: 'dashed', borderWidth: '2px' }}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                                        <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z" />
                                    </svg>
                                    Agregar Nuevo Parámetro
                                </button>

                                {error && (
                                    <div className="alert alert-danger mt-4 d-flex align-items-center gap-3 rounded-3 shadow-sm border-0 bg-danger bg-opacity-10 text-danger">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16">
                                            <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z" />
                                        </svg>
                                        <div>
                                            <div className="fw-bold">Error al guardar</div>
                                            <div className="small">{error}</div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Fixed Footer */}
                            <div className="modal-footer bg-white border-top p-3" style={{ flexShrink: 0 }}>
                                <button
                                    className="btn btn-light text-secondary fw-bold px-4 rounded-pill"
                                    onClick={() => setShowModal(false)}
                                >
                                    Cancelar
                                </button>
                                <button
                                    className="btn btn-primary fw-bold px-5 rounded-pill shadow-sm hover-shadow"
                                    onClick={handleSave}
                                    disabled={saving}
                                    style={{ background: 'linear-gradient(135deg, #0d6efd 0%, #0a58ca 100%)', border: 'none' }}
                                >
                                    {saving ? (
                                        <>
                                            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                            Guardando...
                                        </>
                                    ) : 'Guardar Producto'}
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
            background-color: #f8fafc;
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

        /* Search Bar */
        .search-bar {
            background: white;
            border-radius: 14px;
            padding: 12px 16px;
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 24px;
        }
        .search-icon {
            color: #94a3b8;
        }
        .search-input {
            flex: 1;
            border: none;
            outline: none;
            font-size: 0.95rem;
            background: transparent;
        }
        .search-input::placeholder {
            color: #cbd5e1;
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

        /* Legacy styles */
        .actions-bar {
          display: flex;
          gap: 1rem;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
        }
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
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
          background: white;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        
        .product-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        }

        .product-card h3 {
          font-size: 1.1rem;
          margin: 0 0 1rem 0;
          color: #1e293b;
          font-weight: 700;
        }

        .card-actions {
          display: flex;
          gap: 0.5rem;
        }

        /* Modal Premium Styles Optimized */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(15, 23, 42, 0.5); /* Sin blur para mejor rendimiento */
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1rem;
          animation: fadeIn 0.15s ease-out; /* Más rápido */
        }

        .modal-content.premium-modal {
          background: #f8fafc;
          border-radius: 12px;
          width: 100%;
          max-width: 800px;
          height: 90vh; /* Altura fija para forzar estructura vertical */
          max-height: 90vh;
          display: flex; /* Estructura Flex Column */
          flex-direction: column;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2); 
          animation: slideUp 0.2s ease-out;
          will-change: transform, opacity;
          overflow: hidden; /* Evitar scroll en el contenedor principal */
        }
        
        .modal-body-scrollable {
            overflow-y: auto;
            flex: 1; /* Ocupar el espacio restante */
            padding: 1.5rem;
        }

        .btn-close-custom {
            background: transparent;
            border: none;
            color: #94a3b8;
            padding: 0.5rem;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: background 0.15s, color 0.15s;
            flex-shrink: 0; /* Evitar que se aplaste */
        }
        
        .btn-close-custom:hover {
            background: #e2e8f0;
            color: #ef4444;
        }

        .param-grid-premium {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 1rem;
          align-items: flex-start; /* Cambiado de end a flex-start para mejor alineación */
        }
        
        /* Eliminar transiciones complejas en móviles o listas largas */
        .parameter-card {
            border: 1px solid transparent;
        }
        .parameter-card:hover {
            border-color: #cbd5e1;
        }

        .remove-btn-hover:hover {
            background-color: #ef4444 !important;
            color: white !important;
        }

        .hover-scale {
            transition: transform 0.1s;
        }
        .hover-scale:hover {
            transform: scale(1.005);
            background-color: rgba(13, 110, 253, 0.05);
        }
        
        /* Sombras simples al hover */
        .hover-shadow {
            transition: box-shadow 0.15s;
        }
        .hover-shadow:hover {
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1) !important;
        }

        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        @keyframes slideUp {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 768px) {
          .param-grid-premium {
            grid-template-columns: 1fr;
            gap: 0.75rem;
          }
        }
      `}</style>
        </div>
    );
}
