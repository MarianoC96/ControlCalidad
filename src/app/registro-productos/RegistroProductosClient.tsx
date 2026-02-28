'use client';

import { useState, useEffect, useCallback } from 'react';
import LoadingOverlay from '@/components/LoadingOverlay';

import AutocompleteSelect from '@/components/AutocompleteSelect';
import { getCurrentDate, formatRange } from '@/lib/utils';
import { cacheProducts, getCachedProducts } from '@/lib/temporal-db';
import type { Producto, Parametro } from '@/lib/supabase/types';

import { useAuth } from '@/hooks/useAuth';
import { useCamera } from '@/hooks/useCamera';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { useProductForm } from '@/hooks/useProductForm';
import { useProductos } from '@/hooks/useData';
import './registro-productos.css';

/**
 * Product Registration Page — Refactored.
 *
 * Chesterton's Fence: the original 1142-line component mixed camera, offline,
 * form state, validation and UI rendering. This refactored version delegates
 * domain logic to specialized hooks while keeping the UI composition here.
 */
export default function RegistroProductosClient() {
    // ─── Infrastructure Hooks ──────────────────────────────────
    const { userName, userId, isLoading: authLoading } = useAuth();
    const { isOnline, saveRecordOffline } = useOfflineSync();
    const camera = useCamera();

    // ─── Data Loading (SWR + IndexedDB offline fallback) ──────
    const { data: productosData, error: productosError, isLoading: productosLoading } = useProductos();
    const [offlineProductos, setOfflineProductos] = useState<Producto[]>([]);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [saving, setSaving] = useState(false);
    const [showPreviewModal, setShowPreviewModal] = useState(false);

    // Merge: SWR data takes priority, fallback to IndexedDB cache when offline
    const productos = productosData ?? offlineProductos;
    const loading = productosLoading && offlineProductos.length === 0;

    // Load offline cache as fallback
    useEffect(() => {
        if (productosError || !isOnline) {
            getCachedProducts()
                .then((cached) => {
                    if (cached.length > 0) setOfflineProductos(cached as Producto[]);
                    else if (!productosData) setError('Sin conexión y no hay productos en caché');
                })
                .catch(() => setError('Error al cargar productos offline'));
        }
    }, [productosError, isOnline, productosData]);

    // Background cache for offline use (when online data arrives)
    useEffect(() => {
        if (!productosData || productosData.length === 0) return;

        fetch('/api/productos?includeParams=true')
            .then((res) => res.ok ? res.json() : null)
            .then((allData) => { if (allData) cacheProducts(allData); })
            .catch((e) => console.warn('No se pudo cachear productos en IndexedDB:', e));
    }, [productosData]);

    // ─── Form Hook (depends on productos) ──────────────────────
    const form = useProductForm(productos);
    // ─── Form Submission ───────────────────────────────────────
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        form.setTouched(true);

        if (!form.validateForm()) {
            setError('Por favor complete los campos obligatorios marcados en rojo.');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        setShowPreviewModal(true);
    };

    const confirmAndSave = async () => {
        setSaving(true);

        try {
            if (!form.validateForm()) {
                throw new Error('Por favor complete todos los campos requeridos');
            }

            const selectedProduct = productos.find((p) => p.id === parseInt(form.formData.productoId));
            if (!selectedProduct) throw new Error('Producto no encontrado');

            // ─── OFFLINE ───
            if (!isOnline) {
                const fotosPreviews: string[] = camera.fotos
                    .filter((f): f is NonNullable<typeof f> => f !== null && !!f.preview)
                    .map((f) => f.preview);

                await saveRecordOffline({
                    formData: { ...form.formData },
                    productoNombre: selectedProduct.nombre,
                    controles: form.controles.map((c) => ({ ...c })),
                    fotos: fotosPreviews,
                    verificadoPor: userName,
                    userId,
                    timestamp: new Date().toISOString(),
                    synced: false,
                });

                setSuccess('⏱️ Registro guardado temporalmente (offline). Sincronice desde el módulo Temporal cuando tenga conexión.');
                form.resetForm();
                camera.resetPhotos();
                setShowPreviewModal(false);
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return;
            }

            // ─── ONLINE ───
            const response = await fetch('/api/registros', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lote_interno: form.formData.loteInterno,
                    lote_producto: form.formData.loteProducto,
                    guia: form.formData.guia,
                    marca: form.formData.marca,
                    cantidad: parseInt(form.formData.cantidad),
                    producto_id: parseInt(form.formData.productoId),
                    producto_nombre: selectedProduct.nombre,
                    observaciones_generales: form.formData.observacionesGenerales,
                    verificado_por: userName,
                    controles: form.controles,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Error al guardar registro');
            }

            const { registro_id } = await response.json();

            // Upload photos
            for (let i = 0; i < camera.fotos.length; i++) {
                const fotoObj = camera.fotos[i];
                if (fotoObj?.preview) {
                    try {
                        const photoRes = await fetch('/api/fotos', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                registro_id,
                                datos_base64: fotoObj.preview,
                                descripcion: `Foto ${i + 1}`,
                            }),
                        });
                        if (!photoRes.ok) {
                            console.error(`Failed to upload photo ${i + 1}:`, await photoRes.text());
                        }
                    } catch (photoErr) {
                        console.error(`Error uploading photo ${i + 1}:`, photoErr);
                    }
                }
            }

            setSuccess('Registro guardado exitosamente');
            form.resetForm();
            camera.resetPhotos();
            setShowPreviewModal(false);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al guardar');
        } finally {
            setSaving(false);
        }
    };

    // ─── Loading State ─────────────────────────────────────────
    if (loading || authLoading) {
        return <LoadingOverlay message="Sincronizando Sistema de Registro..." />;
    }

    // ─── Main UI ───────────────────────────────────────────────
    return (
        <div className="page-wrapper">
            <main className="main-content">
                {/* Offline Banner */}
                {!isOnline && (
                    <div style={{
                        background: 'linear-gradient(90deg, #dc2626, #b91c1c)',
                        color: 'white', padding: '0.75rem 1.25rem', borderRadius: '10px',
                        marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem',
                        fontWeight: 600, fontSize: '0.95rem', animation: 'pulseOffline 2s infinite',
                    }}>
                        <span style={{ fontSize: '1.3rem' }}>📡</span>
                        <div>
                            <div>SIN CONEXIÓN A INTERNET</div>
                            <div style={{ fontWeight: 400, fontSize: '0.8rem', opacity: 0.9 }}>
                                Los registros se guardarán temporalmente y podrá sincronizarlos desde el módulo Temporal
                            </div>
                        </div>
                    </div>
                )}

                {/* Header */}
                <div className="header-container shadow-sm border">
                    <div className="header-info">
                        <div className="badge-system">
                            <span className="dot-pulse" style={!isOnline ? { background: '#ef4444' } : {}}></span>
                            {isOnline ? 'REGISTRO' : 'REGISTRO OFFLINE'}
                        </div>
                        <h1 className="title">Registro de Producto</h1>
                        <p className="subtitle">Ingrese la información de control de calidad del lote.</p>
                    </div>
                    <div className="header-date">
                        <span className="date-label">FECHA ACTUAL</span>
                        <span className="date-value">{getCurrentDate()}</span>
                    </div>
                </div>

                <form onSubmit={handleSubmit} noValidate>
                    {/* Form Fields */}
                    <div className="form-grid">
                        <div className="form-group">
                            <label htmlFor="lote" className="form-label">Lote Interno</label>
                            <input type="text" id="lote"
                                className={`form-control ${form.fieldErrors.loteInterno ? 'is-invalid' : ''}`}
                                value={form.formData.loteInterno}
                                onChange={(e) => form.setFormData((prev) => ({ ...prev, loteInterno: e.target.value }))}
                                required />
                            {form.fieldErrors.loteInterno && <div className="invalid-feedback">{form.fieldErrors.loteInterno}</div>}
                        </div>

                        <div className="form-group">
                            <label htmlFor="loteProducto" className="form-label">Lote de Producto</label>
                            <input type="text" id="loteProducto"
                                className={`form-control ${form.fieldErrors.loteProducto ? 'is-invalid' : ''}`}
                                value={form.formData.loteProducto}
                                onChange={(e) => form.setFormData((prev) => ({ ...prev, loteProducto: e.target.value }))}
                                required />
                            {form.fieldErrors.loteProducto && <div className="invalid-feedback">{form.fieldErrors.loteProducto}</div>}
                        </div>

                        <div className="form-group">
                            <label htmlFor="guia" className="form-label">Guía</label>
                            <input type="text" id="guia"
                                className={`form-control ${form.fieldErrors.guia ? 'is-invalid' : ''}`}
                                value={form.formData.guia}
                                onChange={(e) => form.setFormData((prev) => ({ ...prev, guia: e.target.value }))}
                                required />
                            {form.fieldErrors.guia && <div className="invalid-feedback">{form.fieldErrors.guia}</div>}
                        </div>

                        <div className="form-group">
                            <label htmlFor="marca" className="form-label">Marca</label>
                            <input type="text" id="marca"
                                className={`form-control ${form.fieldErrors.marca ? 'is-invalid' : ''}`}
                                value={form.formData.marca}
                                onChange={(e) => form.setFormData((prev) => ({ ...prev, marca: e.target.value }))}
                                required />
                            {form.fieldErrors.marca && <div className="invalid-feedback">{form.fieldErrors.marca}</div>}
                        </div>

                        <div className="form-group">
                            <label htmlFor="cantidad" className="form-label">Cantidad</label>
                            <input type="number" id="cantidad" min="1"
                                onKeyDown={(e) => { if (e.key === '-' || e.key === 'e' || e.key === 'E') e.preventDefault(); }}
                                className={`form-control ${form.fieldErrors.cantidad ? 'is-invalid' : ''}`}
                                value={form.formData.cantidad}
                                onChange={(e) => form.setFormData((prev) => ({ ...prev, cantidad: e.target.value }))}
                                required />
                            {form.fieldErrors.cantidad && <div className="invalid-feedback">{form.fieldErrors.cantidad}</div>}
                        </div>

                        <div className="form-group">
                            <label htmlFor="producto" className="form-label">Producto</label>
                            <AutocompleteSelect
                                id="producto"
                                options={productos}
                                value={form.formData.productoId}
                                onChange={(value) => form.setFormData((prev) => ({ ...prev, productoId: value }))}
                                placeholder="Buscar producto..."
                                required
                                className={`${form.fieldErrors.productoId ? 'is-invalid' : ''}`}
                            />
                            {form.fieldErrors.productoId && <div className="invalid-feedback d-block">{form.fieldErrors.productoId}</div>}
                        </div>
                    </div>

                    <div className="form-group mt-3">
                        <label htmlFor="verificado_por" className="form-label">Verificado por *</label>
                        <input id="verificado_por" type="text" className="form-control" value={userName} readOnly />
                    </div>

                    {/* Parameters / Controls Section */}
                    {form.formData.productoId && (
                        <div className="mt-4">
                            {form.loadingParametros ? (
                                <div className="text-center py-3">
                                    <span className="spinner-border spinner-border-sm text-primary" role="status" aria-hidden="true"></span>
                                    <span className="ms-2">Cargando parámetros de control...</span>
                                </div>
                            ) : form.parametros.length > 0 ? (
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
                                            {form.parametros.map((param: Parametro, index: number) => (
                                                <tr key={param.id}>
                                                    <td><span className="fw-bold d-block">{param.nombre}</span></td>
                                                    <td>
                                                        <span className="badge bg-primary text-white">
                                                            {param.rango_completo
                                                                ? param.rango_completo
                                                                : param.tipo === 'rango'
                                                                    ? formatRange(param.rango_min, param.rango_max, param.unidad)
                                                                    : param.valor_texto || param.valor}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        {param.tipo === 'rango' || param.tipo === 'numero' || param.es_rango ? (
                                                            <input type="number" step="0.01" min="0"
                                                                onKeyDown={(e) => { if (e.key === '-' || e.key === 'e' || e.key === 'E') e.preventDefault(); }}
                                                                className={`form-control control-input ${form.controles[index]?.fueraDeRango ? 'is-invalid is-invalid-custom' : 'is-valid-custom'}`}
                                                                value={form.controles[index]?.valorControl ?? ''}
                                                                onChange={(e) => form.handleControlChange(index, 'valor', e.target.value)}
                                                                onWheel={(e) => e.currentTarget.blur()}
                                                                placeholder="Ingrese valor..."
                                                                aria-label={`Valor para ${param.nombre}`}
                                                            />
                                                        ) : (
                                                            <input type="text"
                                                                className={`form-control control-input ${form.controles[index]?.fueraDeRango ? 'is-invalid is-invalid-custom' : ''}`}
                                                                value={form.controles[index]?.textoControl ?? ''}
                                                                onChange={(e) => form.handleControlChange(index, 'texto', e.target.value)}
                                                                placeholder="Ingrese resultado..."
                                                                aria-label={`Resultado para ${param.nombre}`}
                                                            />
                                                        )}
                                                        {form.controles[index]?.fueraDeRango && (
                                                            <div className="invalid-feedback d-block">{form.controles[index].mensajeAlerta}</div>
                                                        )}
                                                    </td>
                                                    <td>
                                                        <input type="text" className="form-control"
                                                            value={form.controles[index]?.observacion ?? ''}
                                                            onChange={(e) => form.handleControlChange(index, 'observacion', e.target.value)}
                                                            placeholder="Opcional"
                                                            aria-label={`Observación para ${param.nombre}`}
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
                                    Por favor contacte al administrador para configurar los parámetros en la sección &quot;Gestión de Productos&quot;.
                                </div>
                            )}
                        </div>
                    )}

                    {/* Conclusion */}
                    <div className="form-group mt-3">
                        <label htmlFor="observaciones" className="form-label">Conclusión</label>
                        <textarea id="observaciones" className="form-control" rows={3}
                            value={form.formData.observacionesGenerales}
                            onChange={(e) => form.setFormData((prev) => ({ ...prev, observacionesGenerales: e.target.value }))}
                            placeholder="Conclusión general del registro..."
                        />
                    </div>

                    {/* Photo Upload Section */}
                    <div className="form-group mt-4">
                        <label className="form-label d-flex align-items-center gap-2">
                            <svg className="w-5 h-5 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            Evidencia Fotográfica
                        </label>

                        <div className="photo-grid">
                            {[0, 1].map((index) => (
                                <div key={index} className="photo-card">
                                    <input type="file" id={`foto-${index}`} accept="image/*" style={{ display: 'none' }}
                                        onChange={(e) => camera.handleFileChange(e, index)} />

                                    {camera.fotos[index] ? (
                                        <div className="photo-preview-container">
                                            <img src={camera.fotos[index]?.preview} alt={`Evidencia ${index + 1}`} className="photo-preview-img" />
                                            <button type="button" className="btn-remove-photo" onClick={() => camera.removePhoto(index)}>×</button>
                                        </div>
                                    ) : (
                                        <div className="photo-actions">
                                            <label htmlFor={`foto-${index}`} className="action-btn gallery-btn">
                                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                <span>Galería</span>
                                            </label>
                                            <button type="button" onClick={() => camera.handleCameraRequest(index)} className="action-btn camera-btn" aria-label="Tomar foto con cámara">
                                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                                <span className="text-dark">Cámara</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Hidden input for native mobile camera */}
                        <input ref={camera.nativeCameraInputRef} type="file" accept="image/*" capture="environment"
                            style={{ display: 'none' }} onChange={camera.handleNativeCameraCapture} />
                    </div>

                    {error && <div className="alert alert-danger mt-3">{error}</div>}
                    {success && <div className="alert alert-success mt-3">{success}</div>}

                    {/* Submit Buttons */}
                    {!isOnline ? (
                        <div className="offline-submit-container mt-4 mb-4">
                            <div className="offline-submit-content">
                                <div className="offline-icon-wrapper">
                                    <svg className="w-8 h-8 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                </div>
                                <div className="offline-submit-text text-start">
                                    <h5 className="mb-1 fw-bold text-dark">Guardado Temporal</h5>
                                    <p className="mb-0 text-muted" style={{ fontSize: '0.85rem' }}>
                                        Sin conexión. Este registro se guardará localmente.
                                    </p>
                                </div>
                                <button type="submit" className="btn btn-warning-offline btn-lg submit-offline-btn" disabled={saving}>
                                    {saving ? 'Guardando...' : '⏱️ Guardar Temporalmente'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center mt-4 mb-4">
                            <button type="submit" className="btn btn-success btn-lg px-5" disabled={saving} aria-label="Guardar Registro">
                                {saving ? 'Guardando...' : 'Guardar Registro'}
                            </button>
                        </div>
                    )}
                </form>
            </main>

            {/* Camera Modal */}
            {camera.showCamera && (
                <div className="camera-modal">
                    <div className="camera-content">
                        <div className="camera-header">
                            <h5>Tomar Foto</h5>
                            <button type="button" className="btn-close-camera" onClick={camera.stopCamera}>×</button>
                        </div>
                        <div className="video-container">
                            {!camera.cameraError ? (
                                <video ref={camera.videoRef} autoPlay playsInline muted className="camera-video"></video>
                            ) : (
                                <div className="camera-error-msg">{camera.cameraError}</div>
                            )}
                            <canvas ref={camera.canvasRef} className="d-none"></canvas>
                        </div>
                        <div className="camera-footer">
                            <button type="button" className="btn btn-secondary me-2" onClick={camera.stopCamera}>Cancelar</button>
                            <button type="button" className="btn btn-primary" onClick={camera.capturePhoto} disabled={!!camera.cameraError}>Capturar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Preview Modal */}
            {showPreviewModal && (
                <div className="preview-modal-overlay">
                    <div className="preview-modal-content shadow-lg">
                        <div className={`preview-header ${!isOnline ? 'offline-header' : ''}`}>
                            <h4 className="m-0 d-flex align-items-center gap-2">
                                {!isOnline ? (
                                    <svg className="w-6 h-6 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                ) : (
                                    <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                )}
                                {isOnline ? 'Resumen del Registro' : 'Modo Offline: Guardado Temporal'}
                            </h4>
                        </div>
                        <div className="preview-body p-4">
                            {!isOnline && (
                                <div className="offline-notice-box mb-4">
                                    <div className="offline-notice-icon">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    </div>
                                    <div className="offline-notice-text">
                                        <h5 className="m-0 mb-1 fw-bold text-dark">Alerta de conexión</h5>
                                        <p className="m-0 text-muted" style={{ fontSize: '0.85rem' }}>
                                            Actualmente no tienes conexión a internet. Este registro será guardado
                                            <strong> localmente (temporal) </strong> en este dispositivo.
                                            Recuerda sincronizarlo manualmente desde el panel de &quot;Temporal&quot; cuando recuperes la conexión.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Summary Grid */}
                            <div className="summary-grid">
                                <div className="summary-card product-card">
                                    <div className="summary-content">
                                        <span className="preview-label">Producto</span>
                                        <span className="preview-value fw-bold">
                                            {productos.find((p) => p.id === parseInt(form.formData.productoId))?.nombre || 'N/A'}
                                        </span>
                                    </div>
                                </div>
                                <div className="summary-card"><div className="summary-content"><span className="preview-label">Lote Producto</span><span className="preview-value">{form.formData.loteProducto}</span></div></div>
                                <div className="summary-card"><div className="summary-content"><span className="preview-label">Lote Interno</span><span className="preview-value">{form.formData.loteInterno}</span></div></div>
                                <div className="summary-card"><div className="summary-content"><span className="preview-label">Guía</span><span className="preview-value">{form.formData.guia}</span></div></div>
                                <div className="summary-card"><div className="summary-content"><span className="preview-label">Marca</span><span className="preview-value">{form.formData.marca}</span></div></div>
                                <div className="summary-card"><div className="summary-content"><span className="preview-label">Cantidad</span><span className="preview-value">{form.formData.cantidad} unidades</span></div></div>
                            </div>

                            {/* Out of range warnings */}
                            {form.controles.some((c) => c.fueraDeRango) && (
                                <div className="alert alert-danger d-flex align-items-center gap-2 mb-3">
                                    <i className="bi bi-exclamation-triangle-fill fs-5"></i>
                                    <div>
                                        <strong>Atención:</strong> Hay {form.controles.filter((c) => c.fueraDeRango).length} parámetro(s) fuera de rango.
                                    </div>
                                </div>
                            )}

                            {/* Controls Preview Table */}
                            <div className="table-responsive mb-4">
                                <table className="table table-sm table-bordered preview-table">
                                    <thead>
                                        <tr><th>Parámetro</th><th>Resultado</th><th>Estado</th></tr>
                                    </thead>
                                    <tbody>
                                        {form.controles.map((c, i) => {
                                            const isVacio = c.parametroTipo === 'texto'
                                                ? !c.textoControl || c.textoControl.trim() === ''
                                                : c.valorControl === null || c.valorControl === undefined || c.valorControl.toString().trim() === '';

                                            return (
                                                <tr key={i} className={c.fueraDeRango ? 'table-danger' : isVacio ? 'table-warning' : ''}>
                                                    <td className="fw-medium">{c.parametroNombre}</td>
                                                    <td>
                                                        {c.fueraDeRango ? (
                                                            <div className="d-flex flex-column align-items-start">
                                                                <span className="text-danger fw-bold fs-6">
                                                                    {c.parametroTipo === 'texto' ? (c.textoControl || '(Vacío)') : (c.valorControl ?? '(Vacío)')}
                                                                </span>
                                                                <div className="alert alert-danger p-2 mt-2 mb-0 d-flex align-items-center gap-1" style={{ fontSize: '0.75rem', lineHeight: '1.2' }}>
                                                                    <i className="bi bi-x-circle-fill"></i>
                                                                    <span>{c.mensajeAlerta}</span>
                                                                </div>
                                                            </div>
                                                        ) : isVacio ? (
                                                            <span className="text-warning fw-bold fst-italic">(Vacío)</span>
                                                        ) : (
                                                            <span>{c.parametroTipo === 'texto' ? c.textoControl : c.valorControl}</span>
                                                        )}
                                                    </td>
                                                    <td className="align-middle text-center">
                                                        {c.fueraDeRango ? (
                                                            <span className="status-badge badge-error"><i className="bi bi-x-circle-fill me-1"></i> Revisar</span>
                                                        ) : isVacio ? (
                                                            <span className="status-badge badge-warning"><i className="bi bi-exclamation-triangle-fill me-1"></i> Incompleto</span>
                                                        ) : (
                                                            <span className="status-badge badge-success"><i className="bi bi-check-circle-fill me-1"></i> Correcto</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <div className="preview-footer-info">
                                <div><strong>Conclusión:</strong> {form.formData.observacionesGenerales || 'Ninguna'}</div>
                                <div><strong>Verificado por:</strong> {userName}</div>
                                <div><strong>Evidencias:</strong> {camera.fotos.filter((f) => f?.preview).length} foto(s) adjuntas</div>
                            </div>
                        </div>
                        <div className="preview-actions">
                            <button type="button" className="btn btn-outline-secondary" onClick={() => setShowPreviewModal(false)} disabled={saving}>
                                Editar y Corregir
                            </button>
                            <button type="button" className={`btn ${isOnline ? 'btn-primary' : 'btn-warning-offline'}`} onClick={confirmAndSave} disabled={saving}>
                                {saving ? (
                                    <span><span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Guardando...</span>
                                ) : (
                                    isOnline ? 'Confirmar y Guardar' : (
                                        <span className="d-flex align-items-center gap-2">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '20px', height: '20px' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                                            Guardar Registro Temporal
                                        </span>
                                    )
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
