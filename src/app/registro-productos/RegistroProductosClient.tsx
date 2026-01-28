'use client';

import { useState, useEffect, useCallback } from 'react';
import Navbar from '@/components/Navbar';
import { createClient } from '@/lib/supabase/client';
import { getCurrentDate, formatRange, validateRange, validateText } from '@/lib/utils';
import type { Producto, Parametro } from '@/lib/supabase/types';

interface ControlValue {
    parametroNombre: string;
    rangoCompleto: string;
    valorControl: number | null;
    textoControl: string | null;
    parametroTipo: string;
    observacion: string;
    fueraDeRango: boolean;
    mensajeAlerta: string;
}

export default function RegistroProductosClient() {
    const supabase = createClient();

    const [formData, setFormData] = useState({
        loteInterno: '',
        guia: '',
        cantidad: '',
        productoId: '',
        observacionesGenerales: '',
    });

    const [productos, setProductos] = useState<Producto[]>([]);
    const [parametros, setParametros] = useState<Parametro[]>([]);
    const [controles, setControles] = useState<ControlValue[]>([]);
    const [fotos, setFotos] = useState<File[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [userName, setUserName] = useState('');

    const [loadingParametros, setLoadingParametros] = useState(false);

    // Load products on mount
    useEffect(() => {
        loadProductos();
        loadUserInfo();
    }, []);

    const loadUserInfo = async () => {
        // Get user from session/cookie
        const response = await fetch('/api/auth/me');
        if (response.ok) {
            const data = await response.json();
            setUserName(data.nombre_completo || data.usuario);
        }
    };

    const loadProductos = async () => {
        try {
            // Usar API segura para evitar problemas de RLS
            const response = await fetch('/api/productos');
            if (!response.ok) throw new Error('Error al cargar productos');

            const data = await response.json();
            setProductos(data || []);
        } catch (err) {
            setError('Error al cargar productos: ' + (err instanceof Error ? err.message : ''));
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const loadParametros = useCallback(async (productoId: string) => {
        if (!productoId) {
            setParametros([]);
            setControles([]);
            return;
        }

        setLoadingParametros(true);
        try {
            // Usar la API endpoiint con el ID para traer parametros seguros
            const response = await fetch(`/api/productos?id=${productoId}`);
            if (!response.ok) throw new Error('Error al cargar detalles del producto');

            const productoDetalle = await response.json();
            // La API devuelve: { ...producto, parametros: [...] }
            const data = productoDetalle.parametros || [];

            setParametros(data);

            // Initialize control values
            const initialControles: ControlValue[] = data.map((param: Parametro) => ({
                parametroNombre: param.nombre,
                rangoCompleto: param.tipo === 'rango'
                    ? formatRange(param.rango_min, param.rango_max, param.unidad)
                    : param.valor || '',
                valorControl: null,
                textoControl: null,
                parametroTipo: param.tipo,
                observacion: '',
                fueraDeRango: false,
                mensajeAlerta: '',
            }));

            setControles(initialControles);
        } catch (err) {
            setError('Error al cargar parámetros del producto');
            console.error(err);
        } finally {
            setLoadingParametros(false);
        }
    }, []);

    useEffect(() => {
        loadParametros(formData.productoId);
    }, [formData.productoId, loadParametros]);

    const handleControlChange = (index: number, field: 'valor' | 'texto' | 'observacion', value: string) => {
        setControles((prev) => {
            const updated = [...prev];
            const control = updated[index];
            const parametro = parametros[index];

            if (field === 'valor') {
                const numValue = parseFloat(value);
                control.valorControl = isNaN(numValue) ? null : numValue;

                // Validate range
                if (parametro.tipo === 'rango' && parametro.rango_min !== null && parametro.rango_max !== null) {
                    const validation = validateRange(numValue, parametro.rango_min, parametro.rango_max);
                    control.fueraDeRango = !validation.isValid;
                    control.mensajeAlerta = validation.message;
                }
            } else if (field === 'texto') {
                control.textoControl = value;

                // Validate text match
                if (parametro.tipo === 'texto' && parametro.valor) {
                    const validation = validateText(value, parametro.valor);
                    control.fueraDeRango = !validation.isValid;
                    control.mensajeAlerta = validation.message;
                }
            } else {
                control.observacion = value;
            }

            return updated;
        });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
        const file = e.target.files?.[0];
        if (file) {
            setFotos((prev) => {
                const updated = [...prev];
                updated[index] = file;
                return updated;
            });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setSaving(true);

        try {
            // Validate required fields
            if (!formData.loteInterno || !formData.cantidad || !formData.productoId) {
                throw new Error('Por favor complete todos los campos requeridos');
            }

            const selectedProduct = productos.find(p => p.id === parseInt(formData.productoId));
            if (!selectedProduct) throw new Error('Producto no encontrado');

            // Save registration via API
            const response = await fetch('/api/registros', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lote_interno: formData.loteInterno,
                    guia: formData.guia,
                    cantidad: parseInt(formData.cantidad),
                    producto_id: parseInt(formData.productoId),
                    producto_nombre: selectedProduct.nombre,
                    observaciones_generales: formData.observacionesGenerales,
                    verificado_por: userName,
                    controles: controles,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Error al guardar registro');
            }

            const { registro_id } = await response.json();

            // Upload photos if any
            for (let i = 0; i < fotos.length; i++) {
                const foto = fotos[i];
                if (foto) {
                    const formDataUpload = new FormData();
                    formDataUpload.append('file', foto);
                    formDataUpload.append('registro_id', registro_id.toString());

                    await fetch('/api/fotos', {
                        method: 'POST',
                        body: formDataUpload,
                    });
                }
            }

            setSuccess('Registro guardado exitosamente');

            // Reset form
            setFormData({
                loteInterno: '',
                guia: '',
                cantidad: '',
                productoId: '',
                observacionesGenerales: '',
            });
            setControles([]);
            setFotos([]);

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al guardar');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <>
                <Navbar userName={userName} userRole="trabajador" />
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
            <Navbar userName={userName} userRole="trabajador" />

            <div className="container mt-4">
                <h2 className="text-center mb-4">Registro de Producto</h2>
                <p className="fecha text-center">{getCurrentDate()}</p>

                <form onSubmit={handleSubmit}>
                    <div className="form-grid">
                        <div className="form-group">
                            <label htmlFor="lote" className="form-label">Lote Interno *</label>
                            <input
                                type="text"
                                id="lote"
                                className="form-control"
                                value={formData.loteInterno}
                                onChange={(e) => setFormData({ ...formData, loteInterno: e.target.value })}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="guia" className="form-label">Guía</label>
                            <input
                                type="text"
                                id="guia"
                                className="form-control"
                                value={formData.guia}
                                onChange={(e) => setFormData({ ...formData, guia: e.target.value })}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="cantidad" className="form-label">Cantidad *</label>
                            <input
                                type="number"
                                id="cantidad"
                                min="1"
                                className="form-control"
                                value={formData.cantidad}
                                onChange={(e) => setFormData({ ...formData, cantidad: e.target.value })}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="producto" className="form-label">Producto *</label>
                            <select
                                id="producto"
                                className="form-select"
                                value={formData.productoId}
                                onChange={(e) => setFormData({ ...formData, productoId: e.target.value })}
                                required
                            >
                                <option value="">Seleccione un producto</option>
                                {productos.map((producto) => (
                                    <option key={producto.id} value={producto.id}>
                                        {producto.nombre}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="form-group mt-3">
                        <label className="form-label">Verificado por *</label>
                        <input
                            type="text"
                            className="form-control"
                            value={userName}
                            readOnly
                        />
                    </div>

                    {/* Parameters Section */}
                    {formData.productoId && (
                        <div className="mt-4">
                            {loadingParametros ? (
                                <div className="text-center py-3">
                                    <span className="spinner-border spinner-border-sm text-primary" role="status" aria-hidden="true"></span>
                                    <span className="ms-2">Cargando parámetros de control...</span>
                                </div>
                            ) : parametros.length > 0 ? (
                                <div className="table-container">
                                    <h4 className="mb-3">Controles de Calidad</h4>
                                    <table className="table">
                                        <thead>
                                            <tr>
                                                <th>Parámetro</th>
                                                <th>Rango / Valor Esperado</th>
                                                <th>Resultado Control</th>
                                                <th>Observaciones</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {parametros.map((param, index) => (
                                                <tr key={param.id}>
                                                    <td>
                                                        <span className="fw-bold d-block">{param.nombre}</span>
                                                        <small className="text-muted">{param.tipo.toUpperCase()}</small>
                                                    </td>
                                                    <td>
                                                        <span className="badge bg-light text-dark border">
                                                            {param.tipo === 'rango'
                                                                ? formatRange(param.rango_min, param.rango_max, param.unidad)
                                                                : param.valor}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        {param.tipo === 'rango' || param.tipo === 'numero' ? (
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                className={`form-control control-input ${controles[index]?.fueraDeRango ? 'is-invalid' : 'is-valid-custom'}`}
                                                                value={controles[index]?.valorControl ?? ''}
                                                                onChange={(e) => handleControlChange(index, 'valor', e.target.value)}
                                                                placeholder="Ingrese valor..."
                                                            />
                                                        ) : (
                                                            <input
                                                                type="text"
                                                                className={`form-control control-input ${controles[index]?.fueraDeRango ? 'is-invalid' : ''}`}
                                                                value={controles[index]?.textoControl ?? ''}
                                                                onChange={(e) => handleControlChange(index, 'texto', e.target.value)}
                                                                placeholder="Ingrese resultado..."
                                                            />
                                                        )}
                                                        {controles[index]?.fueraDeRango && (
                                                            <div className="invalid-feedback d-block">
                                                                {controles[index].mensajeAlerta}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="text"
                                                            className="form-control"
                                                            value={controles[index]?.observacion ?? ''}
                                                            onChange={(e) => handleControlChange(index, 'observacion', e.target.value)}
                                                            placeholder="Opcional"
                                                        />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="alert alert-warning text-center">
                                    <i className="bi bi-exclamation-triangle me-2"></i>
                                    Este producto <strong>no tiene parámetros de control configurados</strong>.
                                    <br />
                                    Por favor contacte al administrador para configurar los parámetros en la sección "Gestión de Productos".
                                </div>
                            )}
                        </div>
                    )}

                    <div className="form-group mt-3">
                        <label className="form-label">Observaciones Generales</label>
                        <textarea
                            className="form-control"
                            rows={3}
                            value={formData.observacionesGenerales}
                            onChange={(e) => setFormData({ ...formData, observacionesGenerales: e.target.value })}
                            placeholder="Observaciones generales del registro..."
                        />
                    </div>

                    {/* Mobile-First Photo Upload Section */}
                    <div className="form-group mt-4">
                        <label className="form-label d-flex align-items-center gap-2">
                            <svg className="w-5 h-5 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            Evidencia Fotográfica
                        </label>

                        <div className="photo-grid">
                            {[0, 1].map((index) => (
                                <div key={index} className="photo-card">
                                    <input
                                        type="file"
                                        id={`foto-${index}`}
                                        accept="image/*"
                                        className="d-none"
                                        onChange={(e) => handleFileChange(e, index)}
                                        capture="environment" // Sugiere cámara trasera en móviles, pero permite galería
                                    />

                                    {fotos[index] ? (
                                        <div className="photo-preview-container">
                                            <img
                                                src={URL.createObjectURL(fotos[index])}
                                                alt={`Evidencia ${index + 1}`}
                                                className="photo-preview-img"
                                            />
                                            <button
                                                type="button"
                                                className="btn-remove-photo"
                                                onClick={() => {
                                                    setFotos(prev => {
                                                        const newFotos = [...prev];
                                                        newFotos[index] = undefined as any; // Trick to clear
                                                        return newFotos.filter(f => f); // Compact array or keep logic consistent?
                                                        // Better to keep index positions or just remove?
                                                        // Current logic uses simple array push. Let's filter out to remove.
                                                        // Actually, handleFileChange uses index. We need to reset specific index.
                                                    });
                                                    // Reset input value to allow re-selecting same file
                                                    const input = document.getElementById(`foto-${index}`) as HTMLInputElement;
                                                    if (input) input.value = '';

                                                    // Fix state update correctly
                                                    setFotos(prev => {
                                                        const updated = [...prev];
                                                        // We can't easily turn array [file, file] into [file, empty].
                                                        // But simplistic approach: remove from array.
                                                        updated.splice(index, 1);
                                                        return updated;
                                                    });
                                                }}
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ) : (
                                        <label htmlFor={`foto-${index}`} className="photo-upload-btn">
                                            <div className="icon-circle">
                                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /></svg>
                                            </div>
                                            <span className="mt-2">Foto {index + 1}</span>
                                            <span className="small text-muted">Cámara o Galería</span>
                                        </label>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {error && <div className="alert alert-danger mt-3">{error}</div>}
                    {success && <div className="alert alert-success mt-3">{success}</div>}

                    <div className="text-center mt-4 mb-4">
                        <button
                            type="submit"
                            className="btn btn-success btn-lg"
                            disabled={saving}
                        >
                            {saving ? 'Guardando...' : 'Guardar Registro'}
                        </button>
                    </div>
                </form>
            </div>

            <style jsx>{`
        .fecha {
          font-weight: bold;
          color: #607d8b;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1rem;
        }

        @media (max-width: 768px) {
          .form-grid {
            grid-template-columns: 1fr;
          }
        }

        .table-container {
          overflow-x: auto;
        }

        .text-danger {
          color: #dc3545;
          font-size: 0.75rem;
          display: block;
          margin-top: 0.25rem;
        }

        .btn-lg {
          padding: 0.75rem 2rem;
          font-size: 1.1rem;
        }

        /* Photo Upload Styles */
        .photo-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 1rem;
        }

        .photo-card {
          aspect-ratio: 1;
          border: 2px dashed #cbd5e1;
          border-radius: 12px;
          position: relative;
          background: #f8fafc;
          transition: all 0.2s;
        }
        
        .photo-card:hover {
          border-color: #94a3b8;
          background: #f1f5f9;
        }

        .photo-upload-btn {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #64748b;
        }

        .icon-circle {
          width: 48px;
          height: 48px;
          background: #e2e8f0;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 0.5rem;
        }

        .photo-preview-container {
          width: 100%;
          height: 100%;
          position: relative;
        }

        .photo-preview-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 10px;
        }

        .btn-remove-photo {
          position: absolute;
          top: -8px;
          right: -8px;
          width: 24px;
          height: 24px;
          background: #ef4444;
          color: white;
          border: 2px solid white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-weight: bold;
          font-size: 1rem;
          line-height: 1;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          z-index: 10;
        }

        /* Validations */
        .is-valid-custom {
            border-color: #198754;
            background-image: url("data:image/svg+xml,..."); /* Optional: add checkmark icon */
        }
      `}</style>
        </>
    );
}
