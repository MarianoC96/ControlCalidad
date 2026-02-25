'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

import AutocompleteSelect from '@/components/AutocompleteSelect';
import { createClient } from '@/lib/supabase/client';
import { getCurrentDate, formatRange, validateRange, validateText } from '@/lib/utils';
import type { Producto, Parametro } from '@/lib/supabase/types';
import { useOnlineStatus } from '@/lib/useOnlineStatus';
import { saveOfflineRecord, cacheProducts, getCachedProducts, getCachedProduct } from '@/lib/temporal-db';
import './registro-productos.css';

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
    const router = useRouter();
    const supabase = createClient();

    const [formData, setFormData] = useState({
        loteInterno: '',
        loteProducto: '',
        guia: '',
        marca: '',
        cantidad: '',
        productoId: '',
        observacionesGenerales: '',
    });

    const [productos, setProductos] = useState<Producto[]>([]);
    const [parametros, setParametros] = useState<Parametro[]>([]);
    const [controles, setControles] = useState<ControlValue[]>([]);
    // Stores both file and its base64 preview for immediate feedback and upload
    const [fotos, setFotos] = useState<({ file: File; preview: string } | null)[]>([null, null]);

    // Camera State
    const [showCamera, setShowCamera] = useState(false);
    const [activePhotoIndex, setActivePhotoIndex] = useState<number | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [cameraError, setCameraError] = useState('');

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [userName, setUserName] = useState('');
    const [userRole, setUserRole] = useState<'administrador' | 'trabajador'>('trabajador');

    const [loadingParametros, setLoadingParametros] = useState(false);
    const [touched, setTouched] = useState(false);
    const [showPreviewModal, setShowPreviewModal] = useState(false);

    // Offline detection
    const { isOnline } = useOnlineStatus();
    const [userId, setUserId] = useState<number | null>(null);

    // Load products on mount
    useEffect(() => {
        loadProductos();
        loadUserInfo();
    }, []);

    const loadUserInfo = async () => {
        // Get user from session/cookie
        try {
            const response = await fetch('/api/auth/me');
            if (response.ok) {
                const data = await response.json();
                setUserName(data.nombre_completo || data.usuario);
                setUserRole(data.roles);
                setUserId(data.id || null);
            }
        } catch {
            // Offline – try to read from cookies
            const cookieName = document.cookie.match(/user_name=([^;]+)/);
            const cookieRole = document.cookie.match(/user_role=([^;]+)/);
            const cookieId = document.cookie.match(/user_id=([^;]+)/);
            if (cookieName) setUserName(decodeURIComponent(cookieName[1]));
            if (cookieRole) {
                const r = decodeURIComponent(cookieRole[1]);
                if (r === 'administrador' || r === 'trabajador') setUserRole(r);
            }
            if (cookieId) setUserId(parseInt(decodeURIComponent(cookieId[1])));
        }
    };

    const loadProductos = async () => {
        try {
            // Usar API segura para evitar problemas de RLS
            const response = await fetch('/api/productos');
            if (!response.ok) throw new Error('Error al cargar productos');

            const data = await response.json();
            setProductos(data || []);
            setLoading(false); // UI is unblocked immediately after products list loads

            // Cache products WITH their parameters for offline use (Background Task)
            setTimeout(async () => {
                try {
                    const paramsRes = await fetch('/api/productos?includeParams=true');
                    if (paramsRes.ok) {
                        const allData = await paramsRes.json();
                        await cacheProducts(allData);
                        console.log('Productos cacheados en masa con parámetros');
                    }
                } catch (e) {
                    console.warn('No se pudo cachear productos básicos en IndexedDB:', e);
                }
            }, 100);

        } catch (err) {
            // If offline, try to load from IndexedDB cache
            try {
                const cached = await getCachedProducts();
                if (cached.length > 0) {
                    setProductos(cached as Producto[]);
                    console.log('Productos cargados desde caché offline');
                } else {
                    setError('Sin conexión y no hay productos en caché');
                }
            } catch {
                setError('Error al cargar productos: ' + (err instanceof Error ? err.message : ''));
            }
            console.error(err);
            setLoading(false);
        }
    };

    const initializeControles = (data: Parametro[]) => {
        const initialControles: ControlValue[] = data.map((param: Parametro) => ({
            parametroNombre: param.nombre,
            rangoCompleto: param.rango_completo
                ? param.rango_completo
                : (param.tipo === 'rango'
                    ? formatRange(param.rango_min, param.rango_max, param.unidad)
                    : param.valor_texto || param.valor || ''),
            valorControl: null,
            textoControl: null,
            parametroTipo: param.tipo,
            observacion: '',
            fueraDeRango: false,
            mensajeAlerta: '',
        }));
        setParametros(data);
        setControles(initialControles);
    };

    const loadParametros = useCallback(async (productoId: string) => {
        if (!productoId) {
            setParametros([]);
            setControles([]);
            return;
        }

        setLoadingParametros(true);
        try {
            // First check if product is already cached with parameters IN MEMORY
            const prodInMemory: any = productos.find(p => p.id === parseInt(productoId));
            if (prodInMemory && prodInMemory.parametros && prodInMemory.parametros.length > 0) {
                initializeControles(prodInMemory.parametros);
                setLoadingParametros(false);
                return;
            }

            // Otherwise, check IndexedDB first (since background sync might have populated it)
            const cachedProd = await getCachedProduct(parseInt(productoId));
            if (cachedProd && cachedProd.parametros && (cachedProd.parametros as Parametro[]).length > 0) {
                initializeControles(cachedProd.parametros as Parametro[]);
                setLoadingParametros(false);
                return;
            }

            // Finally, fall back to online API if not cached yet
            const response = await fetch(`/api/productos?id=${productoId}`);
            if (!response.ok) throw new Error('Error al cargar detalles del producto');

            const productoDetalle = await response.json();
            const data = productoDetalle.parametros || [];
            initializeControles(data);
        } catch (err) {
            setError('Error al cargar parámetros del producto o sin conexión');
            console.error(err);
        } finally {
            setLoadingParametros(false);
        }
    }, [productos]);

    useEffect(() => {
        loadParametros(formData.productoId);
    }, [formData.productoId, loadParametros]);

    const handleControlChange = (index: number, field: 'valor' | 'texto' | 'observacion', value: string) => {
        setControles((prev) => {
            const updated = [...prev];
            const control = updated[index];
            const parametro = parametros[index];

            if (field === 'valor') {
                let numValue = parseFloat(value);

                // Prevent negative values if somehow entered
                if (!isNaN(numValue) && numValue < 0) {
                    numValue = Math.abs(numValue);
                }

                control.valorControl = isNaN(numValue) ? null : numValue;

                // Validate range
                const isRango = parametro.tipo === 'rango' || parametro.es_rango;
                if (isRango && parametro.rango_min !== null && parametro.rango_max !== null) {
                    const validation = validateRange(numValue, parametro.rango_min, parametro.rango_max);
                    control.fueraDeRango = !validation.isValid;
                    control.mensajeAlerta = validation.message;
                }
            } else if (field === 'texto') {
                control.textoControl = value;

                // Validate text match
                const isRango = parametro.tipo === 'rango' || parametro.es_rango;
                const targetText = parametro.valor_texto || parametro.valor;

                if (!isRango && parametro.tipo === 'texto' && targetText) {
                    const validation = validateText(value, targetText);
                    control.fueraDeRango = !validation.isValid;
                    control.mensajeAlerta = validation.message;
                }
            } else {
                control.observacion = value;
            }

            return updated;
        });
    };

    // Mobile Detection
    const [isMobile, setIsMobile] = useState(false);
    const nativeCameraInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
    }, []);

    // Helper to compress image
    const compressImage = async (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 1024;
                    const MAX_HEIGHT = 1024;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.7)); // Compress to JPEG 70%
                };
                img.onerror = (error) => reject(error);
            };
            reader.onerror = (error) => reject(error);
        });
    };

    const processFile = async (file: File, index: number) => {
        try {
            const preview = await compressImage(file);
            setFotos((prev) => {
                const updated = [...prev];
                updated[index] = { file, preview };
                return updated;
            });
        } catch (e) {
            console.error("Error processing file:", e);
            alert("Error al procesar la imagen. Intente con otra.");
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
        const file = e.target.files?.[0];
        if (file) {
            processFile(file, index);
        }
    };

    const handleNativeCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && activePhotoIndex !== null) {
            processFile(file, activePhotoIndex);

            // Reset logic
            setActivePhotoIndex(null);
            if (nativeCameraInputRef.current) nativeCameraInputRef.current.value = '';
        }
    };

    // Camera Functions
    const handleCameraRequest = async (index: number) => {
        setActivePhotoIndex(index);

        if (isMobile) {
            // Trigger native camera input
            nativeCameraInputRef.current?.click();
        } else {
            // Desktop Webcam
            setCameraError('');
            setShowCamera(true);
        }
    };

    useEffect(() => {
        let stream: MediaStream | null = null;
        let track: MediaStreamTrack | null = null;

        const initCamera = async () => {
            if (showCamera && videoRef.current) {
                try {
                    stream = await navigator.mediaDevices.getUserMedia({
                        video: { facingMode: 'environment' } // Prefer back camera on mobile
                    });
                    track = stream.getVideoTracks()[0];
                    if (videoRef.current) {
                        videoRef.current.srcObject = stream;
                    }
                } catch (err) {
                    console.error("Camera access error:", err);
                    setCameraError('No se pudo acceder a la cámara. Verifique los permisos.');
                }
            }
        };

        if (showCamera) {
            initCamera();
        }

        return () => {
            if (track) track.stop();
            if (stream) stream.getTracks().forEach(t => t.stop());
        };
    }, [showCamera]);

    const stopCamera = () => {
        setShowCamera(false);
        setActivePhotoIndex(null);
    };

    const capturePhoto = () => {
        if (videoRef.current && canvasRef.current && activePhotoIndex !== null) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');

            if (context) {
                // Set canvas dimensions to match video
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;

                // Draw
                context.drawImage(video, 0, 0, canvas.width, canvas.height);

                // Convert to file
                canvas.toBlob((blob) => {
                    if (blob) {
                        const file = new File([blob], `captura-${Date.now()}.jpg`, { type: 'image/jpeg' });
                        processFile(file, activePhotoIndex);
                        stopCamera();
                    }
                }, 'image/jpeg', 0.8);
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        // Trigger validation visual feedback
        setTouched(true);

        // Required fields validation
        if (
            !formData.loteInterno ||
            !formData.loteProducto ||
            !formData.guia ||
            !formData.marca ||
            !formData.cantidad ||
            !formData.productoId
        ) {
            // Don't save if required fields are missing
            // The is-invalid class will be applied via state
            setError('Por favor complete los campos obligatorios marcados en rojo.');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        // Show preview modal instead of saving immediately
        setShowPreviewModal(true);
    };

    const confirmAndSave = async () => {
        setSaving(true);

        try {
            // Validate required fields (Redundant safety check)
            if (
                !formData.loteInterno ||
                !formData.loteProducto ||
                !formData.guia ||
                !formData.marca ||
                !formData.cantidad ||
                !formData.productoId
            ) {
                throw new Error('Por favor complete todos los campos requeridos');
            }

            const selectedProduct = productos.find(p => p.id === parseInt(formData.productoId));
            if (!selectedProduct) throw new Error('Producto no encontrado');

            // ─── OFFLINE: Save to IndexedDB ───
            if (!isOnline) {
                const fotosPreviews: string[] = [];
                for (const fotoObj of fotos) {
                    if (fotoObj && fotoObj.preview) {
                        fotosPreviews.push(fotoObj.preview);
                    }
                }

                await saveOfflineRecord({
                    formData: { ...formData },
                    productoNombre: selectedProduct.nombre,
                    controles: controles.map(c => ({ ...c })),
                    fotos: fotosPreviews,
                    verificadoPor: userName,
                    userId: userId,
                    timestamp: new Date().toISOString(),
                    synced: false,
                });

                setSuccess('⏱️ Registro guardado temporalmente (offline). Sincronice desde el módulo Temporal cuando tenga conexión.');

                // Reset form
                setFormData({
                    loteInterno: '',
                    loteProducto: '',
                    guia: '',
                    marca: '',
                    cantidad: '',
                    productoId: '',
                    observacionesGenerales: '',
                });
                setControles([]);
                setFotos([null, null]);
                setTouched(false);
                setShowPreviewModal(false);
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return;
            }

            // ─── ONLINE: Save via API (original flow) ───
            const response = await fetch('/api/registros', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lote_interno: formData.loteInterno,
                    lote_producto: formData.loteProducto,
                    guia: formData.guia,
                    marca: formData.marca,
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
                const fotoObj = fotos[i];
                if (fotoObj && fotoObj.preview) {
                    try {
                        const photoRes = await fetch('/api/fotos', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                registro_id: registro_id,
                                datos_base64: fotoObj.preview,
                                descripcion: `Foto ${i + 1}`
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

            // Reset form
            setFormData({
                loteInterno: '',
                loteProducto: '',
                guia: '',
                marca: '',
                cantidad: '',
                productoId: '',
                observacionesGenerales: '',
            });
            setControles([]);
            setFotos([null, null]);
            setTouched(false);
            setShowPreviewModal(false);
            window.scrollTo({ top: 0, behavior: 'smooth' });

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al guardar');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="page-wrapper">
                <main className="main-content">
                    {/* Skeleton Header */}
                    <div className="header-container shadow-sm border" style={{ minHeight: '100px' }}>
                        <div className="header-info" style={{ width: '60%' }}>
                            <div className="skeleton" style={{ width: '100px', height: '14px', marginBottom: '10px' }}></div>
                            <div className="skeleton" style={{ width: '250px', height: '28px', marginBottom: '8px' }}></div>
                            <div className="skeleton" style={{ width: '320px', height: '14px' }}></div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div className="skeleton" style={{ width: '80px', height: '12px', marginBottom: '6px', marginLeft: 'auto' }}></div>
                            <div className="skeleton" style={{ width: '120px', height: '20px', marginLeft: 'auto' }}></div>
                        </div>
                    </div>
                    {/* Skeleton Form Grid */}
                    <div className="form-grid">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="form-group">
                                <div className="skeleton" style={{ width: '100px', height: '14px', marginBottom: '8px' }}></div>
                                <div className="skeleton" style={{ width: '100%', height: '40px', borderRadius: '6px' }}></div>
                            </div>
                        ))}
                    </div>
                    {/* Skeleton Button */}
                    <div className="text-center mt-4">
                        <div className="skeleton" style={{ width: '200px', height: '48px', borderRadius: '8px', margin: '0 auto' }}></div>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="page-wrapper">


            <main className="main-content">
                {/* Header Premium */}
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
                    <div className="form-grid">
                        <div className="form-group">
                            <label htmlFor="lote" className="form-label">Lote Interno</label>
                            <input
                                type="text"
                                id="lote"
                                className={`form-control ${touched && !formData.loteInterno ? 'is-invalid' : ''}`}
                                value={formData.loteInterno}
                                onChange={(e) => setFormData({ ...formData, loteInterno: e.target.value })}
                                required
                            />
                            {touched && !formData.loteInterno && <div className="invalid-feedback">Campo requerido</div>}
                        </div>

                        <div className="form-group">
                            <label htmlFor="loteProducto" className="form-label">Lote de Producto</label>
                            <input
                                type="text"
                                id="loteProducto"
                                className={`form-control ${touched && !formData.loteProducto ? 'is-invalid' : ''}`}
                                value={formData.loteProducto}
                                onChange={(e) => setFormData({ ...formData, loteProducto: e.target.value })}
                                required
                            />
                            {touched && !formData.loteProducto && <div className="invalid-feedback">Campo requerido</div>}
                        </div>

                        <div className="form-group">
                            <label htmlFor="guia" className="form-label">Guía</label>
                            <input
                                type="text"
                                id="guia"
                                className={`form-control ${touched && !formData.guia ? 'is-invalid' : ''}`}
                                value={formData.guia}
                                onChange={(e) => setFormData({ ...formData, guia: e.target.value })}
                                required
                            />
                            {touched && !formData.guia && <div className="invalid-feedback">Campo requerido</div>}
                        </div>

                        <div className="form-group">
                            <label htmlFor="marca" className="form-label">Marca</label>
                            <input
                                type="text"
                                id="marca"
                                className={`form-control ${touched && !formData.marca ? 'is-invalid' : ''}`}
                                value={formData.marca}
                                onChange={(e) => setFormData({ ...formData, marca: e.target.value })}
                                required
                            />
                            {touched && !formData.marca && <div className="invalid-feedback">Campo requerido</div>}
                        </div>

                        <div className="form-group">

                            <label htmlFor="cantidad" className="form-label">Cantidad</label>
                            <input
                                type="number"
                                id="cantidad"
                                min="1"
                                onKeyDown={(e) => {
                                    if (e.key === '-' || e.key === 'e' || e.key === 'E') e.preventDefault();
                                }}
                                className={`form-control ${touched && !formData.cantidad ? 'is-invalid' : ''}`}
                                value={formData.cantidad}
                                onChange={(e) => setFormData({ ...formData, cantidad: e.target.value })}
                                required
                            />
                            {touched && !formData.cantidad && <div className="invalid-feedback">Campo requerido</div>}
                        </div>

                        <div className="form-group">
                            <label htmlFor="producto" className="form-label">Producto</label>
                            <AutocompleteSelect
                                id="producto"
                                options={productos}
                                value={formData.productoId}
                                onChange={(value) => setFormData({ ...formData, productoId: value })}
                                placeholder="Buscar producto..."
                                required
                                className={`${touched && !formData.productoId ? 'is-invalid' : ''}`}
                            />
                            {touched && !formData.productoId && <div className="invalid-feedback d-block">Campo requerido</div>}
                        </div>
                    </div>

                    <div className="form-group mt-3">
                        <label htmlFor="verificado_por" className="form-label">Verificado por *</label>
                        <input
                            id="verificado_por"
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
                                                    </td>
                                                    <td>
                                                        <span className="badge bg-primary text-white">
                                                            {param.rango_completo
                                                                ? param.rango_completo
                                                                : (param.tipo === 'rango'
                                                                    ? formatRange(param.rango_min, param.rango_max, param.unidad)
                                                                    : param.valor_texto || param.valor)}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        {param.tipo === 'rango' || param.tipo === 'numero' || param.es_rango ? (
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                min="0"
                                                                onKeyDown={(e) => {
                                                                    if (e.key === '-' || e.key === 'e' || e.key === 'E') e.preventDefault();
                                                                }}
                                                                className={`form-control control-input ${controles[index]?.fueraDeRango ? 'is-invalid is-invalid-custom' : 'is-valid-custom'}`}
                                                                value={controles[index]?.valorControl ?? ''}
                                                                onChange={(e) => handleControlChange(index, 'valor', e.target.value)}
                                                                onWheel={(e) => e.currentTarget.blur()}
                                                                placeholder="Ingrese valor..."
                                                                aria-label={`Valor para ${param.nombre}`}
                                                            />
                                                        ) : (
                                                            <input
                                                                type="text"
                                                                className={`form-control control-input ${controles[index]?.fueraDeRango ? 'is-invalid is-invalid-custom' : ''}`}
                                                                value={controles[index]?.textoControl ?? ''}
                                                                onChange={(e) => handleControlChange(index, 'texto', e.target.value)}
                                                                placeholder="Ingrese resultado..."
                                                                aria-label={`Resultado para ${param.nombre}`}
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
                                    Por favor contacte al administrador para configurar los parámetros en la sección "Gestión de Productos".
                                </div>
                            )}
                        </div>
                    )}

                    <div className="form-group mt-3">
                        <label htmlFor="observaciones" className="form-label">Conclusión</label>
                        <textarea
                            id="observaciones"
                            className="form-control"
                            rows={3}
                            value={formData.observacionesGenerales}
                            onChange={(e) => setFormData({ ...formData, observacionesGenerales: e.target.value })}
                            placeholder="Conclusión general del registro..."
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
                                        style={{ display: 'none' }}
                                        onChange={(e) => handleFileChange(e, index)}
                                    />

                                    {fotos[index] ? (
                                        <div className="photo-preview-container">
                                            <img
                                                src={fotos[index]?.preview}
                                                alt={`Evidencia ${index + 1}`}
                                                className="photo-preview-img"
                                            />
                                            <button
                                                type="button"
                                                className="btn-remove-photo"
                                                onClick={() => {
                                                    setFotos(prev => {
                                                        const updated = [...prev];
                                                        updated[index] = null;
                                                        return updated;
                                                    });
                                                    const input = document.getElementById(`foto-${index}`) as HTMLInputElement;
                                                    if (input) input.value = '';
                                                }}
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="photo-actions">
                                            <label htmlFor={`foto-${index}`} className="action-btn gallery-btn">
                                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                <span>Galería</span>
                                            </label>

                                            <button type="button" onClick={() => handleCameraRequest(index)} className="action-btn camera-btn" aria-label="Tomar foto con cámara">
                                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                                <span className="text-dark">Cámara</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}

                        </div>

                        {/* Hidden Input for Native Mobile Camera */}
                        <input
                            ref={nativeCameraInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            style={{ display: 'none' }}
                            onChange={handleNativeCameraCapture}
                        />
                    </div>

                    {error && <div className="alert alert-danger mt-3">{error}</div>}
                    {success && <div className="alert alert-success mt-3">{success}</div>}

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
                                <button
                                    type="submit"
                                    className="btn btn-warning-offline btn-lg submit-offline-btn"
                                    disabled={saving}
                                >
                                    {saving ? 'Guardando...' : '⏱️ Guardar Temporalmente'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center mt-4 mb-4">
                            <button
                                type="submit"
                                className="btn btn-success btn-lg px-5"
                                disabled={saving}
                                aria-label="Guardar Registro"
                            >
                                {saving ? 'Guardando...' : 'Guardar Registro'}
                            </button>
                        </div>
                    )}
                </form>
            </main>

            {/* Camera Modal */}
            {showCamera && (
                <div className="camera-modal">
                    <div className="camera-content">
                        <div className="camera-header">
                            <h5>Tomar Foto</h5>
                            <button type="button" className="btn-close-camera" onClick={stopCamera}>×</button>
                        </div>
                        <div className="video-container">
                            {!cameraError ? (
                                <video ref={videoRef} autoPlay playsInline muted className="camera-video"></video>
                            ) : (
                                <div className="camera-error-msg">{cameraError}</div>
                            )}
                            <canvas ref={canvasRef} className="d-none"></canvas>
                        </div>
                        <div className="camera-footer">
                            <button type="button" className="btn btn-secondary me-2" onClick={stopCamera}>Cancelar</button>
                            <button type="button" className="btn btn-primary" onClick={capturePhoto} disabled={!!cameraError}>Capturar</button>
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
                                            Recuerda sincronizarlo manualmente desde el panel de "Temporal" cuando recuperes la conexión.
                                        </p>
                                    </div>
                                </div>
                            )}
                            <div className="summary-grid">
                                <div className="summary-card product-card">
                                    <div className="summary-content">
                                        <span className="preview-label">Producto</span>
                                        <span className="preview-value fw-bold">
                                            {productos.find(p => p.id === parseInt(formData.productoId))?.nombre || 'N/A'}
                                        </span>
                                    </div>
                                </div>

                                <div className="summary-card">
                                    <div className="summary-content">
                                        <span className="preview-label">Lote Producto</span>
                                        <span className="preview-value">{formData.loteProducto}</span>
                                    </div>
                                </div>

                                <div className="summary-card">
                                    <div className="summary-content">
                                        <span className="preview-label">Lote Interno</span>
                                        <span className="preview-value">{formData.loteInterno}</span>
                                    </div>
                                </div>

                                <div className="summary-card">
                                    <div className="summary-content">
                                        <span className="preview-label">Guía</span>
                                        <span className="preview-value">{formData.guia}</span>
                                    </div>
                                </div>

                                <div className="summary-card">
                                    <div className="summary-content">
                                        <span className="preview-label">Marca</span>
                                        <span className="preview-value">{formData.marca}</span>
                                    </div>
                                </div>

                                <div className="summary-card">
                                    <div className="summary-content">
                                        <span className="preview-label">Cantidad</span>
                                        <span className="preview-value">{formData.cantidad} unidades</span>
                                    </div>
                                </div>
                            </div>

                            {/* Controles Status */}
                            {controles.some(c => c.fueraDeRango) && (
                                <div className="alert alert-danger d-flex align-items-center gap-2 mb-3">
                                    <i className="bi bi-exclamation-triangle-fill fs-5"></i>
                                    <div>
                                        <strong>Atención:</strong> Hay {controles.filter(c => c.fueraDeRango).length} parámetro(s) fuera de rango.
                                    </div>
                                </div>
                            )}

                            <div className="table-responsive mb-4">
                                <table className="table table-sm table-bordered preview-table">
                                    <thead>
                                        <tr>
                                            <th>Parámetro</th>
                                            <th>Resultado</th>
                                            <th>Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {controles.map((c, i) => {
                                            const isVacio = c.parametroTipo === 'texto'
                                                ? !c.textoControl || c.textoControl.trim() === ''
                                                : c.valorControl === null || c.valorControl === undefined || c.valorControl.toString().trim() === '';

                                            return (
                                                <tr key={i} className={c.fueraDeRango ? 'table-danger' : (isVacio ? 'table-warning' : '')}>
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
                                                            <span className="status-badge badge-error">
                                                                <i className="bi bi-x-circle-fill me-1"></i> Revisar
                                                            </span>
                                                        ) : isVacio ? (
                                                            <span className="status-badge badge-warning">
                                                                <i className="bi bi-exclamation-triangle-fill me-1"></i> Incompleto
                                                            </span>
                                                        ) : (
                                                            <span className="status-badge badge-success">
                                                                <i className="bi bi-check-circle-fill me-1"></i> Correcto
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <div className="preview-footer-info">
                                <div><strong>Conclusión:</strong> {formData.observacionesGenerales || 'Ninguna'}</div>
                                <div><strong>Verificado por:</strong> {userName}</div>
                                <div><strong>Evidencias:</strong> {fotos.filter(f => f?.preview).length} foto(s) adjuntas</div>
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
