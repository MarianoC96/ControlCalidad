'use client';

import React, { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';

import { createClient } from '@/lib/supabase/client';
import { formatDate, normalizeString } from '@/lib/utils';
import type { Registro, Control, Foto } from '@/lib/supabase/types';
import dynamic from 'next/dynamic';

const BulkDownloadModal = dynamic(() => import('@/components/BulkDownloadModal'), { ssr: false });
const DownloadHistory = dynamic(() => import('@/components/DownloadHistory'), { ssr: false });
import LoadingOverlay from '@/components/LoadingOverlay';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface RegistroWithDetails extends Registro {
    controles?: Control[];
    fotos?: Foto[];
}

export default function RegistrosClient() {
    const router = useRouter();
    const supabase = createClient();

    const [globalPdfConfig, setGlobalPdfConfig] = useState<any>(null);
    const [userName, setUserName] = useState('');
    const [userRole, setUserRole] = useState<'administrador' | 'trabajador'>('trabajador');
    const [selectedRegistro, setSelectedRegistro] = useState<RegistroWithDetails | null>(null);
    const [downloadingId, setDownloadingId] = useState<number | null>(null);
    const [zoomImage, setZoomImage] = useState<{ url: string, description?: string } | null>(null);
    const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);

    // Edit Workflow State
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editingRegistro, setEditingRegistro] = useState<RegistroWithDetails | null>(null);
    const [editLockInfo, setEditLockInfo] = useState<{ expiresAt: string, startedAt: string } | null>(null);
    const [editPassword, setEditPassword] = useState('');
    const [editHistory, setEditHistory] = useState<any[]>([]);
    const [editPhotos, setEditPhotos] = useState<{ data: string, description: string, filename: string }[]>([]);
    const [photosToDelete, setPhotosToDelete] = useState<number[]>([]);
    const [editError, setEditError] = useState('');
    const [editSuccess, setEditSuccess] = useState('');
    const [timeLeft, setTimeLeft] = useState('');
    const [selectedHistoryDetail, setSelectedHistoryDetail] = useState<any>(null);

    // Edit field state
    const [editFields, setEditFields] = useState<{
        lote_interno: string;
        lote_producto: string;
        guia: string;
        marca: string;
        cantidad: string;
    }>({ lote_interno: '', lote_producto: '', guia: '', marca: '', cantidad: '' });

    // Request Edit Permission State
    const [requestModalOpen, setRequestModalOpen] = useState(false);
    const [requestRegistroId, setRequestRegistroId] = useState<number | null>(null);
    const [requestMotivo, setRequestMotivo] = useState('');
    const [isRequesting, setIsRequesting] = useState(false);
    const [hasSolicitudesPermission, setHasSolicitudesPermission] = useState(false);


    // Filters
    // Filters
    // Filters
    const [selectedYear, setSelectedYear] = useState<string>('');
    const [selectedMonth, setSelectedMonth] = useState<string>('');

    // Search & Pagination
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [limit, setLimit] = useState(25);
    const [page, setPage] = useState(1);

    // SWR Data Fetching
    const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(selectedYear && { year: selectedYear }),
        ...(selectedMonth && { month: selectedMonth }),
        ...(debouncedSearch && { search: debouncedSearch })
    }).toString();

    const { data: swrResponse, error: swrError, isLoading: swrIsLoading, isValidating, mutate } = useSWR(
        `/api/registros?${queryParams}`,
        fetcher,
        {
            keepPreviousData: true,
            dedupingInterval: 5000,       // Don't re-fetch same URL within 5s
            revalidateOnFocus: false,      // Don't refetch when tab gains focus
            revalidateOnReconnect: false,  // Don't refetch on reconnect
        }
    );

    const registros = swrResponse?.data || [];
    const meta = swrResponse?.meta || {};
    const loading = swrIsLoading && !swrResponse; // Solo usar loading pantalla completa si no hay datos previos
    const totalPages = meta.totalPages || 0;
    // For auto-selection we use the available years/months from our backend
    const availableYears: number[] = meta.availableYears || [];
    const availableMonths: number[] = meta.availableMonths || [];

    // Reset page on filter change
    useEffect(() => {
        setPage(1);
    }, [selectedYear, selectedMonth, debouncedSearch]);

    // Debounce Search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    useEffect(() => {
        checkAuth();
        loadGlobalPdfConfig();
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
        setHasSolicitudesPermission(user.hasSolicitudesPermission || false);
    };


    const loadGlobalPdfConfig = async () => {
        try {
            const res = await fetch('/api/config/pdf');
            if (res.ok) {
                const data = await res.json();
                setGlobalPdfConfig(data);
            }
        } catch (err) {
            console.error('Error loading pdf config', err);
        }
    };

    const fetchDetails = async (registroId: number) => {
        const response = await fetch(`/api/registros/detalles?id=${registroId}`);
        if (!response.ok) return { controles: [], fotos: [] };
        return await response.json();
    };

    // Timer Effect
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (editModalOpen && editLockInfo?.expiresAt) {
            interval = setInterval(() => {
                const now = new Date();
                const expires = new Date(editLockInfo.expiresAt);
                const diff = expires.getTime() - now.getTime();

                if (diff <= 0) {
                    setTimeLeft('Expirado');
                    if (userRole === 'trabajador') {
                        setEditError('El tiempo de edición ha expirado. Contacte a un administrador.');
                    }
                    clearInterval(interval);
                } else {
                    const minutes = Math.floor(diff / 60000);
                    const seconds = Math.floor((diff % 60000) / 1000);
                    setTimeLeft(`${minutes}:${seconds < 10 ? '0' : ''}${seconds}`);
                }
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [editModalOpen, editLockInfo, userRole]);

    const [passwordModalOpen, setPasswordModalOpen] = useState(false);
    const [passwordInput, setPasswordInput] = useState('');
    const [pendingEditRegistro, setPendingEditRegistro] = useState<RegistroWithDetails | null>(null);

    const handleEdit = async (registro: RegistroWithDetails) => {
        setEditError('');
        setEditSuccess('');

        // Direct edit if has specific permission (includes sadmin and authorized admins)
        if (hasSolicitudesPermission) {
            setPendingEditRegistro(registro);
            setPasswordInput('');
            setPasswordModalOpen(true);
        } else {

            // Otherwise, attempt to lock (will return canRequest if needed)
            executeEditLock(registro, '');
        }
    };


    const handlePasswordSubmit = () => {
        if (pendingEditRegistro) {
            executeEditLock(pendingEditRegistro, passwordInput);
            setPasswordModalOpen(false);
            setPendingEditRegistro(null);
            setPasswordInput('');
        }
    };

    const executeEditLock = async (registro: RegistroWithDetails, password: string) => {
        try {
            const res = await fetch('/api/registros/lock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    registro_id: registro.id,
                    password: password
                })
            });
            const data = await res.json();

            if (!res.ok) {
                if (data.canRequest) {
                    setRequestRegistroId(registro.id);
                    setRequestMotivo('');
                    setRequestModalOpen(true);
                } else if (data.requirePassword) {
                    alert(data.error);
                } else {
                    alert(data.error || 'Error al iniciar edición');
                }
                return;
            }
            setEditLockInfo({ expiresAt: data.expiresAt, startedAt: data.startedAt });
            if (password) setEditPassword(password);

            // Fetch History and Details in PARALLEL (not sequential)
            const [histRes, details] = await Promise.all([
                fetch(`/api/registros/history?id=${registro.id}`).then(r => r.ok ? r.json() : []),
                fetchDetails(registro.id)
            ]);

            setEditHistory(histRes);
            setEditingRegistro({ ...registro, ...details });
            setEditPhotos([]);
            setPhotosToDelete([]);
            setEditFields({
                lote_interno: registro.lote_interno || '',
                lote_producto: registro.lote_producto || '',
                guia: registro.guia || '',
                marca: registro.marca || '',
                cantidad: String(registro.cantidad || ''),
            });
            setEditModalOpen(true);

        } catch (err: any) {
            alert(err.message);
        }
    };

    const handleRequestSubmit = async () => {
        if (!requestRegistroId) return;

        setIsRequesting(true);
        try {
            const reqRes = await fetch('/api/registros/request-edit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    registro_id: requestRegistroId,
                    motivo: requestMotivo
                })
            });
            const reqData = await reqRes.json();
            if (reqRes.ok) {
                alert('Solicitud enviada correctamente. Espera a que un administrador la apruebe.');
                setRequestModalOpen(false);
            } else {
                alert(reqData.error || 'Error al enviar solicitud');
            }
        } catch (error) {
            alert('Error de conexión al enviar la solicitud');
        } finally {
            setIsRequesting(false);
        }
    };

    const handleCancelEdit = async () => {
        if (!editingRegistro) return;
        try {
            await fetch('/api/registros/unlock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ registro_id: editingRegistro.id })
            });
        } catch (err) {
            console.error(err);
        }
        setEditModalOpen(false);
        setEditingRegistro(null);
        setEditLockInfo(null);
        setEditPassword('');
        setPhotosToDelete([]);
        setEditPhotos([]);
    };

    const handleSaveEdit = async () => {
        if (!editingRegistro) return;
        setEditError('');

        try {
            const res = await fetch('/api/registros/edit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    registro_id: editingRegistro.id,
                    photos: editPhotos,
                    photosToDelete: photosToDelete,
                    password: editPassword,
                    lote_interno: editFields.lote_interno,
                    lote_producto: editFields.lote_producto,
                    guia: editFields.guia,
                    marca: editFields.marca,
                    cantidad: editFields.cantidad,
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            alert('Cambios guardados exitosamente');
            setEditModalOpen(false);
            setEditingRegistro(null);
            mutate(); // Refresh list

        } catch (err: any) {
            setEditError(err.message);
        }
    };

    const handleEditPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        // Check limits
        const currentCount = (editingRegistro?.fotos?.length || 0);
        const newCount = editPhotos.length;
        if (currentCount + newCount + files.length > 2) {
            alert(`Límite de fotos excedido. Máximo total: 2. Actualmente: ${currentCount + newCount}`);
            return;
        }

        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onloadend = () => {
                setEditPhotos(prev => [...prev, {
                    data: reader.result as string,
                    description: '',
                    filename: file.name
                }]);
            };
            reader.readAsDataURL(file);
        });
    };

    const viewDetails = async (registro: Registro) => {
        const { controles, fotos } = await fetchDetails(registro.id);

        setSelectedRegistro({
            ...registro,
            controles,
            fotos,
        });
    };

    const handleDownloadPDF = async (registro: Registro) => {
        try {
            setDownloadingId(registro.id);

            // If we already have the details loaded (e.g. from modal), use them
            let controles = [];
            let fotos = [];

            if (selectedRegistro && selectedRegistro.id === registro.id) {
                controles = selectedRegistro.controles || [];
                fotos = selectedRegistro.fotos || [];
            } else {
                // Otherwise fetch them
                const details = await fetchDetails(registro.id);
                controles = details.controles;
                fotos = details.fotos;
            }

            const registroCompleto = {
                ...registro,
                controles,
                fotos
            };

            const { generateRegistroPDF } = await import('@/lib/pdf-generator');
            await generateRegistroPDF(registroCompleto);
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Error al generar el PDF. Por favor intente nuevamente.');
        } finally {
            setDownloadingId(null);
        }
    };

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/');
    };

    // Auto-select latest year/month on load or when invalid
    useEffect(() => {
        if (!swrIsLoading && availableYears.length > 0) {
            const yearInt = parseInt(selectedYear);
            if (!selectedYear || !availableYears.includes(yearInt)) {
                setSelectedYear(availableYears[0].toString());
            }
        }
    }, [swrIsLoading, availableYears, selectedYear]);

    useEffect(() => {
        if (!swrIsLoading && availableMonths.length > 0) {
            const monthInt = parseInt(selectedMonth);
            if (!selectedMonth || !availableMonths.includes(monthInt)) {
                // Select latest month available
                setSelectedMonth(availableMonths[availableMonths.length - 1].toString());
            }
        }
    }, [swrIsLoading, availableMonths, selectedMonth]);

    const MONTH_NAMES = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    // Filter Logic is now handled by the API (SWR)
    const filteredRegistros: RegistroWithDetails[] = registros;

    if (loading) {
        return <LoadingOverlay message="Obteniendo Registros Históricos..." />;
    }

    return (
        <>


            <main className="historial-page-container">
                {/* Header Premium */}
                <div className="header-container shadow-sm border">
                    <div className="header-info">
                        <div className="badge-system"><span className="dot-pulse"></span>CONTROL DE CALIDAD</div>
                        <h1 className="title">Historial de Registros</h1>
                        <p className="subtitle">Consulte y gestione todos los registros de productos verificados.</p>
                    </div>
                    <div className="header-stats">
                        <div className="stat-pill">
                            <span className="val">{registros.length}</span>
                            <span className="lab">TOTAL</span>
                        </div>
                        <button className="btn-add-premium shadow-sm" onClick={() => setIsDownloadModalOpen(true)}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" style={{ marginRight: '8px' }}>
                                <path d="M4.406 1.342A5.53 5.53 0 0 1 8 0c2.69 0 4.923 2 5.166 4.579C14.758 4.804 16 6.137 16 7.773 16 9.569 14.502 11 12.687 11H10a.5.5 0 0 1 0-1h2.688C13.979 10 15 8.988 15 7.773c0-1.216-1.02-2.228-2.313-2.228h-.5v-.5C12.188 2.825 10.328 1 8 1a4.53 4.53 0 0 0-2.941 1.1c-.757.652-1.153 1.438-1.153 2.055v.448l-.445.049C2.064 4.805 1 5.952 1 7.318 1 8.785 2.23 10 3.781 10H6a.5.5 0 0 1 0 1H3.781C1.708 11 0 9.366 0 7.318c0-1.763 1.266-3.223 2.942-3.593.143-.863.698-1.723 1.464-2.383z" />
                                <path d="M7.646 15.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 14.293V5.5a.5.5 0 0 0-1 0v8.793l-2.146-2.147a.5.5 0 0 0-.708.708l3 3z" />
                            </svg>
                            <span>Descarga Masiva</span>
                        </button>
                    </div>
                </div>


                <div className="card shadow-sm border-0 bg-white" style={{ borderRadius: '12px', minHeight: '600px' }}>
                    <div className="card-body p-4">

                        {/* Toolbar */}
                        <div className="toolbar-row">
                            {/* Left Side: Filters */}
                            <div className="toolbar-filters">
                                <select
                                    className="form-select form-select-sm rounded-pill border-secondary-subtle bg-light text-secondary fw-medium shadow-none"
                                    value={selectedYear}
                                    onChange={(e) => setSelectedYear(e.target.value)}
                                    aria-label="Año"
                                    style={{ width: 'auto' }}
                                >
                                    {availableYears.map(year => (
                                        <option key={year} value={year}>{year}</option>
                                    ))}
                                </select>

                                <select
                                    className="form-select form-select-sm rounded-pill border-secondary-subtle bg-light text-secondary fw-medium shadow-none"
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(e.target.value)}
                                    aria-label="Mes"
                                    style={{ width: 'auto' }}
                                >
                                    {availableMonths.map(monthIndex => (
                                        <option key={monthIndex} value={monthIndex}>{MONTH_NAMES[monthIndex]}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Right Side: Search */}
                            <div className="toolbar-search">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" className="search-icon" viewBox="0 0 16 16">
                                    <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z" />
                                </svg>
                                <input
                                    type="text"
                                    className="form-control border-secondary-subtle rounded-pill text-secondary shadow-none bg-light"
                                    placeholder="Buscar registro..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    style={{ fontSize: '0.9rem', backgroundColor: '#f8f9fa', paddingLeft: '35px' }}
                                />
                            </div>
                        </div>

                        {/* List Content */}
                        {/* Desktop Table */}
                        <div className="desktop-table">
                            <div className="table-responsive">
                                <table className="table table-hover mb-0 align-middle">
                                    <thead className="table-light text-secondary text-uppercase small">
                                        <tr>
                                            <th className="ps-3 fw-semibold text-secondary">ID</th>
                                            <th className="fw-semibold text-secondary">Fecha</th>
                                            <th className="fw-semibold text-secondary">Lote Interno</th>
                                            <th className="fw-semibold text-secondary">Producto</th>
                                            <th className="fw-semibold text-secondary">Verificado por</th>
                                            <th className="text-end pe-3 fw-semibold text-secondary">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredRegistros.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="text-center py-5 text-muted">
                                                    {!selectedYear || !selectedMonth ? "Seleccione año y mes para ver los registros." : "No se encontraron registros con los filtros actuales."}
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredRegistros.map((registro) => {
                                                const d = new Date(registro.fecha_registro);
                                                const mes = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'][d.getMonth()];
                                                const displayId = `${mes}${String(registro.id).padStart(4, '0')}`;

                                                return (
                                                    <tr key={registro.id}>
                                                        <td className="ps-3 fw-bold text-primary">{displayId}</td>
                                                        <td className="text-muted fw-medium">
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                                                <span>{formatDate(registro.fecha_registro).split(',')[0]}</span>
                                                                {registro.es_offline && (
                                                                    <span
                                                                        title={`Capturado offline | Sincronizado el ${registro.fecha_sincronizacion ? formatDate(registro.fecha_sincronizacion) : 'N/A'}`}
                                                                        style={{ cursor: 'help', fontSize: '1.05rem', lineHeight: 1 }}
                                                                    >
                                                                        ☁️✅
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="fw-bold text-dark">{registro.lote_interno}</td>
                                                        <td className="text-dark">{registro.producto_nombre}</td>
                                                        <td className="text-secondary small">{registro.verificado_por || registro.usuario_nombre}</td>
                                                        <td className="text-end pe-3">
                                                            <div className="d-flex justify-content-end gap-2">
                                                                <button className="btn btn-sm btn-link text-primary p-0" onClick={() => viewDetails(registro)} title="Ver detalles">
                                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z" /><path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z" /></svg>
                                                                </button>
                                                                <button className="btn btn-sm btn-link text-warning p-0 ms-2" onClick={() => handleEdit(registro)} title="Editar">
                                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M15.502 1.94a.5.5 0 0 1 0 .706L14.459 3.69l-2-2L13.502.646a.5.5 0 0 1 .707 0l1.293 1.293zm-1.75 2.456-2-2L4.939 9.21a.5.5 0 0 0-.121.196l-.805 2.414a.25.25 0 0 0 .316.316l2.414-.805a.5.5 0 0 0 .196-.12l6.813-6.814z" /><path fillRule="evenodd" d="M1 13.5A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-6a.5.5 0 0 0-1 0v6a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5H9a.5.5 0 0 0 0-1H2.5A1.5 1.5 0 0 0 1 2.5v11z" /></svg>
                                                                </button>
                                                                <button className="btn btn-sm btn-link text-secondary p-0 ms-2" onClick={() => handleDownloadPDF(registro)} disabled={downloadingId === registro.id} title="PDF">
                                                                    {downloadingId === registro.id ? <span className="spinner-border spinner-border-sm"></span> : <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M14 14V4.5L9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2zM9.5 3A1.5 1.5 0 0 0 11 4.5h2V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5.5v2z" /><path d="M4.603 14.087a.81.81 0 0 1-.438-.42c-.195-.388-.13-.776.08-1.102.198-.307.526-.568.897-.787a7.68 7.68 0 0 1 1.482-.645 19.697 19.697 0 0 0 1.062-2.227 7.269 7.269 0 0 1-.43-1.295c-.086-.4-.119-.796-.046-1.136.075-.354.274-.672.65-.823.192-.077.4-.12.602-.077a.7.7 0 0 1 .477.365c.088.164.12.356.127.538.007.188-.012.396-.047.614-.084.51-.27 1.134-.52 1.794a10.954 10.954 0 0 0 .98 1.686 5.753 5.753 0 0 1 1.334.05c.364.066.734.195.96.465.12.144.193.32.2.518.007.192-.047.382-.138.563a1.04 1.04 0 0 1-.354.416.856.856 0 0 1-.51.138c-.331-.014-.654-.196-.933-.417a5.712 5.712 0 0 1-.911-.95 11.651 11.651 0 0 0-1.997.406 11.305 11.305 0 0 1-1.02 1.51c-.292.35-.609.656-.927.787a.793.793 0 0 1-.58.029z" /></svg>}
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
                        </div>

                        {/* Mobile Cards */}
                        <div className="mobile-cards">
                            {filteredRegistros.length === 0 ? (
                                <div className="text-center py-5 text-muted">
                                    {!selectedYear || !selectedMonth ? "Seleccione año y mes para ver los registros." : "No se encontraron registros con los filtros actuales."}
                                </div>
                            ) : (
                                filteredRegistros.map((registro) => {
                                    const d = new Date(registro.fecha_registro);
                                    const mes = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'][d.getMonth()];
                                    const displayId = `${mes}${String(registro.id).padStart(4, '0')}`;

                                    return (
                                        <div key={registro.id} className="mobile-card">
                                            <div className="mobile-card-header">
                                                <span className="mobile-card-lote text-primary fw-bold">{displayId} | {registro.lote_interno}</span>
                                                <span className="mobile-card-date">
                                                    {formatDate(registro.fecha_registro).split(',')[0]}
                                                    {registro.es_offline && (
                                                        <span
                                                            title={`Capturado offline | Sincronizado el ${registro.fecha_sincronizacion ? formatDate(registro.fecha_sincronizacion) : 'N/A'}`}
                                                            style={{ marginLeft: '4px', cursor: 'help', fontSize: '1rem', lineHeight: 1 }}
                                                        >
                                                            ☁️✅
                                                        </span>
                                                    )}
                                                </span>
                                            </div>
                                            <div className="mobile-card-body">
                                                <span className="mobile-card-product">{registro.producto_nombre}</span>
                                                <span className="mobile-card-user">{registro.verificado_por || registro.usuario_nombre}</span>
                                            </div>
                                            <div className="mobile-card-actions">
                                                <button className="mobile-action-btn view" onClick={() => viewDetails(registro)}>👁 Ver</button>
                                                <button className="mobile-action-btn edit" onClick={() => handleEdit(registro)}>✏️ Editar</button>
                                                <button className="mobile-action-btn pdf" onClick={() => handleDownloadPDF(registro)} disabled={downloadingId === registro.id}>
                                                    {downloadingId === registro.id ? '...' : '📄 PDF'}
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>

                        {/* Footer Controls */}
                        <div className="d-flex justify-content-between align-items-center mt-4 pt-3 border-top flex-wrap gap-3">
                            {/* Pagination Controls */}
                            <div className="d-flex align-items-center gap-3 bg-light rounded-pill px-2 py-1 border border-secondary-subtle">
                                <button
                                    className="btn-pagination"
                                    disabled={page <= 1}
                                    onClick={() => setPage(page - 1)}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                        <path fillRule="evenodd" d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z" />
                                    </svg>
                                    Anterior
                                </button>
                                <span className="pagination-info">Pág. {page} de {totalPages || 1}</span>
                                <button
                                    className="btn-pagination"
                                    disabled={page >= totalPages}
                                    onClick={() => setPage(page + 1)}
                                >
                                    Siguiente
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                        <path fillRule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z" />
                                    </svg>
                                </button>
                            </div>

                            <div className="d-flex align-items-center gap-2">
                                <span className="small text-muted text-nowrap">Mostrar filas:</span>
                                <select
                                    className="form-select form-select-sm rounded-pill border-secondary-subtle bg-light text-secondary fw-medium shadow-none"
                                    value={limit}
                                    onChange={(e) => {
                                        setLimit(parseInt(e.target.value));
                                        setPage(1);
                                    }}
                                    style={{ width: '75px', height: '40px' }}
                                >
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                </select>
                            </div>
                        </div>

                    </div>
                </div>
            </main >

            {/* Detail Modal */}
            {
                isDownloadModalOpen && (
                    <BulkDownloadModal
                        onClose={() => setIsDownloadModalOpen(false)}
                        onSuccess={() => {
                            // Optionally refresh history if we had a ref, or just let the user see it update via polling
                        }}
                    />
                )
            }



            {selectedRegistro && (
                <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-[#0f172a]/80 backdrop-blur-sm" onClick={() => setSelectedRegistro(null)}></div>
                    <div className="relative bg-[#f8fafc] rounded-[2.5rem] shadow-2xl animate-in zoom-in-95 flex flex-col w-full max-w-4xl max-h-[95vh]" style={{ zIndex: 10 }}>
                        
                        {/* Modal Header */}
                        <div className="p-6 sm:p-8 bg-white flex justify-between items-center border-b border-[#e2e8f0] flex-shrink-0 rounded-t-[2.5rem]">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-xl shadow-inner shrink-0 border border-blue-100">
                                    <i className="bi bi-file-earmark-text-fill"></i>
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-[#1e293b] uppercase tracking-tighter m-0">Detalle del Registro</h3>
                                    <p className="text-[#64748b] text-[10px] font-bold uppercase tracking-widest mt-1 m-0">Información técnica y técnica del lote</p>
                                </div>
                            </div>
                            <button onClick={() => setSelectedRegistro(null)} className="w-10 h-10 rounded-full bg-[#f8fafc] text-[#64748b] hover:bg-red-50 hover:text-red-500 flex items-center justify-center transition-all border-0 shadow-sm active:scale-90">
                                <i className="bi bi-x-lg text-lg"></i>
                            </button>
                        </div>

                        <div className="p-6 sm:p-8 overflow-y-auto flex-grow custom-scrollbar space-y-8">
                            {/* PDF Header Preview Snapshot if applicable */}
                            {(() => {
                                const CUTOFF_DATE = new Date('2025-01-29T00:00:00');
                                const isNewFormat = selectedRegistro.pdf_codigo || new Date(selectedRegistro.fecha_registro) >= CUTOFF_DATE;
                                if (!isNewFormat) return null;

                                const headerToShow = {
                                    titulo: selectedRegistro.pdf_titulo || globalPdfConfig?.titulo || 'REPORTE DE CONTROL DE CALIDAD',
                                    codigo: selectedRegistro.pdf_codigo || globalPdfConfig?.codigo || 'PE C - CC001',
                                    edicion: selectedRegistro.pdf_edicion || globalPdfConfig?.edicion || 'ED. 01',
                                    aprobado_por: selectedRegistro.pdf_aprobado_por || globalPdfConfig?.aprobado_por || 'Aprob. J. Calidad'
                                };

                                return (
                                    <div className="animate-in fade-in duration-500">
                                        <div className="flex items-center gap-2 mb-3">
                                            <i className="bi bi-eye-fill text-blue-500"></i>
                                            <span className="text-[10px] font-black text-[#475569] uppercase tracking-widest">Vista Previa Reporte Oficial</span>
                                        </div>
                                        <div className="border-2 border-slate-900 rounded-sm overflow-hidden flex w-full shadow-lg bg-white h-[90px] sm:h-[100px]">
                                            <div className="w-[25%] border-r-2 border-slate-900 flex items-center justify-center p-2 sm:p-4">
                                                <img src="/logo.png" alt="Logo" className="max-h-full max-w-full object-contain" />
                                            </div>
                                            <div className="w-[55%] border-r-2 border-slate-900 flex items-center justify-center p-2 sm:p-4 text-center">
                                                <h4 className="m-0 font-black text-[10px] sm:text-xs md:text-sm text-slate-900 leading-tight uppercase tracking-tight">{headerToShow.titulo}</h4>
                                            </div>
                                            <div className="w-[20%] flex flex-col font-black text-[8px] sm:text-[10px] text-slate-900">
                                                <div className="flex-1 border-b-2 border-slate-900 flex items-center justify-center">{headerToShow.codigo}</div>
                                                <div className="flex-1 border-b-2 border-slate-900 flex items-center justify-center">{headerToShow.edicion}</div>
                                                <div className="flex-1 flex items-center justify-center text-center p-1 uppercase">
                                                    {(() => {
                                                        const original = headerToShow.aprobado_por || '';
                                                        if (/^\d{4}-\d{2}-\d{2}$/.test(original)) {
                                                            const [y, m, d] = original.split('-');
                                                            return `${d}-${m}-${y}`;
                                                        }
                                                        return original;
                                                    })()}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Main Info Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 bg-white p-6 sm:p-8 rounded-[2rem] border border-[#e2e8f0] shadow-sm relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 opacity-50 rounded-bl-full -z-0 pointer-events-none"></div>
                                <div className="space-y-1 relative z-10">
                                    <span className="block text-[10px] font-bold text-[#94a3b8] uppercase tracking-widest">Lote Interno</span>
                                    <span className="block text-lg font-black text-[#1e293b] truncate uppercase">{selectedRegistro.lote_interno}</span>
                                </div>
                                <div className="space-y-1 relative z-10">
                                    <span className="block text-[10px] font-bold text-[#94a3b8] uppercase tracking-widest">Guía de Remisión</span>
                                    <span className="block text-lg font-black text-[#1e293b] truncate">{selectedRegistro.guia || 'SIN GUÍA'}</span>
                                </div>
                                <div className="space-y-1 relative z-10">
                                    <span className="block text-[10px] font-bold text-[#94a3b8] uppercase tracking-widest">Fecha Registro</span>
                                    <span className="flex items-center gap-2 text-[#1e293b] font-black text-sm">
                                        <i className="bi bi-calendar3 text-blue-500"></i>
                                        {formatDate(selectedRegistro.fecha_registro)}
                                    </span>
                                </div>
                                <div className="space-y-1 relative z-10">
                                    <span className="block text-[10px] font-bold text-[#94a3b8] uppercase tracking-widest">Producto</span>
                                    <span className="block text-[#1e293b] font-bold text-sm leading-tight">{selectedRegistro.producto_nombre}</span>
                                </div>
                                <div className="space-y-1 relative z-10">
                                    <span className="block text-[10px] font-bold text-[#94a3b8] uppercase tracking-widest">Cantidad</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl font-black text-[#1e293b] leading-none">{selectedRegistro.cantidad}</span>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Unidades</span>
                                    </div>
                                </div>
                                <div className="space-y-1 relative z-10">
                                    <span className="block text-[10px] font-bold text-[#94a3b8] uppercase tracking-widest">Responsable</span>
                                    <span className="flex items-center gap-2 text-[#1e293b] font-bold text-sm">
                                        <i className="bi bi-person-check-fill text-blue-500"></i>
                                        {selectedRegistro.verificado_por || selectedRegistro.usuario_nombre}
                                    </span>
                                </div>
                            </div>

                            {/* Connection status if applicable */}
                            {selectedRegistro.es_offline && (
                                <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex items-center gap-3 animate-pulse">
                                    <i className="bi bi-cloud-check-fill text-emerald-500 text-xl"></i>
                                    <div>
                                        <span className="block text-[10px] font-black text-emerald-700 uppercase tracking-widest">Registro Sincronizado</span>
                                        <span className="text-xs font-semibold text-emerald-600 opacity-90">Capturado localmente y subido el {selectedRegistro.fecha_sincronizacion ? formatDate(selectedRegistro.fecha_sincronizacion) : 'N/A'}</span>
                                    </div>
                                </div>
                            )}

                            {/* Observations Section */}
                            {selectedRegistro.observaciones_generales && (
                                <div className="bg-amber-50/50 p-6 rounded-[2rem] border border-amber-100/50 relative">
                                    <div className="absolute top-4 right-6 text-amber-200/50 text-4xl rotate-12">
                                        <i className="bi bi-quote"></i>
                                    </div>
                                    <h4 className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-3 m-0">Observaciones Generales</h4>
                                    <p className="text-sm font-semibold text-amber-900/80 italic leading-relaxed m-0">"{selectedRegistro.observaciones_generales}"</p>
                                </div>
                            )}

                            {/* Controls Table Section */}
                            {selectedRegistro.controles && selectedRegistro.controles.length > 0 && (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-end">
                                        <div className="flex items-center gap-2">
                                            <i className="bi bi-activity text-blue-600"></i>
                                            <h4 className="text-[10px] font-black text-[#1e293b] uppercase tracking-widest m-0">Parámetros de Control</h4>
                                        </div>
                                        <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded uppercase">Total: {selectedRegistro.controles.length}</span>
                                    </div>
                                    <div className="bg-white rounded-[2rem] border border-[#e2e8f0] overflow-hidden shadow-sm">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left text-xs border-collapse">
                                                <thead className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                                                    <tr>
                                                        <th className="px-5 py-4 font-black text-[#64748b] uppercase tracking-widest">Variable</th>
                                                        <th className="px-5 py-4 font-black text-[#64748b] uppercase tracking-widest">Rango Esperado</th>
                                                        <th className="px-5 py-4 font-black text-[#64748b] uppercase tracking-widest">Valor Medido</th>
                                                        <th className="px-5 py-4 font-black text-[#64748b] uppercase tracking-widest">Validación</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-[#f1f5f9]">
                                                    {selectedRegistro.controles.map((control) => (
                                                        <tr key={control.id} className="hover:bg-slate-50/80 transition-colors">
                                                            <td className="px-5 py-4">
                                                                <div className="font-bold text-[#1e293b] truncate max-w-[150px]">{control.parametro_nombre}</div>
                                                                {control.observacion && <div className="text-[9px] text-slate-400 mt-0.5 line-clamp-1 italic">{control.observacion}</div>}
                                                            </td>
                                                            <td className="px-5 py-4 font-bold text-slate-500 font-mono tracking-tighter">{control.rango_completo}</td>
                                                            <td className="px-5 py-4">
                                                                <span className="bg-slate-100 text-slate-700 font-black px-3 py-1.5 rounded-lg text-sm shadow-inner">
                                                                    {control.valor_control !== null ? control.valor_control : control.texto_control || '-'}
                                                                </span>
                                                            </td>
                                                            <td className="px-5 py-4">
                                                                {(() => {
                                                                    const isVacio = control.valor_control === null && !control.texto_control;
                                                                    if (control.fuera_de_rango) return <span className="bg-red-50 text-red-600 border border-red-100 px-3 py-1.5 rounded-xl font-black text-[9px] uppercase tracking-widest inline-flex items-center gap-1"><i className="bi bi-x-circle-fill"></i> Fuera de Rango</span>;
                                                                    if (isVacio && control.rango_completo) return <span className="bg-amber-50 text-amber-600 border border-amber-100 px-3 py-1.5 rounded-xl font-black text-[9px] uppercase tracking-widest inline-flex items-center gap-1"><i className="bi bi-clock-fill"></i> Incompleto</span>;
                                                                    return <span className="bg-emerald-50 text-emerald-600 border border-emerald-100 px-3 py-1.5 rounded-xl font-black text-[9px] uppercase tracking-widest inline-flex items-center gap-1"><i className="bi bi-check-circle-fill"></i> Correcto</span>;
                                                                })()}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Photos Grid Section */}
                            {selectedRegistro.fotos && selectedRegistro.fotos.length > 0 && (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2">
                                        <i className="bi bi-camera-fill text-blue-600"></i>
                                        <h4 className="text-[10px] font-black text-[#1e293b] uppercase tracking-widest m-0">Evidencias Fotográficas</h4>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                        {selectedRegistro.fotos.map((foto) => (
                                            <div
                                                key={foto.id}
                                                className="group relative bg-white border border-[#e2e8f0] rounded-[1.5rem] overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 cursor-zoom-in"
                                                onClick={() => setZoomImage({ url: foto.datos_base64, description: foto.descripcion || '' })}
                                            >
                                                <div className="aspect-square bg-slate-50 relative">
                                                    <img
                                                        src={foto.datos_base64}
                                                        alt={foto.descripcion || `Evidencia ${foto.id}`}
                                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                                    />
                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                                        <i className="bi bi-plus-circle text-white text-3xl opacity-0 group-hover:opacity-100 transition-opacity scale-50 group-hover:scale-100 transition-transform"></i>
                                                    </div>
                                                </div>
                                                {foto.descripcion && (
                                                    <div className="p-3 bg-white/90 backdrop-blur-sm border-t border-[#f1f5f9]">
                                                        <p className="text-[9px] font-bold text-slate-600 m-0 line-clamp-2 leading-tight text-center uppercase tracking-tight">{foto.descripcion}</p>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 sm:p-8 bg-white border-t border-[#e2e8f0] flex flex-col sm:flex-row justify-between items-center gap-4 flex-shrink-0 rounded-b-[2.5rem]">
                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                <i className="bi bi-clock"></i> Registro: {selectedRegistro.id}
                            </div>
                            <div className="flex gap-4 w-full sm:w-auto">
                                <button
                                    className="flex-1 sm:flex-none px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-[0.15em] bg-[#f8fafc] text-[#64748b] hover:bg-[#f1f5f9] transition-all border-0"
                                    onClick={() => setSelectedRegistro(null)}
                                >
                                    Cerrar
                                </button>
                                <button
                                    className="flex-1 sm:flex-none px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-[0.15em] bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-3 border-0 active:scale-95"
                                    onClick={() => handleDownloadPDF(selectedRegistro)}
                                    disabled={downloadingId === selectedRegistro.id}
                                >
                                    {downloadingId === selectedRegistro.id ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                            Generando...
                                        </>
                                    ) : (
                                        <>
                                            <i className="bi bi-file-earmark-pdf-fill"></i>
                                            Descargar Reporte
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Password Verification Modal */}
            {
                passwordModalOpen && (
                    <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-[#0f172a]/80 backdrop-blur-sm" onClick={() => setPasswordModalOpen(false)}></div>
                        <div className="relative bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95" style={{ zIndex: 10 }}>
                            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mb-4 mx-auto text-xl">
                                <i className="bi bi-shield-lock-fill"></i>
                            </div>
                            <h3 className="text-xl font-black text-[#1e293b] mb-2 text-center uppercase tracking-tighter">Credenciales</h3>
                            <p className="text-[#64748b] text-sm mb-6 text-center">Para editar este registro como administrador, por favor confirme su identidad.</p>
                            <input
                                type="password"
                                placeholder="Tu contraseña..."
                                value={passwordInput}
                                onChange={e => setPasswordInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' ? handlePasswordSubmit() : null}
                                autoFocus
                                className="w-full text-center tracking-widest bg-[#f8fafc] border border-[#cbd5e1] rounded-xl p-3 text-[#1e293b] focus:border-red-500 outline-none transition-colors mb-6"
                            />
                            <div className="flex gap-3 justify-center">
                                <button onClick={() => setPasswordModalOpen(false)} className="w-full px-5 py-2.5 rounded-xl font-bold text-sm text-[#64748b] hover:bg-[#f1f5f9] transition-colors border-0 bg-transparent">
                                    Cancelar
                                </button>
                                <button onClick={handlePasswordSubmit} disabled={!passwordInput} className="w-full px-5 py-2.5 rounded-xl font-bold text-sm bg-red-500 text-white hover:bg-red-600 transition-colors shadow-lg shadow-red-500/30 border-0 disabled:opacity-50">
                                    Desbloquear
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Request Edit Permission Modal */}
            {
                requestModalOpen && (
                    <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-[#0f172a]/80 backdrop-blur-sm" onClick={() => setRequestModalOpen(false)}></div>
                        <div className="relative bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95" style={{ zIndex: 10 }}>
                            <div className="flex justify-between items-start mb-6 border-b border-[#e2e8f0] pb-4">
                                <div>
                                    <h3 className="text-xl font-black text-[#1e293b] uppercase tracking-tighter flex items-center gap-2 m-0">
                                        <i className="bi bi-person-plus-fill text-orange-500"></i> Solicitar Edición
                                    </h3>
                                </div>
                                <button onClick={() => setRequestModalOpen(false)} className="w-8 h-8 rounded-full bg-[#f1f5f9] text-[#64748b] hover:bg-orange-100 hover:text-orange-500 flex items-center justify-center transition-colors border-0">
                                    <i className="bi bi-x-lg"></i>
                                </button>
                            </div>
                            <div className="space-y-4 mb-6 text-start">
                                <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 mb-4">
                                    <p className="text-sm font-semibold text-orange-800 tracking-wide m-0">
                                        Para editar este registro, debes enviar una solicitud a los administradores para que la autoricen.
                                    </p>
                                </div>
                                <label className="block text-xs font-bold text-[#1e293b] uppercase tracking-widest mb-1.5 mt-4 text-start w-full">Motivo de la solicitud *</label>
                                <textarea
                                    className="w-full bg-[#f8fafc] border border-[#cbd5e1] focus:border-orange-500 rounded-xl p-3 text-sm text-[#1e293b] outline-none transition-colors resize-none mb-2"
                                    rows={3}
                                    placeholder="Explica brevemente por qué necesitas realizar cambios..."
                                    value={requestMotivo}
                                    onChange={(e) => setRequestMotivo(e.target.value)}
                                    required
                                />
                                <p className="text-[#94a3b8] text-xs font-semibold m-0 text-start">Los administradores revisarán tu solicitud para decidir si la aprueban.</p>
                            </div>
                            <div className="flex gap-3 justify-end mt-6">
                                <button onClick={() => setRequestModalOpen(false)} className="px-5 py-2.5 rounded-xl font-bold text-sm text-[#64748b] hover:bg-[#f1f5f9] transition-colors border-0 bg-transparent">
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleRequestSubmit}
                                    disabled={isRequesting || !requestMotivo.trim()}
                                    className="px-5 py-2.5 rounded-xl font-bold text-sm bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 transition-colors shadow-lg shadow-orange-500/30 border-0"
                                >
                                    {isRequesting ? 'Enviando...' : 'Enviar Solicitud'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Edit Modal */}
            {
                editModalOpen && editingRegistro && (
                    <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-[#0f172a]/90 backdrop-blur-md"></div>
                        <div className="relative bg-white rounded-3xl shadow-2xl animate-in slide-in-from-bottom-8 flex flex-col max-h-[90vh] w-full max-w-4xl" style={{ zIndex: 10 }}>
                            {/* Modal Header */}
                            <div className="p-5 sm:p-6 flex justify-between items-start border-b border-[#e2e8f0] flex-shrink-0">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center text-xl shadow-inner shrink-0">
                                        <i className="bi bi-pencil-square"></i>
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-[#1e293b] uppercase tracking-tighter m-0">Editor de Registro</h3>
                                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                            {editingRegistro.producto_nombre?.trim() ? (
                                                <span className="bg-[#f8fafc] border border-[#e2e8f0] text-[#475569] px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wider">
                                                    {editingRegistro.producto_nombre}
                                                </span>
                                            ) : null}
                                            <span className="bg-blue-50 border border-blue-200 text-blue-600 px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wider">
                                                Lote: {editingRegistro.lote_interno}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <button onClick={handleCancelEdit} className="w-10 h-10 rounded-full bg-[#f8fafc] text-[#64748b] hover:bg-red-100 hover:text-red-500 flex items-center justify-center transition-colors border-0">
                                    <i className="bi bi-x-lg"></i>
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="p-5 sm:p-6 overflow-y-auto bg-[#f8fafc] flex-grow custom-scrollbar">
                                <div className="bg-white p-4 rounded-2xl border border-[#e2e8f0] flex items-center justify-between mb-5 shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${timeLeft === 'Expirado' ? 'bg-red-100 text-red-500' : 'bg-green-100 text-green-500'}`}>
                                            <i className="bi bi-stopwatch-fill"></i>
                                        </div>
                                        <div>
                                            <div className="text-[10px] text-[#94a3b8] font-bold uppercase tracking-widest leading-tight">Tiempo Restante</div>
                                            <div className={`font-black text-lg leading-none mt-1 ${timeLeft === 'Expirado' ? 'text-red-500 animate-pulse' : 'text-green-500'}`}>{timeLeft}</div>
                                        </div>
                                    </div>
                                    <div className="text-right border-l border-[#e2e8f0] pl-4">
                                        <div className="text-[#64748b] text-xs font-semibold">Editado por: <span className="font-bold text-[#1e293b]">{userName}</span></div>
                                        <div className="text-[#94a3b8] text-[10px] font-bold mt-1 uppercase tracking-widest bg-[#f1f5f9] px-2 py-1 rounded-md inline-block border border-[#e2e8f0]">
                                            Iniciado: {editLockInfo?.startedAt ? new Date(editLockInfo.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                                        </div>
                                    </div>
                                </div>

                                {editError && <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl text-sm font-semibold mb-5 flex gap-2 items-start"><i className="bi bi-exclamation-triangle-fill mt-0.5"></i> {editError}</div>}

                                <div className="bg-cyan-50 border border-cyan-100 p-4 rounded-2xl flex gap-3 items-start mb-6 shadow-sm">
                                    <i className="bi bi-info-circle-fill text-cyan-500 text-lg mt-0.5 shrink-0"></i>
                                    <div>
                                        <h6 className="font-bold text-cyan-800 uppercase tracking-widest text-xs mb-1.5 m-0">Reglas de Edición</h6>
                                        <ul className="text-xs font-medium text-cyan-700 space-y-1 mt-1 pl-4 list-disc marker:text-cyan-400">
                                            <li>Campos permitidos: Lote Interno, Lote Producto, Guía, Marca, Cantidad y Evidencias (Fotos).</li>
                                            <li>Límite de fotografías: Máximo 2 imágenes por registro.</li>
                                            <li>Ventana de edición: Dispone de 1 hora para guardar los cambios desde su inicio.</li>
                                            <li>Auditoría: Todas las modificaciones generarán un registro inmutable en el historial.</li>
                                        </ul>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 mb-4">
                                    <i className="bi bi-pencil-square text-blue-500 text-lg"></i>
                                    <h5 className="m-0 font-bold text-[#1e293b] text-base">Datos del Registro</h5>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                    <div>
                                        <label className="block text-[10px] font-bold text-[#64748b] uppercase tracking-widest mb-1.5">Lote Interno</label>
                                        <input
                                            type="text"
                                            className="w-full bg-white border border-[#cbd5e1] focus:border-blue-500 rounded-xl p-2.5 text-sm text-[#1e293b] font-medium outline-none transition-colors"
                                            value={editFields.lote_interno}
                                            onChange={(e) => setEditFields(prev => ({ ...prev, lote_interno: e.target.value }))}
                                            disabled={!!editError || (timeLeft === 'Expirado' && userRole !== 'administrador')}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-[#64748b] uppercase tracking-widest mb-1.5">Lote Producto</label>
                                        <input
                                            type="text"
                                            className="w-full bg-white border border-[#cbd5e1] focus:border-blue-500 rounded-xl p-2.5 text-sm text-[#1e293b] font-medium outline-none transition-colors"
                                            value={editFields.lote_producto}
                                            onChange={(e) => setEditFields(prev => ({ ...prev, lote_producto: e.target.value }))}
                                            disabled={!!editError || (timeLeft === 'Expirado' && userRole !== 'administrador')}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-[#64748b] uppercase tracking-widest mb-1.5">Guía</label>
                                        <input
                                            type="text"
                                            className="w-full bg-white border border-[#cbd5e1] focus:border-blue-500 rounded-xl p-2.5 text-sm text-[#1e293b] font-medium outline-none transition-colors"
                                            value={editFields.guia}
                                            onChange={(e) => setEditFields(prev => ({ ...prev, guia: e.target.value }))}
                                            disabled={!!editError || (timeLeft === 'Expirado' && userRole !== 'administrador')}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-[#64748b] uppercase tracking-widest mb-1.5">Marca</label>
                                        <input
                                            type="text"
                                            className="w-full bg-white border border-[#cbd5e1] focus:border-blue-500 rounded-xl p-2.5 text-sm text-[#1e293b] font-medium outline-none transition-colors"
                                            value={editFields.marca}
                                            onChange={(e) => setEditFields(prev => ({ ...prev, marca: e.target.value }))}
                                            disabled={!!editError || (timeLeft === 'Expirado' && userRole !== 'administrador')}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-[#64748b] uppercase tracking-widest mb-1.5">Cantidad</label>
                                        <input
                                            type="number"
                                            className="w-full bg-white border border-[#cbd5e1] focus:border-blue-500 rounded-xl p-2.5 text-sm text-[#1e293b] font-medium outline-none transition-colors"
                                            value={editFields.cantidad}
                                            onChange={(e) => setEditFields(prev => ({ ...prev, cantidad: e.target.value }))}
                                            disabled={!!editError || (timeLeft === 'Expirado' && userRole !== 'administrador')}
                                        />
                                    </div>
                                </div>

                                <div className="bg-white rounded-2xl border border-[#e2e8f0] overflow-hidden mb-6 shadow-sm">
                                    <div className="p-3 bg-[#f8fafc] border-b border-[#e2e8f0] flex justify-between items-center">
                                        <div className="flex items-center gap-2 font-bold text-[#1e293b] text-sm">
                                            <i className="bi bi-camera-fill text-[#64748b]"></i> Gestión de Evidencias
                                        </div>
                                        <span className={`text-xs px-2 py-1 rounded-md border font-medium ${(((editingRegistro.fotos?.filter(f => !photosToDelete.includes(f.id)).length || 0) + editPhotos.length) > 2) ? 'bg-red-50 text-red-600 border-red-200' : 'bg-green-50 text-green-600 border-green-200'}`}>
                                            <b>{(editingRegistro.fotos?.filter(f => !photosToDelete.includes(f.id)).length || 0) + editPhotos.length}</b> / 2
                                        </span>
                                    </div>
                                    <div className="p-4">
                                        {((editingRegistro.fotos?.length || 0) > 0 || editPhotos.length > 0) ? (
                                            <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
                                                {editingRegistro.fotos?.map((photo, idx) => {
                                                    const isDel = photosToDelete.includes(photo.id);
                                                    return (
                                                        <div key={photo.id} className={`relative flex-shrink-0 w-32 border rounded-xl overflow-hidden shadow-sm transition-all ${isDel ? 'border-red-300 opacity-60' : 'border-[#e2e8f0]'}`}>
                                                            <div className="bg-[#f1f5f9] h-24 flex items-center justify-center">
                                                                <img src={photo.datos_base64} className="max-h-full max-w-full object-contain cursor-zoom-in" onClick={() => setZoomImage({ url: photo.datos_base64, description: photo.descripcion || 'Foto persistente' })} />
                                                            </div>
                                                            <button onClick={() => {
                                                                if (isDel) setPhotosToDelete(p => p.filter(x => x !== photo.id));
                                                                else setPhotosToDelete(p => [...p, photo.id]);
                                                            }} className={`absolute top-1 right-1 w-6 h-6 flex items-center justify-center rounded-full text-white text-[10px] font-bold ${isDel ? 'bg-green-500' : 'bg-red-500'}`}>
                                                                <i className={`bi ${isDel ? 'bi-arrow-counterclockwise' : 'bi-trash3-fill'}`}></i>
                                                            </button>
                                                            <div className={`text-center text-[9px] font-bold py-1 ${isDel ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-500'}`}>
                                                                {isDel ? 'SE ELIMINARÁ' : 'GUARDADA'}
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                                {editPhotos.map((photo, idx) => (
                                                    <div key={`new-${idx}`} className="relative flex-shrink-0 w-32 border border-green-200 rounded-xl overflow-hidden shadow-sm">
                                                        <div className="bg-green-50 h-24 flex items-center justify-center p-1">
                                                            <img src={photo.data} className="max-h-full max-w-full object-contain cursor-zoom-in rounded" onClick={() => setZoomImage({ url: photo.data, description: 'Nueva foto' })} />
                                                        </div>
                                                        <button onClick={() => setEditPhotos(p => p.filter((_, i) => i !== idx))} className="absolute top-1 right-1 w-6 h-6 flex items-center justify-center bg-red-500 rounded-full text-white text-[10px] font-bold">
                                                            <i className="bi bi-x-lg"></i>
                                                        </button>
                                                        <div className="text-center text-[9px] font-bold py-1 bg-green-100 text-green-700">
                                                            NUEVA
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-center py-6 text-[#94a3b8]">
                                                <i className="bi bi-image text-3xl mb-2 block opacity-50"></i>
                                                <span className="text-xs font-medium">No hay fotos guardadas</span>
                                            </div>
                                        )}
                                        <div className="mt-4 pt-4 border-t border-[#e2e8f0]">
                                            <label className="text-[10px] font-bold text-[#64748b] uppercase tracking-widest block mb-2 mt-1">Nuevas Fotos</label>
                                            <input type="file" className="block w-full text-sm text-[#475569] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-all cursor-pointer bg-[#f8fafc] border border-[#cbd5e1] rounded-xl" accept="image/*" multiple onChange={handleEditPhotoUpload} disabled={!!editError || (timeLeft === 'Expirado' && userRole !== 'administrador')} />
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white rounded-2xl border border-[#e2e8f0] overflow-hidden shadow-sm">
                                    <div className="p-3 bg-slate-50 border-b border-[#e2e8f0] flex items-center gap-2">
                                        <i className="bi bi-clock-history text-slate-500"></i>
                                        <span className="font-bold text-[#1e293b] text-sm">Historial de Cambios</span>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs bg-white text-[#475569]">
                                            <thead className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                                                <tr>
                                                    <th className="px-4 py-2 font-bold text-[#64748b] w-1/4">Fecha</th>
                                                    <th className="px-4 py-2 font-bold text-[#64748b] w-1/4">Usuario</th>
                                                    <th className="px-4 py-2 font-bold text-[#64748b] w-2/4">Detalles</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-[#f1f5f9]">
                                                {editHistory.length > 0 ? editHistory.map(hist => (
                                                    <tr key={hist.id} className="hover:bg-slate-50">
                                                        <td className="px-4 py-2">{new Date(hist.created_at).toLocaleString('es-PE')}</td>
                                                        <td className="px-4 py-2 font-medium">{hist.usuarios?.nombre_completo || 'Usuario'}</td>
                                                        <td className="px-4 py-2 flex items-center justify-between gap-2">
                                                            <span className="truncate bg-slate-100 text-slate-600 px-2 py-1 rounded text-[10px] font-medium" style={{ maxWidth: '140px' }}>
                                                                {(() => {
                                                                    if (!hist.action) return 'Edición general';
                                                                    const p = hist.action.split(',');
                                                                    const s = [];
                                                                    if (p.some((x: string) => x.startsWith('field'))) s.push('Campos');
                                                                    if (p.some((x: string) => x.startsWith('add'))) s.push('+Fotos');
                                                                    if (p.some((x: string) => x.startsWith('del'))) s.push('-Fotos');
                                                                    return s.length > 0 ? s.join(', ') : 'Edición general';
                                                                })()}
                                                            </span>
                                                            <button onClick={() => setSelectedHistoryDetail(hist)} className="text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-md text-[10px] font-bold border-0 transition-colors shrink-0">
                                                                Ver más
                                                            </button>
                                                        </td>
                                                    </tr>
                                                )) : (
                                                    <tr>
                                                        <td colSpan={3} className="px-4 py-4 text-center text-slate-400 italic">No hay ediciones previas.</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="p-4 sm:p-5 bg-white border-t border-[#e2e8f0] flex justify-end gap-3 flex-shrink-0 rounded-b-3xl">
                                <button onClick={handleCancelEdit} className="px-5 py-2.5 rounded-xl font-bold text-sm text-[#475569] bg-[#f1f5f9] hover:bg-[#e2e8f0] transition-colors border-0">
                                    Descartar
                                </button>
                                <button
                                    onClick={handleSaveEdit}
                                    disabled={
                                        (timeLeft === 'Expirado' && userRole !== 'administrador') ||
                                        (((editingRegistro.fotos?.filter(f => !photosToDelete.includes(f.id)).length || 0) + editPhotos.length) > 2) ||
                                        !!editError ||
                                        (editPhotos.length === 0 && photosToDelete.length === 0 && editFields.lote_interno === (editingRegistro.lote_interno || '') && editFields.lote_producto === (editingRegistro.lote_producto || '') && editFields.guia === (editingRegistro.guia || '') && editFields.marca === (editingRegistro.marca || '') && editFields.cantidad === String(editingRegistro.cantidad || ''))
                                    }
                                    className="px-6 py-2.5 rounded-xl font-bold text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-lg shadow-blue-500/30 border-0 flex items-center gap-2"
                                >
                                    <i className="bi bi-save2-fill"></i> Guardar Edición
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Editing History Detail Mini-Modal */}
            {
                selectedHistoryDetail && (
                    <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-[#0f172a]/90 backdrop-blur-md"></div>
                        <div className="relative bg-[#f8fafc] rounded-3xl shadow-2xl animate-in slide-in-from-bottom-8 flex flex-col max-h-[90vh] w-full max-w-2xl" style={{ zIndex: 10 }}>
                            <div className="p-5 sm:p-6 bg-white flex justify-between items-start border-b border-[#e2e8f0] flex-shrink-0 rounded-t-3xl">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-green-100 text-green-600 rounded-2xl flex items-center justify-center text-xl shadow-inner shrink-0">
                                        <i className="bi bi-clock-history"></i>
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-[#1e293b] uppercase tracking-tighter m-0">Detalles de la Edición</h3>
                                        <p className="text-[#64748b] text-xs font-bold uppercase tracking-widest mt-1 m-0">Auditoría Técnica del Registro</p>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedHistoryDetail(null)} className="w-10 h-10 rounded-full bg-[#f8fafc] text-[#64748b] hover:bg-red-100 hover:text-red-500 flex items-center justify-center transition-colors border-0">
                                    <i className="bi bi-x-lg"></i>
                                </button>
                            </div>
                            <div className="p-5 sm:p-6 overflow-y-auto flex-grow custom-scrollbar space-y-5">
                                <div className="bg-white p-4 rounded-2xl border border-[#e2e8f0] flex items-center justify-between shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg bg-emerald-100 text-emerald-600">
                                            <i className="bi bi-person-check-fill"></i>
                                        </div>
                                        <div>
                                            <div className="text-[10px] text-[#94a3b8] font-bold uppercase tracking-widest leading-tight">Responsable</div>
                                            <div className="font-bold text-[#1e293b] mt-0.5">{selectedHistoryDetail.usuarios?.nombre_completo || 'Usuario'}</div>
                                        </div>
                                    </div>
                                    <div className="text-right border-l border-[#e2e8f0] pl-4">
                                        <div className="text-[10px] text-[#94a3b8] font-bold uppercase tracking-widest leading-tight">Fecha y Hora</div>
                                        <div className="text-sm font-bold text-[#1e293b] mt-0.5 bg-[#f1f5f9] px-2 py-1 rounded-md inline-block border border-[#e2e8f0]">
                                            {new Date(selectedHistoryDetail.created_at).toLocaleString('es-PE')}
                                        </div>
                                    </div>
                                </div>

                                {selectedHistoryDetail.field_changes && Object.keys(selectedHistoryDetail.field_changes).length > 0 && (
                                    <div className="bg-white p-4 rounded-2xl border border-[#e2e8f0] shadow-sm">
                                        <h6 className="font-bold text-sm text-[#1e293b] mb-3 flex items-center gap-2 m-0 uppercase tracking-widest">
                                            <span className="bg-blue-100 text-blue-600 px-2 py-0.5 rounded text-[10px]">CAMPOS</span>
                                            Modificados
                                        </h6>
                                        <div className="border border-[#e2e8f0] rounded-xl overflow-hidden">
                                            <table className="w-full text-left text-xs bg-white text-[#475569]">
                                                <thead className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                                                    <tr>
                                                        <th className="px-4 py-2 font-bold text-[#64748b]">Campo</th>
                                                        <th className="px-4 py-2 font-bold text-[#64748b]">Valor Anterior</th>
                                                        <th className="px-4 py-2 font-bold text-[#64748b]">Valor Nuevo</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-[#f1f5f9]">
                                                    {Object.entries(selectedHistoryDetail.field_changes).map(([field, vals]: [string, any]) => (
                                                        <tr key={field} className="hover:bg-slate-50">
                                                            <td className="px-4 py-2 font-bold text-[#1e293b] capitalize">{field.replace('_', ' ')}</td>
                                                            <td className="px-4 py-2 text-red-500 bg-red-50/50"><span className="line-through opacity-75">{vals.old || '-'}</span></td>
                                                            <td className="px-4 py-2 text-green-600 bg-green-50/50 font-bold">{vals.new || '-'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {selectedHistoryDetail.photos_added && selectedHistoryDetail.photos_added.length > 0 && (
                                    <div className="bg-white p-4 rounded-2xl border border-[#e2e8f0] shadow-sm">
                                        <h6 className="font-bold text-sm text-[#1e293b] mb-3 flex items-center gap-2 m-0 uppercase tracking-widest">
                                            <span className="bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded text-[10px]">AGREGADO</span>
                                            Fotos Nuevas ({selectedHistoryDetail.photos_added.length})
                                        </h6>
                                        <div className="flex flex-wrap gap-3">
                                            {selectedHistoryDetail.photos_added.map((p: any, i: number) => {
                                                const raw = p?.data || p?.datos_base64 || p?.url || p?.path || (typeof p === 'string' ? p : '');
                                                if (!raw || raw.length < 10) return null;
                                                const clean = raw.trim().replace(/\s/g, '');
                                                const src = (clean.startsWith('data:') || clean.startsWith('http')) ? clean : `data:image/jpeg;base64,${clean}`;
                                                return (
                                                    <div key={i} className="w-24 h-24 rounded-xl border border-[#e2e8f0] shadow-sm cursor-zoom-in bg-cover bg-center" style={{ backgroundImage: `url("${src}")` }} onClick={() => setZoomImage({ url: src, description: 'Foto agregada' })} />
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {selectedHistoryDetail.photos_deleted && selectedHistoryDetail.photos_deleted.length > 0 && (
                                    <div className="bg-white p-4 rounded-2xl border border-[#e2e8f0] shadow-sm">
                                        <h6 className="font-bold text-sm text-[#1e293b] mb-3 flex items-center gap-2 m-0 uppercase tracking-widest">
                                            <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded text-[10px]">ELIMINADO</span>
                                            Fotos Eliminadas ({selectedHistoryDetail.photos_deleted.length})
                                        </h6>
                                        <div className="flex flex-wrap gap-3">
                                            {selectedHistoryDetail.photos_deleted.map((p: any, i: number) => {
                                                const raw = p?.data || p?.datos_base64 || p?.url || p?.path || (typeof p === 'string' ? p : '');
                                                const id = p?.id || (typeof p === 'number' ? p : 'N/A');
                                                if (!raw || raw.length < 20) {
                                                    return (
                                                        <div key={i} className="w-24 h-24 rounded-xl border border-red-200 bg-red-50 text-red-500 flex flex-col items-center justify-center p-1 text-center">
                                                            <span className="font-bold text-[10px]">ID: {id}</span>
                                                            <span className="text-[9px]">SIN VISTA PREVIA</span>
                                                        </div>
                                                    );
                                                }
                                                const clean = raw.trim().replace(/\s/g, '');
                                                const src = (clean.startsWith('data:') || clean.startsWith('http')) ? clean : `data:image/jpeg;base64,${clean}`;
                                                return (
                                                    <div key={i} className="relative w-24 h-24 rounded-xl border border-red-200 shadow-sm cursor-zoom-in bg-cover bg-center overflow-hidden" style={{ backgroundImage: `url("${src}")` }} onClick={() => setZoomImage({ url: src, description: 'Foto eliminada' })}>
                                                        <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center pointer-events-none">
                                                            <span className="bg-red-500 text-white px-2 py-0.5 rounded text-[9px] font-bold shadow-sm">ELIMINADA</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="p-4 sm:p-5 bg-white border-t border-[#e2e8f0] flex justify-end flex-shrink-0 rounded-b-3xl">
                                <button onClick={() => setSelectedHistoryDetail(null)} className="px-6 py-2.5 rounded-xl font-bold text-sm bg-[#1e293b] text-white hover:bg-[#334155] transition-colors border-0">
                                    Cerrar Detalles
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            <style jsx>{`
                /* Page Container */
                .historial-page-container {
                    max-width: 1100px;
                    margin: 0 auto;
                    padding: 40px 20px;
                    font-family: 'Inter', system-ui, sans-serif;
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
                    background: #3b82f6;
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
                    background: #2563eb;
                    box-shadow: 0 10px 15px -3px rgba(59, 130, 246, 0.3);
                }

                /* Toolbar */
                .toolbar-row {
                    display: flex;
                    flex-direction: row;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1.5rem;
                    padding-bottom: 1.5rem;
                    border-bottom: 1px solid #dee2e6;
                    gap: 12px;
                }
                .toolbar-filters {
                    display: flex;
                    flex-direction: row;
                    gap: 10px;
                    align-items: center;
                }
                .toolbar-search {
                    width: 250px;
                    min-width: 200px;
                    position: relative;
                }
                .search-icon {
                    position: absolute;
                    left: 12px;
                    top: 50%;
                    transform: translateY(-50%);
                    z-index: 10;
                    color: #6c757d;
                }

                /* Desktop table visible, mobile cards hidden by default */
                .desktop-table { display: block; }
                .mobile-cards { display: none; }

                /* Mobile Cards */
                .mobile-card {
                    background: #fff;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 14px;
                    margin-bottom: 10px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
                }
                .mobile-card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                }
                .mobile-card-lote {
                    font-weight: 800;
                    font-size: 0.95rem;
                    color: #1e293b;
                }
                .mobile-card-date {
                    font-size: 0.78rem;
                    color: #94a3b8;
                    font-weight: 500;
                }
                .mobile-card-body {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                    margin-bottom: 10px;
                }
                .mobile-card-product {
                    font-size: 0.88rem;
                    color: #334155;
                }
                .mobile-card-user {
                    font-size: 0.78rem;
                    color: #94a3b8;
                }
                .mobile-card-actions {
                    display: flex;
                    gap: 8px;
                    border-top: 1px solid #f1f5f9;
                    padding-top: 10px;
                }
                .mobile-action-btn {
                    flex: 1;
                    padding: 7px 0;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    background: #f8fafc;
                    font-size: 0.78rem;
                    font-weight: 600;
                    cursor: pointer;
                    text-align: center;
                    transition: background 0.2s;
                }
                .mobile-action-btn:hover { background: #e2e8f0; }
                .mobile-action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
                .mobile-action-btn.view { color: #2563eb; }
                .mobile-action-btn.edit { color: #d97706; }
                .mobile-action-btn.pdf { color: #64748b; }

                /* ===== MOBILE BREAKPOINT ===== */
                @media (max-width: 768px) {
                    .historial-page-container {
                        padding: 16px 10px;
                    }
                    .header-container {
                        flex-direction: column;
                        text-align: center;
                        gap: 16px;
                        padding: 18px 14px;
                        border-radius: 16px;
                    }
                    .title { font-size: 1.25rem; }
                    .subtitle { font-size: 0.8rem; }
                    .header-stats {
                        flex-direction: row;
                        width: 100%;
                        justify-content: center;
                        flex-wrap: wrap;
                    }
                    .btn-add-premium {
                        width: 100%;
                        justify-content: center;
                        font-size: 0.8rem;
                        padding: 10px 14px;
                    }

                    /* Toolbar stacks */
                    .toolbar-row {
                        flex-direction: column;
                        align-items: stretch;
                        gap: 10px;
                    }
                    .toolbar-filters {
                        width: 100%;
                    }
                    .toolbar-filters select {
                        flex: 1;
                        width: 100% !important;
                    }
                    .toolbar-search {
                        width: 100%;
                        min-width: unset;
                    }

                    /* Hide table, show cards */
                    .desktop-table { display: none !important; }
                    .mobile-cards { display: block !important; }

                    /* Modal mobile */
                    .modal-content {
                        max-width: 100%;
                        max-height: 95vh;
                        border-radius: 12px 12px 0 0;
                        margin: 0;
                    }
                    .modal-overlay {
                        padding: 0;
                        align-items: flex-end;
                    }
                    .modal-body { padding: 1rem; }
                    .modal-header { padding: 0.75rem 1rem; }
                    .modal-header h3 { font-size: 1.1rem; }
                    .modal-footer { padding: 0.75rem 1rem; }

                    .detail-grid {
                        grid-template-columns: 1fr;
                    }
                    .photos-grid {
                        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
                    }
                }

                .group-section {
                    background: white;
                    border-radius: 8px;
                    padding: 1.5rem;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
                }
                .group-title {
                    font-size: 1.25rem;
                    font-weight: 600;
                    color: #475569;
                    margin-bottom: 1rem;
                    padding-bottom: 0.5rem;
                    border-bottom: 2px solid #e2e8f0;
                    text-transform: capitalize;
                }

        .empty-state {
          text-align: center;
          padding: 3rem;
          color: #6c757d;
        }

        .table-container {
          overflow-x: auto;
        }

        .action-buttons {
            display: flex;
            gap: 0.5rem;
        }

        .btn-sm {
          padding: 0.25rem 0.75rem;
          font-size: 0.875rem;
        }

        .btn-outline-secondary {
            border: 1px solid #6c757d;
            background: white;
            color: #6c757d;
        }
        
        .btn-outline-secondary:hover {
            background: #6c757d;
            color: white;
        }

        /* Pagination Premium Custom Styles */
        .btn-pagination {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: 0.4rem 1.2rem;
            font-size: 0.85rem;
            font-weight: 600;
            color: #475569;
            background: #ffffff;
            border: 1px solid transparent;
            border-radius: 9999px;
            transition: all 0.2s ease-in-out;
            cursor: pointer;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }
        
        .btn-pagination:hover:not(:disabled) {
            background: #f1f5f9;
            color: #0f172a;
            transform: translateY(-1px);
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
        }

        .btn-pagination:active:not(:disabled) {
            transform: translateY(0);
            box-shadow: none;
        }

        .btn-pagination:disabled {
            background: transparent;
            color: #94a3b8;
            cursor: not-allowed;
            box-shadow: none;
        }
        
        .pagination-info {
            font-size: 0.85rem;
            font-weight: 700;
            color: #334155;
            letter-spacing: 0.3px;
            padding: 0 0.5rem;
        }

        .btn-success {
            background-color: #28a745;
            color: white;
            border: none;
            padding: 0.5rem 1rem;
            border-radius: 0.25rem;
            cursor: pointer;
        }
        
        .btn-success:hover {
            background-color: #218838;
        }
        
        .btn-success:disabled {
            background-color: #94d3a2;
            cursor: not-allowed;
        }

      `}</style>

            {zoomImage && (
                <div 
                    className="fixed inset-0 z-[8000] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl transition-all animate-in fade-in" 
                    onClick={() => setZoomImage(null)}
                >
                    <div className="absolute top-6 right-6 flex gap-4">
                        <button className="w-12 h-12 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center transition-all border-0 backdrop-blur-md active:scale-90">
                            <i className="bi bi-x-lg text-xl"></i>
                        </button>
                    </div>
                    <div className="relative max-w-full max-h-[85vh] group" onClick={e => e.stopPropagation()}>
                        <img 
                            src={zoomImage.url} 
                            alt="Zoom" 
                            className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-300 border border-white/10" 
                        />
                        {zoomImage.description && (
                            <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-md text-white px-8 py-3 rounded-2xl font-bold border border-white/20 shadow-2xl text-center whitespace-nowrap overflow-hidden text-ellipsis max-w-[90vw]">
                                {zoomImage.description}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
