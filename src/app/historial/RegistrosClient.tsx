'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { createClient } from '@/lib/supabase/client';
import { formatDate, normalizeString } from '@/lib/utils';
import type { Registro, Control, Foto } from '@/lib/supabase/types';
import BulkDownloadModal from '@/components/BulkDownloadModal';
import DownloadHistory from '@/components/DownloadHistory';



interface RegistroWithDetails extends Registro {
    controles?: Control[];
    fotos?: Foto[];
}

export default function RegistrosClient() {
    const router = useRouter();
    const supabase = createClient();

    const [registros, setRegistros] = useState<RegistroWithDetails[]>([]);
    const [loading, setLoading] = useState(true);
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

    // Request Edit Permission State
    const [requestModalOpen, setRequestModalOpen] = useState(false);
    const [requestRegistroId, setRequestRegistroId] = useState<number | null>(null);
    const [requestMotivo, setRequestMotivo] = useState('');
    const [isRequesting, setIsRequesting] = useState(false);

    // Filters
    // Filters
    // Filters
    const [selectedYear, setSelectedYear] = useState<string>('');
    const [selectedMonth, setSelectedMonth] = useState<string>('');

    // Search & Pagination
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [limit, setLimit] = useState(25);

    // Debounce Search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    useEffect(() => {
        checkAuth();
        loadRegistros();
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

    const loadRegistros = async () => {
        try {
            // Use internal API to bypass RLS
            const response = await fetch('/api/registros');
            if (!response.ok) throw new Error('Error fetching registros');
            const data = await response.json();
            setRegistros(data || []);
        } catch (err) {
            console.error('Error loading registros:', err);
        } finally {
            setLoading(false);
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

        if (userRole === 'administrador') {
            setPendingEditRegistro(registro);
            setPasswordInput('');
            setPasswordModalOpen(true);
        } else {
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

            // Fetch History
            const histRes = await fetch(`/api/registros/history?id=${registro.id}`);
            if (histRes.ok) {
                setEditHistory(await histRes.json());
            }

            // Fetch details
            const details = await fetchDetails(registro.id);
            setEditingRegistro({ ...registro, ...details });
            setEditPhotos([]);
            setPhotosToDelete([]);
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
                    password: editPassword
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            alert('Cambios guardados exitosamente');
            setEditModalOpen(false);
            setEditingRegistro(null);
            loadRegistros(); // Refresh list

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

    // Calculate available years
    const availableYears = useMemo(() => {
        const years = new Set(registros.map(r => new Date(r.fecha_registro).getFullYear()));
        return Array.from(years).sort((a, b) => b - a);
    }, [registros]);

    const availableMonths = useMemo(() => {
        if (!selectedYear) return [];
        const year = parseInt(selectedYear);
        const months = new Set(
            registros
                .filter(r => new Date(r.fecha_registro).getFullYear() === year)
                .map(r => new Date(r.fecha_registro).getMonth())
        );
        return Array.from(months).sort((a, b) => a - b);
    }, [registros, selectedYear]);

    // Auto-select latest year/month on load or when invalid
    useEffect(() => {
        if (!loading && registros.length > 0) {
            // If no year selected or selected year not available, pick first avaiable (latest)
            const yearInt = parseInt(selectedYear);
            if (!selectedYear || !availableYears.includes(yearInt)) {
                if (availableYears.length > 0) {
                    setSelectedYear(availableYears[0].toString());
                }
            }
        }
    }, [loading, registros, availableYears, selectedYear]);

    useEffect(() => {
        if (!loading && availableMonths.length > 0) {
            const monthInt = parseInt(selectedMonth);
            if (!selectedMonth || !availableMonths.includes(monthInt)) {
                // Select first available month (usually earliest in the returned sorted array)
                // Or maybe we want the latest month? The user didn't specify, but usually you want to see data.
                // availableMonths is sorted asc (0-11). Let's pick the last one (latest month) to show most recent info?
                // The sort is a-b (asc). So [0, 1, 2] -> Jan, Feb, Mar.
                // Let's select the last one for "latest" data Context.
                // Or first? Let's stick to first for now or last.
                // Actually, if I select a year, I probably want to see the first month or last?
                // Let's pick availableMonths[availableMonths.length - 1] (Latest month)
                setSelectedMonth(availableMonths[availableMonths.length - 1].toString());
            }
        }
    }, [loading, availableMonths, selectedMonth]);

    const MONTH_NAMES = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    // Filter Logic
    const filteredRegistros = useMemo(() => {
        if (!selectedYear || !selectedMonth) {
            return [];
        }

        let filtered = [...registros];

        // Apply filters
        filtered = filtered.filter(r =>
            new Date(r.fecha_registro).getFullYear().toString() === selectedYear &&
            new Date(r.fecha_registro).getMonth().toString() === selectedMonth
        );

        // Apply Search
        if (debouncedSearch) {
            const normalizedSearch = normalizeString(debouncedSearch);
            filtered = filtered.filter(r =>
                normalizeString(r.lote_interno).includes(normalizedSearch) ||
                normalizeString(r.producto_nombre).includes(normalizedSearch) ||
                normalizeString(r.verificado_por || r.usuario_nombre || '').includes(normalizedSearch)
            );
        }

        // Sort by date desc
        return filtered.sort((a, b) =>
            new Date(b.fecha_registro).getTime() - new Date(a.fecha_registro).getTime()
        ).slice(0, limit);
    }, [registros, selectedYear, selectedMonth, debouncedSearch, limit]);

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
                        <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid #dee2e6' }}>
                            {/* Left Side: Filters */}
                            <div style={{ display: 'flex', flexDirection: 'row', gap: '10px', alignItems: 'center' }}>
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
                            <div style={{ width: '250px', minWidth: '250px', position: 'relative' }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" className="text-secondary" viewBox="0 0 16 16" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', zIndex: 10 }}>
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
                        <div className="table-responsive">
                            <table className="table table-hover mb-0 align-middle">
                                <thead className="table-light text-secondary text-uppercase small">
                                    <tr>
                                        <th className="ps-3 fw-semibold text-secondary">Fecha</th>
                                        <th className="fw-semibold text-secondary">Lote Interno</th>
                                        <th className="fw-semibold text-secondary">Producto</th>
                                        <th className="fw-semibold text-secondary">Verificado por</th>
                                        <th className="text-end pe-3 fw-semibold text-secondary">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredRegistros.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="text-center py-5 text-muted">
                                                {!selectedYear || !selectedMonth ? (
                                                    "Seleccione año y mes para ver los registros."
                                                ) : (
                                                    "No se encontraron registros con los filtros actuales."
                                                )}
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredRegistros.map((registro) => (
                                            <tr key={registro.id}>
                                                <td className="ps-3 text-muted fw-medium">{formatDate(registro.fecha_registro).split(',')[0]}</td>
                                                <td className="fw-bold text-dark">{registro.lote_interno}</td>
                                                <td className="text-dark">{registro.producto_nombre}</td>
                                                <td className="text-secondary small">
                                                    {registro.verificado_por || registro.usuario_nombre}
                                                </td>
                                                <td className="text-end pe-3">
                                                    <div className="d-flex justify-content-end gap-2">
                                                        <button
                                                            className="btn btn-sm btn-link text-primary p-0 text-decoration-none fw-medium"
                                                            onClick={() => viewDetails(registro)}
                                                            title="Ver detalles"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-eye" viewBox="0 0 16 16">
                                                                <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z" />
                                                                <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z" />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            className="btn btn-sm btn-link text-warning p-0 text-decoration-none fw-medium ms-2"
                                                            onClick={() => handleEdit(registro)}
                                                            title="Editar registro"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-pencil-square" viewBox="0 0 16 16">
                                                                <path d="M15.502 1.94a.5.5 0 0 1 0 .706L14.459 3.69l-2-2L13.502.646a.5.5 0 0 1 .707 0l1.293 1.293zm-1.75 2.456-2-2L4.939 9.21a.5.5 0 0 0-.121.196l-.805 2.414a.25.25 0 0 0 .316.316l2.414-.805a.5.5 0 0 0 .196-.12l6.813-6.814z" />
                                                                <path fillRule="evenodd" d="M1 13.5A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-6a.5.5 0 0 0-1 0v6a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5H9a.5.5 0 0 0 0-1H2.5A1.5 1.5 0 0 0 1 2.5v11z" />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            className="btn btn-sm btn-link text-secondary p-0 text-decoration-none ms-2"
                                                            onClick={() => handleDownloadPDF(registro)}
                                                            disabled={downloadingId === registro.id}
                                                            title="Descargar PDF"
                                                        >
                                                            {downloadingId === registro.id ? (
                                                                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                                                            ) : (
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-file-earmark-pdf" viewBox="0 0 16 16">
                                                                    <path d="M14 14V4.5L9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2zM9.5 3A1.5 1.5 0 0 0 11 4.5h2V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5.5v2z" />
                                                                    <path d="M4.603 14.087a.81.81 0 0 1-.438-.42c-.195-.388-.13-.776.08-1.102.198-.307.526-.568.897-.787a7.68 7.68 0 0 1 1.482-.645 19.697 19.697 0 0 0 1.062-2.227 7.269 7.269 0 0 1-.43-1.295c-.086-.4-.119-.796-.046-1.136.075-.354.274-.672.65-.823.192-.077.4-.12.602-.077a.7.7 0 0 1 .477.365c.088.164.12.356.127.538.007.188-.012.396-.047.614-.084.51-.27 1.134-.52 1.794a10.954 10.954 0 0 0 .98 1.686 5.753 5.753 0 0 1 1.334.05c.364.066.734.195.96.465.12.144.193.32.2.518.007.192-.047.382-.138.563a1.04 1.04 0 0 1-.354.416.856.856 0 0 1-.51.138c-.331-.014-.654-.196-.933-.417a5.712 5.712 0 0 1-.911-.95 11.651 11.651 0 0 0-1.997.406 11.305 11.305 0 0 1-1.02 1.51c-.292.35-.609.656-.927.787a.793.793 0 0 1-.58.029zm1.379-1.901c-.166.076-.32.156-.459.238-.328.194-.541.383-.647.545-.094.145-.096.25-.04.361.01.022.02.036.026.044a.266.266 0 0 0 .035-.012c.137-.056.355-.235.635-.572a8.18 8.18 0 0 0 .45-.606zm1.64-1.33a12.71 12.71 0 0 1 1.01-.193 11.744 11.744 0 0 1-.51-.858 20.801 20.801 0 0 1-.5 1.05zm2.446.45c.15.163.296.3.435.41.24.19.407.253.498.256a.107.107 0 0 0 .07-.015.307.307 0 0 0 .094-.125.436.436 0 0 0 .059-.2.095.095 0 0 0-.026-.063c-.052-.062-.2-.152-.518-.209a3.876 3.876 0 0 0-.612-.053zM8.06 7.152c-.066.301-.1.656-.104.97-.002.35.038.64.09.855.023-.105.048-.21.077-.315a13.36 13.36 0 0 1 .15-.654c.068-.198.141-.397.214-.593a12.636 12.636 0 0 0-.427-.263zm2.34-3.132a1.056 1.056 0 0 0-.087-.332c-.03-.075-.07-.16-.14-.24a.276.276 0 0 0-.175-.062c-.08 0-.15.025-.2.07-.06.052-.098.117-.123.18-.046.12-.058.267-.044.423.013.14.053.332.146.616.035.105.156.417.37.755.088-.173.166-.353.253-.53z" />
                                                                </svg>
                                                            )}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Footer Controls */}
                        <div className="d-flex justify-content-end align-items-center mt-4 pt-3 border-top">
                            <div className="d-flex align-items-center gap-2">
                                <span className="small text-muted text-nowrap">Mostrar filas:</span>
                                <select
                                    className="form-select form-select-sm rounded-pill border-secondary-subtle bg-light text-secondary fw-medium shadow-none"
                                    value={limit}
                                    onChange={(e) => setLimit(parseInt(e.target.value))}
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
            </main>

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



            {
                selectedRegistro && (
                    <div className="modal-overlay" onClick={() => setSelectedRegistro(null)}>
                        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h3>Detalle del Registro</h3>
                                <button className="close-btn" onClick={() => setSelectedRegistro(null)}>×</button>
                            </div>

                            <div className="modal-body">
                                {/* Header PDF Snapshot/Preview */}
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
                                        <div className="pdf-header-preview mb-4">
                                            {/* Container with exact proportions 25/55/20 */}
                                            <div style={{
                                                border: '2px solid black',
                                                height: '100px',
                                                backgroundColor: 'white',
                                                display: 'flex',
                                                width: '100%',
                                                overflow: 'hidden'
                                            }}>
                                                {/* Cell 1: LOGO (25%) */}
                                                <div style={{
                                                    width: '25%',
                                                    borderRight: '1px solid black',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    padding: '5px'
                                                }}>
                                                    <img
                                                        src="/logo.png"
                                                        alt="Logo"
                                                        style={{ maxHeight: '90%', maxWidth: '90%', objectFit: 'contain' }}
                                                        onError={(e) => {
                                                            (e.target as any).style.display = 'none';
                                                            (e.target as any).nextElementSibling.style.display = 'block';
                                                        }}
                                                    />
                                                    <span style={{ display: 'none', fontSize: '12px', color: '#999', fontWeight: 'bold' }}>LOGO</span>
                                                </div>

                                                {/* Cell 2: TITLE (55%) */}
                                                <div style={{
                                                    width: '55%',
                                                    borderRight: '1px solid black',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    padding: '10px'
                                                }}>
                                                    <h5 className="mb-0 fw-bold text-center text-uppercase" style={{
                                                        fontSize: '1.1rem',
                                                        fontFamily: 'Helvetica, Arial, sans-serif',
                                                        lineHeight: '1.2'
                                                    }}>
                                                        {headerToShow.titulo}
                                                    </h5>
                                                </div>

                                                {/* Cell 3: DATA (20%) */}
                                                <div style={{
                                                    width: '20%',
                                                    display: 'flex',
                                                    flexDirection: 'column'
                                                }}>
                                                    <div style={{
                                                        flex: 1,
                                                        borderBottom: '1px solid black',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: '0.8rem',
                                                        fontWeight: 'bold',
                                                        fontFamily: 'Helvetica, Arial, sans-serif'
                                                    }}>
                                                        {headerToShow.codigo}
                                                    </div>
                                                    <div style={{
                                                        flex: 1,
                                                        borderBottom: '1px solid black',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: '0.8rem',
                                                        fontWeight: 'bold',
                                                        fontFamily: 'Helvetica, Arial, sans-serif'
                                                    }}>
                                                        {headerToShow.edicion}
                                                    </div>
                                                    <div style={{
                                                        flex: 1,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: '0.8rem',
                                                        fontWeight: 'bold',
                                                        fontFamily: 'Helvetica, Arial, sans-serif',
                                                        textAlign: 'center',
                                                        padding: '2px'
                                                    }}>
                                                        {(() => {
                                                            const original = headerToShow.aprobado_por || '';
                                                            // If YYYY-MM-DD, convert to DD-MM-YYYY
                                                            if (/^\d{4}-\d{2}-\d{2}$/.test(original)) {
                                                                const [y, m, d] = original.split('-');
                                                                return `${d}-${m}-${y}`;
                                                            }
                                                            return original;
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-end mt-1">
                                                <small className="text-muted" style={{ fontSize: '10px', fontStyle: 'italic' }}>
                                                    {selectedRegistro.pdf_codigo ? '● Encabezado histórico de este registro' : '○ Encabezado actual (Vista previa)'}
                                                </small>
                                            </div>
                                        </div>
                                    );
                                })()}

                                <div className="detail-grid">
                                    <div className="detail-item">
                                        <strong>Lote Interno:</strong>
                                        <span>{selectedRegistro.lote_interno}</span>
                                    </div>
                                    <div className="detail-item">
                                        <strong>Guía:</strong>
                                        <span>{selectedRegistro.guia || '-'}</span>
                                    </div>
                                    <div className="detail-item">
                                        <strong>Producto:</strong>
                                        <span>{selectedRegistro.producto_nombre}</span>
                                    </div>
                                    <div className="detail-item">
                                        <strong>Cantidad:</strong>
                                        <span>{selectedRegistro.cantidad}</span>
                                    </div>
                                    <div className="detail-item">
                                        <strong>Fecha:</strong>
                                        <span>{formatDate(selectedRegistro.fecha_registro)}</span>
                                    </div>
                                    <div className="detail-item">
                                        <strong>Verificado por:</strong>
                                        <span>{selectedRegistro.verificado_por || selectedRegistro.usuario_nombre}</span>
                                    </div>
                                </div>

                                {selectedRegistro.observaciones_generales && (
                                    <div className="observations">
                                        <strong>Observaciones Generales:</strong>
                                        <p>{selectedRegistro.observaciones_generales}</p>
                                    </div>
                                )}

                                {selectedRegistro.controles && selectedRegistro.controles.length > 0 && (
                                    <>
                                        <h4>Controles</h4>
                                        <table className="table">
                                            <thead>
                                                <tr>
                                                    <th>Parámetro</th>
                                                    <th>Rango</th>
                                                    <th>Valor</th>
                                                    <th>Estado</th>
                                                    <th>Observación</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {selectedRegistro.controles.map((control) => (
                                                    <tr key={control.id}>
                                                        <td>{control.parametro_nombre}</td>
                                                        <td>{control.rango_completo}</td>
                                                        <td>
                                                            {control.valor_control !== null
                                                                ? control.valor_control
                                                                : control.texto_control || '-'}
                                                        </td>
                                                        <td>
                                                            {control.fuera_de_rango ? (
                                                                <span className="badge badge-danger">Fuera de Rango</span>
                                                            ) : (
                                                                <span className="badge badge-success">OK</span>
                                                            )}
                                                        </td>
                                                        <td>{control.observacion || '-'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </>
                                )}

                                {selectedRegistro.fotos && selectedRegistro.fotos.length > 0 && (
                                    <>
                                        <h4>Fotos</h4>
                                        <div className="photos-grid">
                                            {selectedRegistro.fotos.map((foto) => (
                                                <div
                                                    key={foto.id}
                                                    className="photo-card"
                                                    style={{ cursor: 'zoom-in' }}
                                                    onClick={() => setZoomImage({ url: foto.datos_base64, description: foto.descripcion || '' })}
                                                >
                                                    <div className="photo-frame">
                                                        <img
                                                            src={foto.datos_base64}
                                                            alt={foto.descripcion || `Evidencia ${foto.id}`}
                                                            className="photo-img"
                                                        />
                                                    </div>
                                                    {foto.descripcion && (
                                                        <div className="photo-caption">
                                                            {foto.descripcion}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="modal-footer">
                                <button
                                    className="btn btn-success"
                                    onClick={() => handleDownloadPDF(selectedRegistro)}
                                    disabled={downloadingId === selectedRegistro.id}
                                >
                                    {downloadingId === selectedRegistro.id ? 'Generando...' : 'Descargar PDF Reporte'}
                                </button>
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => setSelectedRegistro(null)}
                                >
                                    Cerrar
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Password Verification Modal */}
            {passwordModalOpen && (
                <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow-lg">
                            <div className="modal-header bg-dark text-white">
                                <h5 className="mb-0 fw-bold d-flex align-items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" className="bi bi-shield-lock-fill text-warning" viewBox="0 0 16 16">
                                        <path fillRule="evenodd" d="M8 0c-.69 0-1.843.265-2.928.56-1.11.3-2.229.655-2.887.87a1.54 1.54 0 0 0-1.044 1.262c-.596 4.477.787 7.795 2.465 9.99a11.777 11.777 0 0 0 2.517 2.453c.386.273.744.482 1.048.625.28.132.581.24.829.24s.548-.108.829-.24a7.159 7.159 0 0 0 1.048-.625 11.775 11.775 0 0 0 2.517-2.453c1.678-2.195 3.061-5.513 2.465-9.99a1.541 1.541 0 0 0-1.044-1.263 6.267 6.267 0 0 0-2.887-.87C9.843.266 8.69 0 8 0zm0 5a1.5 1.5 0 0 1 .5 2.915l.385 1.99a.5.5 0 0 1-.491.595h-.788a.5.5 0 0 1-.49-.595l.384-1.99A1.5 1.5 0 0 1 8 5z" />
                                    </svg>
                                    Identidad Requerida
                                </h5>
                                <button className="btn-close btn-close-white" onClick={() => setPasswordModalOpen(false)} aria-label="Cerrar"></button>
                            </div>
                            <div className="modal-body p-4">
                                <p className="text-secondary small mb-3">Para editar este registro como administrador, por favor confirme su identidad.</p>
                                <label className="form-label fw-bold small">Contraseña de Administrador</label>
                                <input
                                    type="password"
                                    className="form-control"
                                    value={passwordInput}
                                    onChange={(e) => setPasswordInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
                                    autoFocus
                                    placeholder="••••••••"
                                />
                            </div>
                            <div className="modal-footer border-0 pt-0">
                                <button className="btn btn-sm btn-light text-secondary" onClick={() => setPasswordModalOpen(false)}>Cancelar</button>
                                <button className="btn btn-sm btn-dark px-3" onClick={handlePasswordSubmit} disabled={!passwordInput}>Confirmar</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Request Edit Permission Modal */}
            {requestModalOpen && (
                <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow-lg">
                            <div className="modal-header bg-primary text-white">
                                <h5 className="mb-0 fw-bold d-flex align-items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" className="bi bi-person-plus-fill" viewBox="0 0 16 16">
                                        <path d="M1 14s-1 0-1-1 1-4 6-4 6 3 6 4-1 1-1 1H1zm5-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
                                        <path fillRule="evenodd" d="M13.5 5a.5.5 0 0 1 .5.5V7h1.5a.5.5 0 0 1 0 1H14v1.5a.5.5 0 0 1-1 0V8h-1.5a.5.5 0 0 1 0-1H13V5.5a.5.5 0 0 1 .5-.5z" />
                                    </svg>
                                    Solicitar Permiso de Edición
                                </h5>
                                <button className="btn-close btn-close-white" onClick={() => setRequestModalOpen(false)} aria-label="Cerrar"></button>
                            </div>
                            <div className="modal-body p-4">
                                <div className="alert alert-warning small mb-3">
                                    Este registro ya fue editado por un trabajador o el tiempo expiró.
                                    Puedes enviar una solicitud a los administradores para que te habiliten un intento extra.
                                </div>

                                <label className="form-label fw-bold small">Motivo de la solicitud (Opcional)</label>
                                <textarea
                                    className="form-control"
                                    rows={3}
                                    placeholder="Explica brevemente por qué necesitas realizar cambios adicionales..."
                                    value={requestMotivo}
                                    onChange={(e) => setRequestMotivo(e.target.value)}
                                ></textarea>
                                <p className="text-muted small mt-2">
                                    Los administradores revisarán tu solicitud para decidir si la aprueban.
                                </p>
                            </div>
                            <div className="modal-footer border-0 pt-0">
                                <button className="btn btn-sm btn-light text-secondary" onClick={() => setRequestModalOpen(false)}>Cancelar</button>
                                <button
                                    className="btn btn-sm btn-primary px-3 shadow-sm"
                                    onClick={handleRequestSubmit}
                                    disabled={isRequesting}
                                >
                                    {isRequesting ? 'Enviando...' : 'Enviar Solicitud'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editModalOpen && editingRegistro && (
                <div className="modal show" tabIndex={-1}>
                    <div className="modal-dialog modal-lg modal-dialog-scrollable">
                        <div className="modal-content">
                            <div className="modal-header border-0 sticky-top shadow-sm" style={{ background: 'white', zIndex: 1020, padding: '1.25rem 1.5rem' }}>
                                <div>
                                    <div className="text-uppercase small fw-bold text-muted mb-1" style={{ fontSize: '0.7rem', letterSpacing: '1px' }}>
                                        Editando Registro
                                    </div>
                                    <h4 className="text-dark mb-0 fw-bold d-flex align-items-center gap-2">
                                        <span className="text-primary truncate-text" style={{ maxWidth: '400px', display: 'inline-block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {editingRegistro.producto_nombre}
                                        </span>
                                        <span className="badge bg-light text-secondary border rounded-pill fw-normal" style={{ fontSize: '0.8rem' }}>
                                            Lote: {editingRegistro.lote_interno}
                                        </span>
                                    </h4>
                                </div>
                                <button
                                    className="btn-close-custom"
                                    onClick={handleCancelEdit}
                                    style={{
                                        background: '#f1f5f9',
                                        border: 'none',
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        color: '#64748b',
                                        fontSize: '1.2rem',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = '#1e293b'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#64748b'; }}
                                >
                                    &times;
                                </button>
                            </div>

                            <div className="modal-body p-4">
                                {/* Header Info */}
                                {/* Premium Timer & Info Bar */}
                                <div className="d-flex align-items-center justify-content-between p-3 mb-4 rounded-3" style={{ background: 'linear-gradient(to right, #f8fafc, #f1f5f9)', border: '1px solid #e2e8f0' }}>
                                    <div className="d-flex align-items-center gap-3">
                                        <div className={`d-flex align-items-center justify-content-center rounded-circle ${timeLeft === 'Expirado' ? 'bg-danger bg-opacity-10 text-danger' : 'bg-primary bg-opacity-10 text-primary'}`} style={{ width: '40px', height: '40px' }}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                                                <path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71V3.5z" />
                                                <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z" />
                                            </svg>
                                        </div>
                                        <div>
                                            <div className="small text-muted fw-bold text-uppercase" style={{ fontSize: '0.65rem', letterSpacing: '0.5px' }}>Tiempo Restante</div>
                                            <div className={`fw-bold ${timeLeft === 'Expirado' ? 'text-danger' : 'text-primary'}`} style={{ fontSize: '1.2rem', lineHeight: '1' }}>
                                                {timeLeft}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="text-end border-start ps-3 ms-3">
                                        <div className="small text-muted mb-1">
                                            <span className="fw-semibold text-dark">{userName}</span> (Editor)
                                        </div>
                                        <div className="small text-secondary bg-white px-2 py-1 rounded border d-inline-block">
                                            Inicio: {editLockInfo?.startedAt ? new Date(editLockInfo.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                                        </div>
                                    </div>
                                </div>

                                {editError && <div className="alert alert-danger">{editError}</div>}

                                <div className="mb-4">
                                    <h5 className="border-bottom pb-2 text-secondary">Reglas de Edición</h5>
                                    <ul className="small text-muted">
                                        <li>Solo puede agregar fotos (Máximo 2 por registro).</li>
                                        <li>No puede modificar la fecha de origen ni otros datos.</li>
                                        <li>Tiene 1 hora para completar la edición desde el inicio.</li>
                                        <li>Al guardar, se registrará una auditoría permanente.</li>
                                    </ul>
                                </div>

                                {/* Photo Upload Premium Container */}
                                <div className="mb-4 bg-white rounded-3 overflow-hidden shadow-sm" style={{ border: '1px solid #e2e8f0' }}>
                                    <div className="p-3 border-bottom d-flex justify-content-between align-items-center bg-light bg-opacity-50">
                                        <label className="form-label fw-bold mb-0 text-dark d-flex align-items-center gap-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="text-secondary" viewBox="0 0 16 16">
                                                <path d="M6.002 5.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z" />
                                                <path d="M2.002 1a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2h-12zm12 1a1 1 0 0 1 1 1v6.5l-3.777-1.947a.5.5 0 0 0-.577.093l-3.71 3.71-2.66-1.772a.5.5 0 0 0-.63.062L1.002 12V3a1 1 0 0 1 1-1h12z" />
                                            </svg>
                                            Gestión de Evidencias (Fotos)
                                        </label>
                                        <span className={`badge rounded-pill fw-normal px-3 py-2 ${((editingRegistro.fotos?.filter(f => !photosToDelete.includes(f.id)).length || 0) + editPhotos.length) > 2 ? 'bg-danger bg-opacity-10 text-danger border border-danger' : 'bg-success bg-opacity-10 text-success border border-success'}`}>
                                            <span className="fw-bold fs-6 me-1">{(editingRegistro.fotos?.filter(f => !photosToDelete.includes(f.id)).length || 0) + editPhotos.length}</span> / 2 permitidas
                                        </span>
                                    </div>
                                    <div className="p-3">

                                        {/* Scrollable container for all photos */}
                                        <div style={{
                                            maxHeight: '350px',
                                            overflowY: 'auto',
                                            overflowX: 'hidden',
                                            padding: '10px',
                                            backgroundColor: '#fff',
                                            borderRadius: '8px',
                                            border: '1px solid #e0e0e0'
                                        }}>
                                            {/* Existing Photos */}
                                            {editingRegistro.fotos && editingRegistro.fotos.length > 0 && (
                                                <div className="mb-3">
                                                    <h6 className="small text-muted mb-2 sticky-top bg-white py-1">Fotos Actuales (Guardadas):</h6>
                                                    <div className="d-flex flex-column gap-3">
                                                        {editingRegistro.fotos.map((photo, idx) => {
                                                            const isMarkedForDelete = photosToDelete.includes(photo.id);
                                                            return (
                                                                <div
                                                                    key={photo.id || idx}
                                                                    className={`position-relative border rounded shadow-sm ${isMarkedForDelete ? 'opacity-50' : ''}`}
                                                                    style={{
                                                                        backgroundColor: isMarkedForDelete ? '#ffebee' : '#f8f9fa',
                                                                        overflow: 'hidden'
                                                                    }}
                                                                >
                                                                    {/* Image container with horizontal scroll for full-size view */}
                                                                    <div style={{
                                                                        maxHeight: '200px',
                                                                        overflowY: 'auto',
                                                                        overflowX: 'auto',
                                                                        padding: '8px',
                                                                        display: 'flex',
                                                                        justifyContent: 'center'
                                                                    }}>
                                                                        <img
                                                                            src={photo.datos_base64}
                                                                            alt="Foto existente"
                                                                            style={{
                                                                                maxWidth: '100%',
                                                                                height: 'auto',
                                                                                cursor: 'zoom-in',
                                                                                borderRadius: '4px'
                                                                            }}
                                                                            onClick={() => setZoomImage({ url: photo.datos_base64, description: photo.descripcion || 'Foto guardada previamente' })}
                                                                            title="Clic para ampliar"
                                                                        />
                                                                    </div>

                                                                    {/* Delete/Restore button */}
                                                                    <button
                                                                        className={`btn ${isMarkedForDelete ? 'btn-success' : 'btn-danger'} position-absolute d-flex align-items-center justify-content-center p-0 shadow-sm`}
                                                                        style={{
                                                                            width: '28px',
                                                                            height: '28px',
                                                                            top: '8px',
                                                                            right: '8px',
                                                                            zIndex: 10,
                                                                            borderRadius: '50%',
                                                                            border: '2px solid white'
                                                                        }}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            if (isMarkedForDelete) {
                                                                                setPhotosToDelete(prev => prev.filter(id => id !== photo.id));
                                                                            } else {
                                                                                setPhotosToDelete(prev => [...prev, photo.id]);
                                                                            }
                                                                        }}
                                                                        title={isMarkedForDelete ? 'Restaurar foto' : 'Eliminar foto'}
                                                                    >
                                                                        <span style={{ fontSize: '14px', lineHeight: 1, fontWeight: 'bold' }}>
                                                                            {isMarkedForDelete ? '↺' : '✕'}
                                                                        </span>
                                                                    </button>

                                                                    {/* Status label */}
                                                                    <div className={`text-center small py-1 ${isMarkedForDelete ? 'bg-danger text-white' : 'bg-secondary bg-opacity-10 text-muted'}`} style={{ fontSize: '11px' }}>
                                                                        {isMarkedForDelete ? '⚠ Se eliminará al guardar' : '✓ Guardada'}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            {/* New Photos Section */}
                                            {editPhotos.length > 0 && (
                                                <div className="mb-3">
                                                    <h6 className="small text-muted mb-2 sticky-top bg-white py-1 border-top pt-2">Fotos Nuevas (Por guardar):</h6>
                                                    <div className="d-flex flex-column gap-3">
                                                        {editPhotos.map((photo, idx) => (
                                                            <div
                                                                key={idx}
                                                                className="position-relative border rounded shadow-sm"
                                                                style={{
                                                                    backgroundColor: '#e8f5e9',
                                                                    overflow: 'hidden'
                                                                }}
                                                            >
                                                                {/* Image container with scroll for full-size view */}
                                                                <div style={{
                                                                    maxHeight: '200px',
                                                                    overflowY: 'auto',
                                                                    overflowX: 'auto',
                                                                    padding: '8px',
                                                                    display: 'flex',
                                                                    justifyContent: 'center'
                                                                }}>
                                                                    <img
                                                                        src={photo.data}
                                                                        alt="Vista previa"
                                                                        style={{
                                                                            maxWidth: '100%',
                                                                            height: 'auto',
                                                                            cursor: 'zoom-in',
                                                                            borderRadius: '4px'
                                                                        }}
                                                                        onClick={() => setZoomImage({ url: photo.data, description: 'Vista previa - Nueva foto' })}
                                                                        title="Clic para ampliar"
                                                                    />
                                                                </div>

                                                                {/* Delete button */}
                                                                <button
                                                                    className="btn btn-danger position-absolute d-flex align-items-center justify-content-center p-0 shadow-sm"
                                                                    style={{
                                                                        width: '28px',
                                                                        height: '28px',
                                                                        top: '8px',
                                                                        right: '8px',
                                                                        zIndex: 10,
                                                                        borderRadius: '50%',
                                                                        border: '2px solid white'
                                                                    }}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setEditPhotos(prev => prev.filter((_, i) => i !== idx));
                                                                    }}
                                                                    title="Eliminar foto"
                                                                >
                                                                    <span style={{ fontSize: '14px', lineHeight: 1, fontWeight: 'bold' }}>✕</span>
                                                                </button>

                                                                {/* Status label */}
                                                                <div className="text-center small py-1 bg-success bg-opacity-25 text-success" style={{ fontSize: '11px' }}>
                                                                    ★ Nueva - Se guardará
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Empty state */}
                                            {(!editingRegistro.fotos || editingRegistro.fotos.length === 0) && editPhotos.length === 0 && (
                                                <div className="text-center py-4 text-muted">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="currentColor" className="mb-2 opacity-50" viewBox="0 0 16 16">
                                                        <path d="M6.002 5.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z" />
                                                        <path d="M2.002 1a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2h-12zm12 1a1 1 0 0 1 1 1v6.5l-3.777-1.947a.5.5 0 0 0-.577.093l-3.71 3.71-2.66-1.772a.5.5 0 0 0-.63.062L1.002 12V3a1 1 0 0 1 1-1h12z" />
                                                    </svg>
                                                    <p className="small mb-0">No hay fotos aún</p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Upload input - outside the scroll container */}
                                        <div className="mt-3 pt-3 border-top">
                                            <h6 className="small text-muted mb-2">Agregar Nuevas Fotos:</h6>
                                            <input
                                                type="file"
                                                className="form-control"
                                                accept="image/*"
                                                multiple
                                                onChange={handleEditPhotoUpload}
                                                disabled={!!editError || (timeLeft === 'Expirado' && userRole !== 'administrador')}
                                            />
                                            <small className="text-muted d-block mt-1">Formatos aceptados: JPG, PNG, WebP</small>
                                        </div>
                                    </div> {/* Cierre del body p-3 */}
                                </div> {/* Cierre del contenedor principal premium */}

                                {/* History Timeline Premium Container */}
                                <div className="mb-4 bg-white rounded-3 overflow-hidden shadow-sm" style={{ border: '1px solid #e2e8f0' }}>
                                    <h5 className="border-bottom p-3 mb-0 bg-light bg-opacity-50 text-dark fw-bold d-flex align-items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="text-secondary" viewBox="0 0 16 16">
                                            <path d="M8.515 1.019A7 7 0 0 0 8 1V0a8 8 0 0 1 .589.022l-.074.997zm2.004.45a7.003 7.003 0 0 0-.985-.299l.219-.976c.383.086.76.2 1.126.342l-.36.933zm1.37.71a7.01 7.01 0 0 0-.439-.27l.493-.87a8.02 8.02 0 0 1 .979.654l-.615.789a6.996 6.996 0 0 0-.418-.302zm1.834 1.79a6.99 6.99 0 0 0-.653-.796l.724-.69c.27.285.52.59.747.91l-.818.576zm.744 1.352a7.08 7.08 0 0 0-.214-.468l.893-.45a7.976 7.976 0 0 1 .45 1.088l-.95.313a7.023 7.023 0 0 0-.179-.483zm.53 2.507a6.991 6.991 0 0 0-.1-1.025l.985-.17c.067.386.106.778.116 1.17l-1 .025zm-.131 1.538c.033-.17.06-.339.081-.51l.993.123a7.957 7.957 0 0 1-.23 1.155l-.964-.267c.046-.165.086-.332.12-.501zm-.952 2.379c.184-.29.346-.594.486-.908l.914.405c-.16.36-.345.706-.555 1.038l-.845-.535zm-.964 1.205c.122-.122.239-.248.35-.378l.758.653a8.073 8.073 0 0 1-.401.432l-.707-.707z" />
                                            <path d="M8 1a7 7 0 1 0 4.95 11.95l.707.707A8.001 8.001 0 1 1 8 0v1z" />
                                            <path d="M7.5 3a.5.5 0 0 1 .5.5v5.21l3.248 1.856a.5.5 0 0 1-.496.868l-3.5-2A.5.5 0 0 1 7 9V3.5a.5.5 0 0 1 .5-.5z" />
                                        </svg>
                                        Historial de Cambios
                                    </h5>
                                    <div style={{
                                        maxHeight: '250px',
                                        overflowY: 'auto',
                                        backgroundColor: '#fff',
                                        borderRadius: '0 0 8px 8px',
                                        padding: '10px'
                                    }}>
                                        {editHistory.length === 0 ? (
                                            <p className="text-muted small fst-italic py-3 text-center mb-0">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="opacity-50 d-block mx-auto mb-2" viewBox="0 0 16 16">
                                                    <path d="M8.515 1.019A7 7 0 0 0 8 1V0a8 8 0 0 1 .589.022l-.074.997zm2.004.45a7.003 7.003 0 0 0-.985-.299l.219-.976c.383.086.76.2 1.126.342l-.36.933zm1.37.71a7.01 7.01 0 0 0-.439-.27l.493-.87a8.02 8.02 0 0 1 .979.654l-.615.789a6.996 6.996 0 0 0-.418-.302zm1.834 1.79a6.99 6.99 0 0 0-.653-.796l.724-.69c.27.285.52.59.747.91l-.818.576zm.744 1.352a7.08 7.08 0 0 0-.214-.468l.893-.45a7.976 7.976 0 0 1 .45 1.088l-.95.313a7.023 7.023 0 0 0-.179-.483zm.53 2.507a6.991 6.991 0 0 0-.1-1.025l.985-.17c.067.386.106.778.116 1.17l-1 .025zm-.131 1.538c.033-.17.06-.339.081-.51l.993.123a7.957 7.957 0 0 1-.23 1.155l-.964-.267c.046-.165.086-.332.12-.501zm-.952 2.379c.184-.29.346-.594.486-.908l.914.405c-.16.36-.345.706-.555 1.038l-.845-.535zm-.964 1.205c.122-.122.239-.248.35-.378l.758.653a8.073 8.073 0 0 1-.401.432l-.707-.707z" />
                                                    <path d="M8 1a7 7 0 1 0 4.95 11.95l.707.707A8.001 8.001 0 1 1 8 0v1z" />
                                                    <path d="M7.5 3a.5.5 0 0 1 .5.5v5.21l3.248 1.856a.5.5 0 0 1-.496.868l-3.5-2A.5.5 0 0 1 7 9V3.5a.5.5 0 0 1 .5-.5z" />
                                                </svg>
                                                No hay ediciones previas registradas.
                                            </p>
                                        ) : (
                                            <div className="d-flex flex-column gap-2">
                                                {editHistory.map(hist => {
                                                    const actionStr = hist.action || '';
                                                    const addMatch = actionStr.match(/add_photo:(\d+)/);
                                                    const delMatch = actionStr.match(/delete_photo:(\d+)/);
                                                    // Handle both "add_photo:1" and "add_photo" formats
                                                    const addCount = addMatch ? parseInt(addMatch[1]) : (actionStr.includes('add_photo') ? 1 : 0);
                                                    const delCount = delMatch ? parseInt(delMatch[1]) : (actionStr.includes('delete_photo') && !delMatch ? 1 : 0);

                                                    return (
                                                        <div key={hist.id} className="border-0 rounded-3 p-3 bg-light bg-opacity-50 hover-bg-light transition-all" style={{ borderLeft: `3px solid ${hist.role === 'administrador' ? '#607d8b' : '#94a3b8'}` }}>
                                                            <div className="d-flex justify-content-between align-items-center mb-2">
                                                                <div className="d-flex align-items-center gap-2">
                                                                    <span className={`badge rounded-pill fw-normal d-inline-flex align-items-center gap-1 px-2 py-1 ${hist.role === 'administrador' ? 'bg-secondary bg-opacity-75' : 'bg-secondary bg-opacity-50'}`} style={{ fontSize: '0.75rem' }}>
                                                                        {hist.role === 'administrador' ? (
                                                                            <>
                                                                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="currentColor" viewBox="0 0 16 16">
                                                                                    <path d="M14 6.551V11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6.551l7-1.75 7 1.75zM15 11V5l-7 1.75L1 5v6a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3z" />
                                                                                    <path d="M14.5 3a.5.5 0 0 1 .5.5v1.101l-7 1.75-7-1.75V3.5a.5.5 0 0 1 .5-.5h13z" />
                                                                                </svg>
                                                                                Admin
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="currentColor" viewBox="0 0 16 16">
                                                                                    <path d="M3 14s-1 0-1-1 1-4 6-4 6 3 6 4-1 1-1 1H3zm5-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
                                                                                </svg>
                                                                                Trabajador
                                                                            </>
                                                                        )}
                                                                    </span>
                                                                    <strong className="text-dark" style={{ fontSize: '0.9rem' }}>
                                                                        {hist.usuarios?.nombre_completo || 'Usuario'}
                                                                    </strong>
                                                                </div>
                                                                <small className="text-muted fw-light" style={{ fontSize: '0.75rem' }}>
                                                                    {new Date(hist.created_at).toLocaleString()}
                                                                </small>
                                                            </div>
                                                            <div className="d-flex flex-wrap gap-2 ms-1">
                                                                {addCount > 0 && (
                                                                    <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 fw-medium px-2 py-1" style={{ fontSize: '0.75rem' }}>
                                                                        + Agregó {addCount} foto{addCount > 1 ? 's' : ''}
                                                                    </span>
                                                                )}
                                                                {delCount > 0 && (
                                                                    <span className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 fw-medium px-2 py-1" style={{ fontSize: '0.75rem' }}>
                                                                        − Eliminó {delCount} foto{delCount > 1 ? 's' : ''}
                                                                    </span>
                                                                )}
                                                                {addCount === 0 && delCount === 0 && (
                                                                    <span className="badge bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-25 fw-medium px-2 py-1" style={{ fontSize: '0.75rem' }}>
                                                                        ✎ Editó registro
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>

                            </div>

                            <div className="modal-footer sticky-bottom bg-white border-top p-3" style={{ margin: '0 -1.5rem -1.5rem -1.5rem', zIndex: 100 }}>
                                <button className="btn btn-secondary px-4" onClick={handleCancelEdit}>Cancelar Edición</button>
                                <button
                                    className="btn btn-warning fw-bold px-4"
                                    onClick={handleSaveEdit}
                                    disabled={(editPhotos.length === 0 && photosToDelete.length === 0) || !!editError || (timeLeft === 'Expirado' && userRole !== 'administrador')}
                                >
                                    Guardar Cambios
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

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

        .detail-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .detail-item {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .detail-item strong {
          color: #6c757d;
          font-size: 0.875rem;
        }

        .observations {
          margin-bottom: 1.5rem;
          padding: 1rem;
          background: #f8f9fa;
          border-radius: 0.25rem;
        }

        .observations p {
          margin: 0.5rem 0 0 0;
        }

        h4 {
          margin: 1.5rem 0 1rem 0;
          color: #333;
        }

        .photos-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 1rem;
          margin-top: 1rem;
        }

        .photo-card {
          border: 1px solid #dee2e6;
          border-radius: 0.5rem;
          overflow: hidden;
          background: white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
          transition: transform 0.2s;
        }
        
        .photo-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }

        .photo-frame {
            height: 140px;
            width: 100%;
            background: #f8f9fa;
            border-bottom: 1px solid #eee;
        }

        .photo-img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
        }

        .photo-caption {
            padding: 0.75rem;
            font-size: 0.85rem;
            color: #495057;
            background: white;
            line-height: 1.4;
        }

        @media (max-width: 768px) {
          .detail-grid {
            grid-template-columns: 1fr;
          }
        }

        /* Lightbox CSS */
        .zoom-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0,0,0,0.9);
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 2rem;
            cursor: zoom-out;
            animation: fadeIn 0.3s ease;
        }

        .zoom-content {
            position: relative;
            max-width: 95%;
            max-height: 95%;
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        .zoom-img {
            max-width: 100%;
            max-height: 85vh;
            object-fit: contain;
            border-radius: 4px;
            box-shadow: 0 0 20px rgba(0,0,0,0.5);
            animation: zoomIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .zoom-caption {
            color: white;
            margin-top: 1.5rem;
            background: rgba(0,0,0,0.5);
            padding: 0.5rem 1.5rem;
            border-radius: 20px;
            font-size: 1.1rem;
            text-align: center;
        }

        .zoom-close {
            position: absolute;
            top: -40px;
            right: 0;
            color: white;
            font-size: 2rem;
            cursor: pointer;
            background: none;
            border: none;
            line-height: 1;
        }

        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        @keyframes zoomIn {
            from { transform: scale(0.9); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
        }
      `}</style>

            {
                zoomImage && (
                    <div className="zoom-overlay" onClick={() => setZoomImage(null)}>
                        <div className="zoom-content" onClick={e => e.stopPropagation()}>
                            <button className="zoom-close" onClick={() => setZoomImage(null)}>&times;</button>
                            <img src={zoomImage.url} alt="Zoom" className="zoom-img" />
                            {zoomImage.description && (
                                <div className="zoom-caption">{zoomImage.description}</div>
                            )}
                        </div>
                    </div>
                )
            }
        </>
    );
}
