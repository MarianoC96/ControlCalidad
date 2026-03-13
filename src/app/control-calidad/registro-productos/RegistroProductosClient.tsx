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

    return (
        <div className="page-wrapper animate-in">
            {/* Ambient Background */}
            <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
                <div className="absolute -top-[10%] -right-[10%] w-[40%] h-[40%] bg-emerald-50 rounded-full blur-[120px] opacity-40"></div>
                <div className="absolute -bottom-[10%] -left-[10%] w-[40%] h-[40%] bg-slate-100 rounded-full blur-[120px] opacity-40"></div>
            </div>

            <main className="main-content">
                {/* Offline Banner Moderno */}
                {!isOnline && (
                    <div className="bg-rose-600 text-white p-4 rounded-3xl mb-8 flex items-center gap-4 shadow-xl shadow-rose-200 animate-pulse border-none">
                        <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-xl">
                            <i className="bi bi-wifi-off"></i>
                        </div>
                        <div>
                            <div className="font-black text-xs uppercase tracking-widest opacity-80 mb-0.5">Estado: Desconectado</div>
                            <div className="text-sm font-bold">Modo Offline Activo. Los datos se guardarán localmente en su dispositivo.</div>
                        </div>
                    </div>
                )}

                {/* Header Premium */}
                <div className="header-container">
                    <div className="header-info">
                        <div className="badge-system">
                            <span className="dot-pulse" style={!isOnline ? { background: '#ef4444' } : {}}></span>
                            {isOnline ? 'REGISTRO DE CALIDAD' : 'REGISTRO OFFLINE'}
                        </div>
                        <h1 className="title">Registro de Producto</h1>
                        <p className="subtitle">Gestión centralizada de inspección para el control de lotes y trazabilidad.</p>
                    </div>
                    <div className="header-date">
                        <span className="date-label">Fecha de Auditoría</span>
                        <span className="date-value">{getCurrentDate()}</span>
                    </div>
                </div>

                <form onSubmit={handleSubmit} noValidate>
                    {/* Campos de Identificación */}
                    <div className="form-grid">
                        <div className="form-group">
                            <label htmlFor="lote" className="form-label">Lote Interno System</label>
                            <input type="text" id="lote"
                                className={`form-control ${form.fieldErrors.loteInterno ? 'is-invalid' : ''}`}
                                value={form.formData.loteInterno}
                                onChange={(e) => form.setFormData((prev: any) => ({ ...prev, loteInterno: e.target.value }))}
                                placeholder="Ej: LI-2024-001"
                                required />
                            {form.fieldErrors.loteInterno && <div className="invalid-feedback">{form.fieldErrors.loteInterno}</div>}
                        </div>

                        <div className="form-group">
                            <label htmlFor="loteProducto" className="form-label">Lote Fabricante / Producto</label>
                            <input type="text" id="loteProducto"
                                className={`form-control ${form.fieldErrors.loteProducto ? 'is-invalid' : ''}`}
                                value={form.formData.loteProducto}
                                onChange={(e) => form.setFormData((prev: any) => ({ ...prev, loteProducto: e.target.value }))}
                                placeholder="Ej: L-45678"
                                required />
                            {form.fieldErrors.loteProducto && <div className="invalid-feedback">{form.fieldErrors.loteProducto}</div>}
                        </div>

                        <div className="form-group">
                            <label htmlFor="guia" className="form-label">Guía de Remisión</label>
                            <input type="text" id="guia"
                                className={`form-control ${form.fieldErrors.guia ? 'is-invalid' : ''}`}
                                value={form.formData.guia}
                                onChange={(e) => form.setFormData((prev: any) => ({ ...prev, guia: e.target.value }))}
                                placeholder="001-000123"
                                required />
                            {form.fieldErrors.guia && <div className="invalid-feedback">{form.fieldErrors.guia}</div>}
                        </div>

                        <div className="form-group">
                            <label htmlFor="marca" className="form-label">Marca del Producto</label>
                            <input type="text" id="marca"
                                className={`form-control ${form.fieldErrors.marca ? 'is-invalid' : ''}`}
                                value={form.formData.marca}
                                onChange={(e) => form.setFormData((prev: any) => ({ ...prev, marca: e.target.value }))}
                                placeholder="Ej: El Olivar"
                                required />
                            {form.fieldErrors.marca && <div className="invalid-feedback">{form.fieldErrors.marca}</div>}
                        </div>

                        <div className="form-group">
                            <label htmlFor="cantidad" className="form-label">Cantidad (Unidades)</label>
                            <input type="number" id="cantidad" min="1"
                                onKeyDown={(e) => { if (e.key === '-' || e.key === 'e' || e.key === 'E') e.preventDefault(); }}
                                className={`form-control ${form.fieldErrors.cantidad ? 'is-invalid' : ''}`}
                                value={form.formData.cantidad}
                                onChange={(e) => form.setFormData((prev: any) => ({ ...prev, cantidad: e.target.value }))}
                                placeholder="0"
                                required />
                            {form.fieldErrors.cantidad && <div className="invalid-feedback">{form.fieldErrors.cantidad}</div>}
                        </div>

                        <div className="form-group">
                            <label htmlFor="producto" className="form-label">Selección de Producto</label>
                            <AutocompleteSelect
                                id="producto"
                                options={productos}
                                value={form.formData.productoId}
                                onChange={(value: any) => form.setFormData((prev: any) => ({ ...prev, productoId: value }))}
                                placeholder="Escriba para buscar producto..."
                                required
                                className={`${form.fieldErrors.productoId ? 'is-invalid' : ''}`}
                            />
                            {form.fieldErrors.productoId && <div className="invalid-feedback d-block">{form.fieldErrors.productoId}</div>}
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-[2rem] border border-[#f1f5f9] shadow-sm mb-8 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400">
                                <i className="bi bi-person-badge-fill text-xl"></i>
                            </div>
                            <div>
                                <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest block mb-0.5">Inspector de Turno</span>
                                <span className="text-sm font-black text-slate-700">{userName}</span>
                            </div>
                        </div>
                        <div className="bg-emerald-50 px-4 py-2 rounded-xl text-emerald-700 text-[10px] font-black uppercase tracking-widest border border-emerald-100">
                            Firma Digital Activa
                        </div>
                    </div>

                    {/* Parameters / Controls Section */}
                    {form.formData.productoId && (
                        <div className="mt-4">
                            {form.loadingParametros ? (
                                <div className="bg-white p-12 rounded-[2rem] border border-[#f1f5f9] shadow-sm text-center">
                                    <div className="w-12 h-12 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4"></div>
                                    <span className="text-sm font-black text-slate-400 uppercase tracking-widest">Sincronizando Parámetros...</span>
                                </div>
                            ) : form.parametros.length > 0 ? (
                                <div className="table-container">
                                    <h4>Variables de Control de Calidad</h4>
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
                                                    <td data-label="Parámetro"><span className="fw-bold d-block text-slate-800">{param.nombre}</span></td>
                                                    <td data-label="Rango / Valor Esperado">
                                                        <span className="badge-result">
                                                            {param.rango_completo
                                                                ? param.rango_completo
                                                                : param.tipo === 'rango'
                                                                    ? formatRange(param.rango_min, param.rango_max, param.unidad)
                                                                    : param.valor_texto || param.valor}
                                                        </span>
                                                    </td>
                                                    <td data-label="Resultado Control">
                                                        {param.tipo === 'rango' || param.tipo === 'numero' || param.es_rango ? (
                                                            <input type="number" step="0.01" min="0"
                                                                onKeyDown={(e) => { if (e.key === '-' || e.key === 'e' || e.key === 'E') e.preventDefault(); }}
                                                                className={`form-control control-input ${form.controles[index]?.fueraDeRango ? 'is-invalid' : ''}`}
                                                                value={form.controles[index]?.valorControl ?? ''}
                                                                onChange={(e) => form.handleControlChange(index, 'valor', e.target.value)}
                                                                onWheel={(e) => e.currentTarget.blur()}
                                                                placeholder="0.00"
                                                                aria-label={`Valor para ${param.nombre}`}
                                                            />
                                                        ) : (
                                                            <input type="text"
                                                                className={`form-control control-input ${form.controles[index]?.fueraDeRango ? 'is-invalid' : ''}`}
                                                                value={form.controles[index]?.textoControl ?? ''}
                                                                onChange={(e) => form.handleControlChange(index, 'texto', e.target.value)}
                                                                placeholder="Muestra..."
                                                                aria-label={`Resultado para ${param.nombre}`}
                                                            />
                                                        )}
                                                        {form.controles[index]?.fueraDeRango && (
                                                            <div className="text-[10px] font-black text-rose-600 uppercase tracking-tighter mt-1">{form.controles[index].mensajeAlerta}</div>
                                                        )}
                                                    </td>
                                                    <td data-label="Observaciones">
                                                        <input type="text" className="form-control"
                                                            value={form.controles[index]?.observacion ?? ''}
                                                            onChange={(e) => form.handleControlChange(index, 'observacion', e.target.value)}
                                                            placeholder="Anotación..."
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

                    {/* Conclusión y Evidencia fotográfica - Stacked para mayor claridad */}
                    <div className="flex flex-col gap-10 mb-10">
                        {/* Bloque Conclusión */}
                        <div className="conclusion-box m-0">
                            <label htmlFor="observaciones" className="form-label">Conclusión de Inspección</label>
                            <textarea id="observaciones" className="form-control" rows={4}
                                value={form.formData.observacionesGenerales}
                                onChange={(e) => form.setFormData((prev: any) => ({ ...prev, observacionesGenerales: e.target.value }))}
                                placeholder="Escriba los detalles finales de la inspección..."
                            />
                        </div>

                        {/* Bloque Evidencia */}
                        <div className="bg-white p-10 rounded-[2rem] border border-[#f1f5f9] shadow-sm">
                            <label className="form-label d-flex align-items-center gap-2 mb-8">
                                <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
                                    <i className="bi bi-camera-fill text-emerald-600"></i>
                                </div>
                                <span className="font-black text-slate-700 uppercase tracking-widest text-xs">Evidencia Fotográfica de Control</span>
                            </label>

                            <div className="photo-grid">
                                {[0, 1].map((index) => (
                                    <div key={index} className="photo-card m-0">
                                        <input type="file" id={`foto-${index}`} accept="image/*" style={{ display: 'none' }}
                                            onChange={(e) => camera.handleFileChange(e, index)} />

                                        {camera.fotos[index] ? (
                                            <div className="photo-preview-container">
                                                <img src={camera.fotos[index]?.preview} alt={`Evidencia ${index + 1}`} className="photo-preview-img" />
                                                <button type="button" className="btn-remove-photo" onClick={() => camera.removePhoto(index)}>×</button>
                                            </div>
                                        ) : (
                                            <div className="photo-actions">
                                                <label htmlFor={`foto-${index}`} className="action-btn gallery-btn cursor-pointer">
                                                    <i className="bi bi-images text-xl"></i>
                                                    <span className="text-[10px] font-black uppercase tracking-wider">Galería</span>
                                                </label>
                                                <button type="button" onClick={() => camera.handleCameraRequest(index)} className="action-btn camera-btn border-none" aria-label="Tomar foto con cámara">
                                                    <i className="bi bi-camera-fill text-xl"></i>
                                                    <span className="text-[10px] font-black uppercase tracking-wider">Cámara</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div className="bg-rose-50 text-rose-700 p-4 rounded-2xl mb-6 border border-rose-100 flex items-center gap-3 animate-in slide-in-from-top-4">
                            <i className="bi bi-exclamation-octagon-fill"></i>
                            <span className="text-sm font-bold">{error}</span>
                        </div>
                    )}
                    
                    {success && (
                        <div className="bg-emerald-50 text-emerald-700 p-4 rounded-2xl mb-6 border border-emerald-100 flex items-center gap-3 animate-in slide-in-from-top-4">
                            <i className="bi bi-check-circle-fill"></i>
                            <span className="text-sm font-bold">{success}</span>
                        </div>
                    )}

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
                        <div className="submit-container">
                            <button type="submit" className="btn btn-success" disabled={saving} aria-label="Guardar Registro">
                                {saving ? 'Guardando...' : (
                                    <>
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        Finalizar Registro
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </form>
            </main>
                      {/* Camera Modal - Estilo Historial */}
            {camera.showCamera && (
                <div className="fixed inset-0 z-[7000] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={camera.stopCamera}></div>
                    <div className="relative bg-black rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 flex flex-col w-full max-w-lg" style={{ zIndex: 10 }}>
                        <div className="p-4 sm:p-5 bg-[#1e293b] flex justify-between items-center flex-shrink-0">
                            <h5 className="text-white font-black uppercase tracking-widest text-sm m-0 flex items-center gap-2">
                                <i className="bi bi-camera-fill"></i> Tomar Evidencia
                            </h5>
                            <button type="button" className="w-8 h-8 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center transition-colors border-0" onClick={camera.stopCamera}>
                                <i className="bi bi-x-lg text-xs"></i>
                            </button>
                        </div>
                        <div className="relative aspect-[4/3] bg-black flex items-center justify-center overflow-hidden">
                            {!camera.cameraError ? (
                                <video ref={camera.videoRef} autoPlay playsInline muted className="w-full h-full object-cover"></video>
                            ) : (
                                <div className="p-8 text-center">
                                    <i className="bi bi-exclamation-triangle text-amber-500 text-4xl mb-4 block"></i>
                                    <p className="text-white text-sm font-medium">{camera.cameraError}</p>
                                </div>
                            )}
                            <canvas ref={camera.canvasRef} className="hidden"></canvas>
                        </div>
                        <div className="p-4 sm:p-5 bg-[#1a1c1e] flex justify-end gap-3 flex-shrink-0">
                            <button type="button" className="px-5 py-2 rounded-xl font-bold text-xs text-white bg-white/10 hover:bg-white/20 transition-colors border-0" onClick={camera.stopCamera}>
                                Cancelar
                            </button>
                            <button type="button" className="px-6 py-2 rounded-xl font-bold text-xs bg-white text-black hover:bg-slate-200 transition-colors border-0 flex items-center gap-2 shadow-lg" onClick={camera.capturePhoto} disabled={!!camera.cameraError}>
                                <i className="bi bi-camera"></i> Capturar Foto
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Preview Modal - Estilo Historial */}
            {showPreviewModal && (
                <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-[#0f172a]/80 backdrop-blur-sm" onClick={() => setShowPreviewModal(false)}></div>
                    <div className="relative bg-[#f1f5f9] rounded-3xl shadow-2xl animate-in zoom-in-95 flex flex-col w-full max-w-2xl max-h-[90vh]" style={{ zIndex: 10 }}>
                        
                        {/* Header Estilo Historial */}
                        <div className={`p-5 sm:p-6 flex justify-between items-start border-b border-[#e2e8f0] flex-shrink-0 rounded-t-3xl ${!isOnline ? 'bg-amber-50' : 'bg-white'}`}>
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-inner shrink-0 ${!isOnline ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                                    <i className={`bi ${!isOnline ? 'bi-cloud-slash-fill' : 'bi-clipboard-check-fill'}`}></i>
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-[#1e293b] uppercase tracking-tighter m-0">
                                        {isOnline ? 'Resumen del Registro' : 'Guardado Temporal'}
                                    </h3>
                                    <p className={`text-[10px] font-bold uppercase tracking-widest mt-1 mb-0 ${!isOnline ? 'text-amber-600' : 'text-[#64748b]'}`}>
                                        {isOnline ? 'Control de Calidad' : 'Offline - Se sincronizará luego'}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setShowPreviewModal(false)} className="w-10 h-10 rounded-full bg-[#f8fafc] hover:bg-red-50 hover:text-red-500 flex items-center justify-center text-[#1e293b] transition-all border-0 shadow-sm active:scale-95">
                                <i className="bi bi-x-lg text-sm"></i>
                            </button>
                        </div>

                        {/* Body Scrollable */}
                        <div className="flex-1 overflow-y-auto p-5 sm:p-6 custom-scrollbar">
                            {!isOnline && (
                                <div className="bg-amber-100/50 border border-amber-200 rounded-2xl p-4 mb-6 flex items-start gap-4 animate-pulse">
                                    <i className="bi bi-info-circle-fill text-amber-600 text-xl shrink-0"></i>
                                    <div>
                                        <p className="text-amber-900 font-bold text-sm mb-1 leading-tight uppercase tracking-tight">Sin Conexión a Internet</p>
                                        <p className="text-amber-800 text-xs font-medium leading-relaxed m-0">
                                            Este registro se guardará **localmente**. No olvides sincronizarlo desde el módulo "Temporal" cuando tengas conexión.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Info Principal */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                                <div className="col-span-2 bg-white p-4 rounded-2xl border border-[#e2e8f0] shadow-sm flex flex-col justify-center">
                                    <span className="text-[10px] text-[#94a3b8] font-bold uppercase tracking-widest leading-tight block mb-1">Carga Producto</span>
                                    <span className="text-sm font-black text-[#1e293b] truncate uppercase">
                                        {productos.find((p) => p.id === parseInt(form.formData.productoId))?.nombre || 'N/A'}
                                    </span>
                                </div>
                                <div className="bg-white p-4 rounded-2xl border border-[#e2e8f0] shadow-sm flex flex-col justify-center items-center text-center">
                                    <span className="text-[10px] text-[#94a3b8] font-bold uppercase tracking-widest leading-tight block mb-1">Cantidad</span>
                                    <span className="text-sm font-black text-[#1e293b]">{form.formData.cantidad} <span className="text-[10px] text-slate-400">UND</span></span>
                                </div>
                                
                                <div className="bg-white p-3 rounded-2xl border border-[#e2e8f0] shadow-sm text-center">
                                    <span className="text-[9px] text-[#94a3b8] font-bold uppercase tracking-widest leading-tight block mb-1">Lote Interno</span>
                                    <span className="text-xs font-bold text-slate-700">{form.formData.loteInterno}</span>
                                </div>
                                <div className="bg-white p-3 rounded-2xl border border-[#e2e8f0] shadow-sm text-center">
                                    <span className="text-[9px] text-[#94a3b8] font-bold uppercase tracking-widest leading-tight block mb-1">Lote Producto</span>
                                    <span className="text-xs font-bold text-slate-700">{form.formData.loteProducto}</span>
                                </div>
                                <div className="bg-white p-3 rounded-2xl border border-[#e2e8f0] shadow-sm text-center">
                                    <span className="text-[9px] text-[#94a3b8] font-bold uppercase tracking-widest leading-tight block mb-1">Marca / Guía</span>
                                    <span className="text-xs font-bold text-slate-700 truncate block">{form.formData.marca} / {form.formData.guia}</span>
                                </div>
                            </div>

                            {/* Alerta de parámetros fuera de rango */}
                            {form.controles.some((c) => c.fueraDeRango) && (
                                <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 mb-6 flex items-center gap-3">
                                    <div className="w-10 h-10 bg-rose-500 text-white rounded-full flex items-center justify-center text-lg shrink-0 shadow-lg shadow-rose-500/20">
                                        <i className="bi bi-exclamation-triangle"></i>
                                    </div>
                                    <div>
                                        <p className="text-rose-900 font-black text-sm uppercase tracking-tighter leading-none m-0">¡Alerta de Calidad!</p>
                                        <p className="text-rose-600 text-[10px] font-bold uppercase mt-1 tracking-widest m-0">
                                            {form.controles.filter((c) => c.fueraDeRango).length} Parámetros Críticos Detectados
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Tabla de Parámetros */}
                            <div className="bg-white rounded-2xl border border-[#e2e8f0] overflow-hidden shadow-sm mb-6">
                                <div className="p-3 bg-slate-50 border-b border-[#e2e8f0] flex items-center gap-2">
                                    <i className="bi bi-list-check text-slate-500 font-bold"></i>
                                    <span className="font-bold text-[#1e293b] text-[10px] uppercase tracking-widest">Resultado de Parámetros</span>
                                </div>
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                                        <tr>
                                            <th className="px-4 py-2 font-bold text-[#64748b] text-[9px] uppercase tracking-widest">Variable</th>
                                            <th className="px-4 py-2 font-bold text-[#64748b] text-[9px] uppercase tracking-widest">Resultado</th>
                                            <th className="px-4 py-2 font-bold text-center text-[#64748b] text-[9px] uppercase tracking-widest w-[80px]">Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#f1f5f9]">
                                        {form.controles.map((c, i) => {
                                            const isVacio = c.parametroTipo === 'texto' 
                                                ? !c.textoControl?.trim() 
                                                : c.valorControl === null || c.valorControl?.toString().trim() === '';
                                            
                                            return (
                                                <tr key={i} className={`hover:bg-slate-50 transition-colors ${c.fueraDeRango ? 'bg-rose-50/30' : ''}`}>
                                                    <td className="px-4 py-3 font-bold text-[#1a2b3c]">{c.parametroNombre}</td>
                                                    <td className="px-4 py-3 font-medium">
                                                        {c.fueraDeRango ? (
                                                            <div className="flex flex-col gap-1">
                                                                <span className="text-rose-600 font-black text-sm uppercase">
                                                                    {c.parametroTipo === 'texto' ? c.textoControl : c.valorControl}
                                                                </span>
                                                                <span className="bg-rose-100 text-rose-700 text-[9px] font-bold px-2 py-0.5 rounded-full inline-block w-fit">
                                                                    {c.mensajeAlerta}
                                                                </span>
                                                            </div>
                                                        ) : isVacio ? (
                                                            <span className="text-amber-500 font-black italic uppercase text-[9px]">Omitido</span>
                                                        ) : (
                                                            <span className="text-slate-600 font-bold">
                                                                {c.parametroTipo === 'texto' ? c.textoControl : c.valorControl}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <div className={`w-6 h-6 rounded-full mx-auto flex items-center justify-center text-xs shadow-sm ${
                                                            c.fueraDeRango ? 'bg-rose-500 text-white' : isVacio ? 'bg-amber-400 text-white' : 'bg-emerald-500 text-white'
                                                        }`}>
                                                            <i className={`bi ${c.fueraDeRango ? 'bi-x' : isVacio ? 'bi-exclamation' : 'bi-check'}`}></i>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Footer del body info */}
                            <div className="space-y-4">
                                <div className="bg-[#f8fafc] p-4 rounded-2xl border border-[#e2e8f0]">
                                    <span className="text-[10px] text-[#94a3b8] font-bold uppercase tracking-widest block mb-1">Conclusión General</span>
                                    <p className="text-sm font-bold text-[#334155] m-0 italic">
                                        "{form.formData.observacionesGenerales || 'Sin observaciones adicionales'}"
                                    </p>
                                </div>
                                <div className="flex items-center justify-between px-2">
                                    <span className="text-[10px] text-[#64748b] font-bold uppercase tracking-widest">
                                        Inspector: <span className="text-[#1e293b]">{userName}</span>
                                    </span>
                                    <span className="bg-slate-100 text-[#475569] px-3 py-1 rounded-full text-[9px] font-black uppercase border border-slate-200">
                                        {camera.fotos.filter(f => f?.preview).length} Evidencias
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 sm:p-5 bg-white border-t border-[#e2e8f0] flex justify-end gap-3 flex-shrink-0 rounded-b-3xl">
                            <button
                                type="button"
                                disabled={saving}
                                onClick={() => setShowPreviewModal(false)}
                                className="px-6 py-2.5 rounded-xl font-bold text-sm text-[#64748b] bg-[#f1f5f9] hover:bg-[#e2e8f0] transition-colors border-0"
                            >
                                Regresar
                            </button>
                            <button
                                type="button"
                                disabled={saving}
                                onClick={confirmAndSave}
                                className={`px-8 py-2.5 rounded-xl font-black text-sm text-white transition-all shadow-lg border-0 flex items-center gap-2 ${
                                    isOnline ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30' : 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/30'
                                }`}
                            >
                                {saving ? (
                                    <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> Procesando...</>
                                ) : (
                                    <>
                                        <i className={`bi ${isOnline ? 'bi-cloud-upload' : 'bi-cloud-minus'}`}></i>
                                        {isOnline ? 'Confirmar Registro' : 'Guardar Temporal'}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
