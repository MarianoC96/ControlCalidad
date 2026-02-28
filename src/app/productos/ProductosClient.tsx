'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import LoadingOverlay from '@/components/LoadingOverlay';
import { useRouter } from 'next/navigation';

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
    tempSearch?: string; // Para el buscador inteligente local
    showDropdown?: boolean; // Para controlar visibilidad local
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
    const [currentParamIndex, setCurrentParamIndex] = useState(0); // Pestaña activa

    // Pagination states
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8;

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
        const newIndex = parametrosForm.length;
        setParametrosForm([...parametrosForm, createEmptyParametro()]);
        setCurrentParamIndex(newIndex); // Saltar a la nueva pestaña automáticamente
    };

    const removeParametro = (index: number) => {
        if (parametrosForm.length > 1) {
            const updated = parametrosForm.filter((_, i) => i !== index);
            setParametrosForm(updated);
            // Ajustar índice de pestaña si la actual fue eliminada o quedó fuera de rango
            if (currentParamIndex >= updated.length) {
                setCurrentParamIndex(updated.length - 1);
            }
        }
    };

    const handleParametroChange = (index: number, field: keyof ParametroForm, value: string | number | null | boolean) => {
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

    // Get current items for pagination
    const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredProducts.slice(indexOfFirstItem, indexOfLastItem);

    // Reset page when searching
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    if (loading) {
        return <LoadingOverlay message="Cargando Productos..." />;
    }

    return (
        <div className="page-wrapper">


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

                {/* Unified Toolbar */}
                <div className="toolbar-section shadow-sm border">
                    <div className="search-group">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                        <input
                            type="text"
                            className="toolbar-input"
                            placeholder="Buscar por nombre de producto..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="table-container-card shadow-sm border">
                    <div className="table-responsive">
                        <table className="table-premium">
                            <thead>
                                <tr>
                                    <th style={{ width: '50%' }}>PRODUCTO</th>
                                    <th className="text-center" style={{ width: '25%' }}>PARÁMETROS</th>
                                    <th className="text-end" style={{ width: '25%', paddingRight: '24px' }}>ACCIONES</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentItems.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="text-center py-5">
                                            <div className="empty-state-table">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1" viewBox="0 0 24 24">
                                                    <circle cx="11" cy="11" r="8"></circle>
                                                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                                </svg>
                                                <p>No se encontraron productos coincidentes</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    currentItems.map((producto) => (
                                        <tr key={producto.id} className="row-hover">
                                            <td>
                                                <div className="product-info-cell">
                                                    <div className="product-icon">
                                                        {producto.nombre.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="product-details">
                                                        <span className="product-name-txt text-truncate" style={{ maxWidth: '300px' }}>{producto.nombre}</span>
                                                        <span className="product-id-txt">ID: #{String(producto.id).padStart(4, '0')}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="text-center">
                                                <span className="params-badge">
                                                    {parametrosMaestros.length > 0 ? 'Configurado' : 'Sin parámetros'}
                                                </span>
                                            </td>
                                            <td className="text-end" style={{ paddingRight: '24px' }}>
                                                <div className="d-flex justify-content-end gap-2">
                                                    <button
                                                        className="btn-action edit"
                                                        onClick={() => openEditModal(producto)}
                                                        title="Editar"
                                                    >
                                                        <i className="bi bi-pencil-fill"></i>
                                                    </button>
                                                    <button
                                                        className="btn-action delete"
                                                        onClick={() => handleDelete(producto.id)}
                                                        title="Eliminar"
                                                    >
                                                        <i className="bi bi-trash3-fill"></i>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Bar */}
                    {totalPages > 1 && (
                        <div className="pagination-bar border-top">
                            <span className="pagination-info">
                                Mostrando <b>{indexOfFirstItem + 1}-{Math.min(indexOfLastItem, filteredProducts.length)}</b> de {filteredProducts.length}
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
            {
                showModal && (
                    <div className="modal-overlay" onClick={() => setShowModal(false)}>
                        <div className="modal-content premium-modal" onClick={(e) => e.stopPropagation()}>
                            {/* Sticky Header */}
                            {/* Fixed Header */}
                            <div className="modal-header-premium">
                                <div className="header-content-left">
                                    <div className="status-indicator">
                                        <span className="pulse-dot"></span>
                                        {editingProduct ? 'MODO EDICIÓN' : 'NUEVO TRÁMITE'}
                                    </div>
                                    <h3 className="modal-main-title">
                                        {editingProduct ? 'Editar Producto' : 'Registrar Nuevo Producto'}
                                    </h3>
                                    <p className="modal-sub-title">
                                        {productName || (editingProduct ? 'Sin nombre asignado' : 'Configure los detalles y parámetros del producto')}
                                    </p>
                                </div>
                                <button
                                    className="btn-close-modal"
                                    onClick={() => setShowModal(false)}
                                    title="Cerrar"
                                >
                                    <i className="bi bi-x-lg"></i>
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

                                {/* Master-Detail Layout Container */}
                                <div className="split-view-container mt-4">
                                    {/* Left Sidebar: Parameter Navigation */}
                                    <div className="parameter-sidebar">
                                        <div className="sidebar-header">
                                            <span className="sidebar-title">PARÁMETROS</span>
                                            <span className="sidebar-count">{parametrosForm.length}</span>
                                        </div>
                                        <div className="parameter-nav-list">
                                            {parametrosForm.map((p, idx) => (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    className={`nav-item-btn ${currentParamIndex === idx ? 'active' : ''}`}
                                                    onClick={() => setCurrentParamIndex(idx)}
                                                >
                                                    <div className="nav-item-info">
                                                        <span className="nav-number">{idx + 1}</span>
                                                        <div className="nav-texts">
                                                            <span className="nav-label text-truncate">{p.nombre || 'Sin nombre'}</span>
                                                            <span className="nav-type">{p.tipo.toUpperCase()}</span>
                                                        </div>
                                                    </div>
                                                    {parametrosForm.length > 1 && (
                                                        <span
                                                            className="nav-item-remove"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                removeParametro(idx);
                                                            }}
                                                        >
                                                            <i className="bi bi-x"></i>
                                                        </span>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                        <button
                                            type="button"
                                            className="btn-add-parameter-sidebar"
                                            onClick={addParametro}
                                        >
                                            <i className="bi bi-plus-circle-fill me-2"></i>
                                            <span>Nuevo Parámetro</span>
                                        </button>
                                    </div>

                                    {/* Right Content: Active Parameter Configuration */}
                                    <div className="parameter-content-area">
                                        {parametrosForm[currentParamIndex] ? (
                                            <div className="active-tab-animation">
                                                <div className="content-area-header mb-4">
                                                    <h5 className="fw-bold text-dark-emphasis mb-0">
                                                        Configuración del Parámetro {currentParamIndex + 1}
                                                    </h5>
                                                    <hr className="my-3 opacity-10" />
                                                </div>

                                                <div className="row g-4">
                                                    {/* Origen del Parámetro con Buscador Inteligente */}
                                                    <div className="col-md-12">
                                                        <label className="form-label-custom">Origen del Parámetro</label>
                                                        <div className="smart-selector-container">
                                                            <div className="input-group-custom">
                                                                <i className="bi bi-search input-icon" style={{ zIndex: 10 }}></i>
                                                                <input
                                                                    type="text"
                                                                    className="form-control-premium searchable"
                                                                    placeholder="Buscar parámetro maestro..."
                                                                    value={parametrosForm[currentParamIndex].tempSearch !== undefined ? parametrosForm[currentParamIndex].tempSearch : (parametrosForm[currentParamIndex].parametro_maestro_id ? parametrosForm[currentParamIndex].nombre : '')}
                                                                    onFocus={() => handleParametroChange(currentParamIndex, 'showDropdown', true)}
                                                                    onChange={(e) => {
                                                                        handleParametroChange(currentParamIndex, 'tempSearch', e.target.value);
                                                                        handleParametroChange(currentParamIndex, 'showDropdown', true);
                                                                    }}
                                                                />
                                                                {parametrosForm[currentParamIndex].parametro_maestro_id && (
                                                                    <button
                                                                        className="btn-clear-selection"
                                                                        onClick={() => {
                                                                            handleParametroChange(currentParamIndex, 'parametro_maestro_id', null);
                                                                            handleParametroChange(currentParamIndex, 'tempSearch', '');
                                                                        }}
                                                                    >
                                                                        <i className="bi bi-x"></i>
                                                                    </button>
                                                                )}
                                                            </div>

                                                            {parametrosForm[currentParamIndex].showDropdown && (
                                                                <div className="smart-dropdown shadow-lg">
                                                                    <div className="dropdown-section-title">OPCIONES</div>
                                                                    <div
                                                                        className={`dropdown-item-custom ${!parametrosForm[currentParamIndex].parametro_maestro_id ? 'active' : ''}`}
                                                                        onClick={() => {
                                                                            handleParametroChange(currentParamIndex, 'parametro_maestro_id', null);
                                                                            handleParametroChange(currentParamIndex, 'showDropdown', false);
                                                                            handleParametroChange(currentParamIndex, 'tempSearch', '');
                                                                        }}
                                                                    >
                                                                        <i className="bi bi-plus-circle-dotted me-2 text-primary"></i>
                                                                        Personalizado / Único
                                                                    </div>

                                                                    <div className="dropdown-section-title">CATÁLOGO MAESTRO</div>
                                                                    {parametrosMaestros
                                                                        .filter(m => !parametrosForm[currentParamIndex].tempSearch || normalizeString(m.nombre).includes(normalizeString(parametrosForm[currentParamIndex].tempSearch)))
                                                                        .map(m => (
                                                                            <div
                                                                                key={m.id}
                                                                                className={`dropdown-item-custom ${parametrosForm[currentParamIndex].parametro_maestro_id === m.id ? 'active' : ''}`}
                                                                                onClick={() => {
                                                                                    handleParametroChange(currentParamIndex, 'parametro_maestro_id', m.id);
                                                                                    handleParametroChange(currentParamIndex, 'showDropdown', false);
                                                                                    handleParametroChange(currentParamIndex, 'tempSearch', m.nombre);
                                                                                }}
                                                                            >
                                                                                <div className="d-flex justify-content-between align-items-center w-100">
                                                                                    <span>{m.nombre}</span>
                                                                                    <span className="badge-type-mini">{m.tipo}</span>
                                                                                </div>
                                                                            </div>
                                                                        ))
                                                                    }
                                                                    {parametrosMaestros.filter(m => !parametrosForm[currentParamIndex].tempSearch || normalizeString(m.nombre).includes(normalizeString(parametrosForm[currentParamIndex].tempSearch))).length === 0 && (
                                                                        <div className="p-3 text-center text-muted small">No se encontraron resultados</div>
                                                                    )}
                                                                </div>
                                                            )}
                                                            {parametrosForm[currentParamIndex].showDropdown && (
                                                                <div className="dropdown-backdrop" onClick={() => handleParametroChange(currentParamIndex, 'showDropdown', false)}></div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="col-md-12">
                                                        <label className="form-label-custom">Nombre del Parámetro</label>
                                                        <div className="input-group-custom">
                                                            <i className={`bi ${parametrosForm[currentParamIndex].parametro_maestro_id ? 'bi-lock-fill text-primary' : 'bi-pencil'} input-icon`}></i>
                                                            <input
                                                                type="text"
                                                                className={`form-control-premium ${parametrosForm[currentParamIndex].parametro_maestro_id ? 'bg-disabled' : ''}`}
                                                                value={parametrosForm[currentParamIndex].nombre}
                                                                onChange={(e) => handleParametroChange(currentParamIndex, 'nombre', e.target.value)}
                                                                placeholder="Ej: Humedad"
                                                                readOnly={!!parametrosForm[currentParamIndex].parametro_maestro_id}
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="col-md-6">
                                                        <label className="form-label-custom">Tipo de Evaluación</label>
                                                        {!parametrosForm[currentParamIndex].parametro_maestro_id ? (
                                                            <div className="d-flex gap-2">
                                                                {(['texto', 'numero', 'rango'] as const).map((t) => (
                                                                    <button
                                                                        key={t}
                                                                        type="button"
                                                                        className={`btn-type-selector-small ${parametrosForm[currentParamIndex].tipo === t ? 'active' : ''}`}
                                                                        onClick={() => handleParametroChange(currentParamIndex, 'tipo', t)}
                                                                    >
                                                                        {t === 'texto' && <i className="bi bi-fonts"></i>}
                                                                        {t === 'numero' && <i className="bi bi-123"></i>}
                                                                        {t === 'rango' && <i className="bi bi-arrows-expand"></i>}
                                                                        <span className="ms-2">{t.charAt(0).toUpperCase() + t.slice(1)}</span>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <div className="data-preview-box">
                                                                <i className="bi bi-info-circle me-2 text-primary"></i>
                                                                <strong>{parametrosForm[currentParamIndex].tipo.toUpperCase()}</strong>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {parametrosForm[currentParamIndex].tipo !== 'texto' && (
                                                        <div className="col-md-6">
                                                            <label className="form-label-custom">Unidad de Medida</label>
                                                            <div className="input-group-custom">
                                                                <i className="bi bi-rulers input-icon"></i>
                                                                <input
                                                                    type="text"
                                                                    className={`form-control-premium ${parametrosForm[currentParamIndex].parametro_maestro_id ? 'bg-disabled' : ''}`}
                                                                    value={parametrosForm[currentParamIndex].unidad}
                                                                    onChange={(e) => handleParametroChange(currentParamIndex, 'unidad', e.target.value)}
                                                                    placeholder="kg, %, °C"
                                                                    readOnly={!!parametrosForm[currentParamIndex].parametro_maestro_id}
                                                                />
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="col-12">
                                                        <div className="value-config-container p-4 rounded-4 bg-light border-0 shadow-sm">
                                                            {parametrosForm[currentParamIndex].tipo === 'texto' && (
                                                                <div>
                                                                    <label className="form-label-custom">Valor Esperado / Etiqueta</label>
                                                                    <input
                                                                        type="text"
                                                                        className="form-control-premium bg-white"
                                                                        value={parametrosForm[currentParamIndex].valor}
                                                                        onChange={(e) => handleParametroChange(currentParamIndex, 'valor', e.target.value)}
                                                                        placeholder="Ej: Cumple / No Cumple"
                                                                    />
                                                                </div>
                                                            )}

                                                            {parametrosForm[currentParamIndex].tipo === 'numero' && (
                                                                <div>
                                                                    <label className="form-label-custom">Valor Numérico Objetivo</label>
                                                                    <div className="input-group">
                                                                        <input
                                                                            type="number"
                                                                            className="form-control-premium bg-white"
                                                                            value={parametrosForm[currentParamIndex].valor}
                                                                            onChange={(e) => handleParametroChange(currentParamIndex, 'valor', e.target.value)}
                                                                            placeholder="0.00"
                                                                        />
                                                                        <span className="input-group-text bg-white border-0 text-muted fw-bold">{parametrosForm[currentParamIndex].unidad}</span>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {parametrosForm[currentParamIndex].tipo === 'rango' && (
                                                                <div className="row g-3">
                                                                    <div className="col-6">
                                                                        <label className="form-label-custom text-primary">Mínimo Aceptable</label>
                                                                        <input
                                                                            type="number"
                                                                            className="form-control-premium bg-white"
                                                                            value={parametrosForm[currentParamIndex].rango_min}
                                                                            onChange={(e) => handleParametroChange(currentParamIndex, 'rango_min', e.target.value)}
                                                                            placeholder="Mín"
                                                                        />
                                                                    </div>
                                                                    <div className="col-6">
                                                                        <label className="form-label-custom text-danger">Máximo Aceptable</label>
                                                                        <input
                                                                            type="number"
                                                                            className="form-control-premium bg-white"
                                                                            value={parametrosForm[currentParamIndex].rango_max}
                                                                            onChange={(e) => handleParametroChange(currentParamIndex, 'rango_max', e.target.value)}
                                                                            placeholder="Máx"
                                                                        />
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="empty-param-state h-100 d-flex flex-column align-items-center justify-content-center text-muted py-5">
                                                <i className="bi bi-collection-play mb-3" style={{ fontSize: '3rem', opacity: 0.3 }}></i>
                                                <p>Seleccione o agregue un parámetro</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

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

        /* NEW TABLE SYSTEM */
        .toolbar-section {
            background: white;
            border-radius: 16px;
            padding: 12px 24px;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
        }

        .search-group {
            flex: 1;
            display: flex;
            align-items: center;
            gap: 12px;
            color: #94a3b8;
        }

        .toolbar-input {
            border: none;
            outline: none;
            width: 100%;
            font-size: 0.95rem;
            color: #1e293b;
            font-weight: 500;
        }

        .toolbar-input::placeholder {
            color: #cbd5e1;
            font-weight: 400;
        }

        .table-container-card {
            background: white;
            border-radius: 20px;
            overflow: hidden;
            background: rgba(255, 255, 255, 0.9);
            backdrop-filter: blur(10px);
        }

        .table-premium {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
        }

        .table-premium thead th {
            background: #f8fafc;
            padding: 16px 24px;
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

        .row-hover {
            transition: background 0.2s;
        }

        .row-hover:hover {
            background: #f8fafc;
        }

        .product-info-cell {
            display: flex;
            align-items: center;
            gap: 16px;
        }

        .product-icon {
            width: 40px;
            height: 40px;
            background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
            color: white;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 900;
            font-size: 1.1rem;
            box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);
        }

        .product-details {
            display: flex;
            flex-direction: column;
        }

        .product-name-txt {
            font-weight: 700;
            color: #1e293b;
            font-size: 0.95rem;
        }

        .product-id-txt {
            font-size: 0.75rem;
            color: #94a3b8;
            font-family: monospace;
        }

        .params-badge {
            background: #e0f2fe;
            color: #0369a1;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.75rem;
            font-weight: 700;
        }

            /* Header Premium Redesign */
            .modal-header-premium {
                padding: 1.5rem 2rem;
                background: linear-gradient(to right, #ffffff, #f8fafc);
                border-bottom: 1px solid #e2e8f0;
                display: flex;
                justify-content: space-between;
                align-items: center;
                position: relative;
                flex-shrink: 0;
            }
            .status-indicator {
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 0.65rem;
                font-weight: 800;
                color: #3b82f6;
                letter-spacing: 1px;
                margin-bottom: 4px;
            }
            .pulse-dot {
                width: 6px;
                height: 6px;
                background: #3b82f6;
                border-radius: 50%;
                animation: dot-pulse 2s infinite;
            }
            @keyframes dot-pulse {
                0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4); }
                70% { box-shadow: 0 0 0 10px rgba(59, 130, 246, 0); }
                100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
            }
            .modal-main-title {
                margin: 0;
                font-size: 1.35rem;
                font-weight: 800;
                color: #0f172a;
                letter-spacing: -0.5px;
            }
            .modal-sub-title {
                margin: 2px 0 0 0;
                font-size: 0.85rem;
                color: #64748b;
                font-weight: 500;
            }
            .btn-close-modal {
                width: 40px;
                height: 40px;
                background: #f1f5f9;
                border: none;
                border-radius: 12px;
                color: #64748b;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.2rem;
                transition: all 0.2s;
                cursor: pointer;
            }
            .btn-close-modal:hover {
                background: #fee2e2;
                color: #ef4444;
                transform: rotate(90deg);
            }

        .btn-action {
            width: 36px;
            height: 36px;
            border-radius: 10px;
            border: none;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
            cursor: pointer;
        }

        .btn-action.edit {
            background: #f1f5f9;
            color: #64748b;
        }

        .btn-action.edit:hover {
            background: #e0f2fe;
            color: #0284c7;
        }

        .btn-action.delete {
            background: #f1f5f9;
            color: #64748b;
        }

        .btn-action.delete:hover {
            background: #fee2e2;
            color: #ef4444;
        }

        .pagination-bar {
            padding: 16px 24px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #f8fafc;
        }

        .pagination-info {
            font-size: 0.85rem;
            color: #64748b;
        }

        .pagination-controls {
            display: flex;
            gap: 6px;
        }

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
            color: #64748b;
            transition: all 0.2s;
            cursor: pointer;
        }

        .page-btn:hover:not(:disabled) {
            border-color: #3b82f6;
            color: #3b82f6;
        }

        .page-btn.active {
            background: #3b82f6;
            color: white;
            border-color: #3b82f6;
        }

        .page-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .empty-state-table {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 16px;
            color: #94a3b8;
        }
            /* Modal Positioning & Overlay */
            .modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(15, 23, 42, 0.65);
                backdrop-filter: blur(4px);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9999;
                padding: 2rem;
                animation: fadeIn 0.2s ease-out;
            }

            .modal-content.premium-modal {
                background: #f8fafc;
                border-radius: 20px;
                width: 100%;
                max-width: 850px;
                height: 90vh;
                max-height: 850px;
                display: flex;
                flex-direction: column;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                overflow: hidden;
                border: 1px solid rgba(255, 255, 255, 0.1);
            }

            .modal-body-scrollable {
                overflow-y: auto;
                flex: 1;
                padding: 2rem;
                background: #f8fafc;
            }

            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            @keyframes slideUp {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
            }

            /* Modal Modern Redesign */
            .parameter-card-premium {
                background: white;
                border: 1px solid #e2e8f0;
                transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            }
            .parameter-card-premium:hover {
                transform: translateY(-2px);
                box-shadow: 0 12px 20px -8px rgba(0,0,0,0.1) !important;
                border-color: #3b82f6;
            }
            .param-number-circle {
                width: 24px;
                height: 24px;
                background: #3b82f6;
                color: white;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 0.75rem;
                font-weight: 800;
            }
            .btn-remove-parameter {
                background: #fff1f2;
                color: #e11d48;
                border: none;
                width: 32px;
                height: 32px;
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
                cursor: pointer;
            }
            .btn-remove-parameter:hover {
                background: #e11d48;
                color: white;
            }
            .form-label-custom {
                display: block;
                font-size: 0.75rem;
                font-weight: 800;
                color: #64748b;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-bottom: 8px;
            }
            .input-group-custom {
                position: relative;
                display: flex;
                align-items: center;
            }
            .input-icon {
                position: absolute;
                left: 12px;
                color: #94a3b8;
                font-size: 1rem;
            }
            .form-control-premium, .form-select-premium {
                width: 100%;
                padding: 10px 12px 10px 38px;
                border-radius: 12px;
                border: 1.5px solid #f1f5f9;
                background: #f8fafc;
                font-size: 0.95rem;
                font-weight: 600;
                color: #1e293b;
                transition: all 0.2s;
                outline: none;
            }
            .form-control-premium:focus, .form-select-premium:focus {
                background: white;
                border-color: #3b82f6;
                box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
            }
            .bg-disabled {
                background: #f1f5f9;
                color: #94a3b8;
                cursor: not-allowed;
            }
            .btn-type-selector {
                flex: 1;
                border: 1.5px solid #f1f5f9;
                background: white;
                padding: 10px;
                border-radius: 12px;
                font-size: 0.8rem;
                font-weight: 700;
                color: #64748b;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
                cursor: pointer;
            }
            .btn-type-selector:hover {
                border-color: #3b82f6;
                color: #3b82f6;
            }
            .btn-type-selector.active {
                background: #3b82f6;
                border-color: #3b82f6;
                color: white;
                box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
            }
            .data-preview-box {
                background: #eff6ff;
                padding: 10px 16px;
                border-radius: 12px;
                font-size: 0.85rem;
                color: #1e40af;
                font-weight: 600;
                border: 1px dashed #bfdbfe;
            }
            .btn-add-parameter-main {
                background: white;
                border: 2px dashed #e2e8f0;
                padding: 16px 32px;
                border-radius: 16px;
                font-weight: 800;
                color: #64748b;
                display: inline-flex;
                align-items: center;
                gap: 12px;
                transition: all 0.2s;
                cursor: pointer;
            }
            .btn-add-parameter-main:hover {
                border-color: #3b82f6;
                color: #3b82f6;
                background: #f0f7ff;
                transform: translateY(-2px);
            }
            .add-icon-wrapper {
                width: 28px;
                height: 28px;
                background: #f1f5f9;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
            }
            .btn-add-parameter-main:hover .add-icon-wrapper {
                background: #3b82f6;
                color: white;
            }

            @media (max-width: 768px) {
                .modal-content.premium-modal {
                    height: 100vh;
                    border-radius: 0;
                }
                .btn-type-selector {
                    padding: 8px;
                    font-size: 0.7rem;
                }
            }
            /* Smart Selector Component */
            .smart-selector-container {
                position: relative;
            }
            .form-control-premium.searchable {
                cursor: text;
            }
            .smart-dropdown {
                position: absolute;
                top: calc(100% + 5px);
                left: 0;
                right: 0;
                background: white;
                border-radius: 12px;
                border: 1px solid #e2e8f0;
                z-index: 1000;
                max-height: 250px;
                overflow-y: auto;
                animation: slideDown 0.2s ease-out;
            }
            .dropdown-section-title {
                padding: 10px 16px 5px;
                font-size: 0.65rem;
                font-weight: 800;
                color: #94a3b8;
                text-transform: uppercase;
                letter-spacing: 1px;
            }
            .dropdown-item-custom {
                padding: 10px 16px;
                font-size: 0.9rem;
                font-weight: 600;
                color: #1e293b;
                display: flex;
                align-items: center;
                cursor: pointer;
                transition: all 0.15s;
            }
            .dropdown-item-custom:hover {
                background: #f1f5f9;
                color: #3b82f6;
            }
            .dropdown-item-custom.active {
                background: #eff6ff;
                color: #3b82f6;
            }
            .badge-type-mini {
                font-size: 0.65rem;
                padding: 2px 6px;
                background: #f1f5f9;
                color: #64748b;
                border-radius: 6px;
                text-transform: uppercase;
                font-weight: 800;
            }
            .dropdown-backdrop {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                z-index: 999;
            }
            .btn-clear-selection {
                position: absolute;
                right: 12px;
                top: 50%;
                transform: translateY(-50%);
                background: #f1f5f9;
                border: none;
                width: 20px;
                height: 20px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #64748b;
                cursor: pointer;
                transition: all 0.2s;
            }
            .btn-clear-selection:hover {
                background: #cbd5e1;
                color: #0f172a;
            }
            @keyframes slideDown {
                from { opacity: 0; transform: translateY(-5px); }
                to { opacity: 1; transform: translateY(0); }
            }
            /* Master-Detail (Split View) Styles */
            .split-view-container {
                display: flex;
                gap: 24px;
                min-height: 500px;
                align-items: stretch;
            }
            .parameter-sidebar {
                width: 280px;
                display: flex;
                flex-direction: column;
                background: white;
                border-radius: 20px;
                border: 1.5px solid #f1f5f9;
                padding: 16px;
                gap: 12px;
                flex-shrink: 0;
            }
            .sidebar-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 0 8px 10px;
                border-bottom: 1px solid #f8fafc;
            }
            .sidebar-title {
                font-size: 0.75rem;
                font-weight: 800;
                color: #94a3b8;
                letter-spacing: 1px;
            }
            .sidebar-count {
                background: #f1f5f9;
                color: #64748b;
                font-size: 0.7rem;
                font-weight: 800;
                padding: 2px 8px;
                border-radius: 20px;
            }
            .parameter-nav-list {
                flex: 1;
                overflow-y: auto;
                max-height: 400px; /* Manage up to 10+ items easily */
                padding-right: 4px;
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            .parameter-nav-list::-webkit-scrollbar {
                width: 4px;
            }
            .parameter-nav-list::-webkit-scrollbar-thumb {
                background: #e2e8f0;
                border-radius: 10px;
            }
            .nav-item-btn {
                width: 100%;
                background: transparent;
                border: 1.5px solid transparent;
                padding: 12px;
                border-radius: 14px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                transition: all 0.2s;
                text-align: left;
            }
            .nav-item-btn:hover {
                background: #f8fafc;
                border-color: #f1f5f9;
            }
            .nav-item-btn.active {
                background: #eff6ff;
                border-color: #3b82f6;
                box-shadow: 0 4px 12px rgba(59, 130, 246, 0.08);
            }
            .nav-item-info {
                display: flex;
                align-items: center;
                gap: 12px;
                overflow: hidden;
            }
            .nav-number {
                width: 24px;
                height: 24px;
                background: #f1f5f9;
                color: #94a3b8;
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 0.75rem;
                font-weight: 800;
                flex-shrink: 0;
            }
            .nav-item-btn.active .nav-number {
                background: #3b82f6;
                color: white;
            }
            .nav-texts {
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            .nav-label {
                font-size: 0.85rem;
                font-weight: 700;
                color: #475569;
            }
            .nav-item-btn.active .nav-label {
                color: #1e40af;
            }
            .nav-type {
                font-size: 0.65rem;
                font-weight: 800;
                color: #94a3b8;
            }
            .nav-item-remove {
                color: #cbd5e1;
                transition: all 0.2s;
                padding: 4px;
            }
            .nav-item-remove:hover {
                color: #ef4444;
                transform: scale(1.2);
            }
            .btn-add-parameter-sidebar {
                width: 100%;
                background: #f8fafc;
                border: 2px dashed #e2e8f0;
                padding: 12px;
                border-radius: 14px;
                color: #64748b;
                font-size: 0.85rem;
                font-weight: 700;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
                margin-top: 8px;
            }
            .btn-add-parameter-sidebar:hover {
                background: #eff6ff;
                border-color: #3b82f6;
                color: #3b82f6;
            }
            .parameter-content-area {
                flex: 1;
                background: white;
                border-radius: 20px;
                padding: 32px;
                border: 1.5px solid #f1f5f9;
                box-shadow: 0 4px 20px rgba(0,0,0,0.02);
            }
            .btn-type-selector-small {
                flex: 1;
                background: #f8fafc;
                border: 1px solid #e2e8f0;
                padding: 8px;
                border-radius: 10px;
                font-size: 0.8rem;
                font-weight: 700;
                color: #64748b;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .btn-type-selector-small.active {
                background: #3b82f6;
                color: white;
                border-color: #2563eb;
                box-shadow: 0 4px 10px rgba(59, 130, 246, 0.2);
            }
      `}</style>
        </div>
    );
}
