'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { createClient } from '@/lib/supabase/client';
import { formatDate, normalizeString } from '@/lib/utils';
import type { Registro, Control, Foto } from '@/lib/supabase/types';



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

    // Grouping Logic with Filters
    const groupedRegistros = useMemo(() => {
        // If year or month not selected, return empty
        if (!selectedYear || !selectedMonth) {
            return [];
        }

        let filtered = [...registros];

        // Apply filters
        filtered = filtered.filter(r =>
            new Date(r.fecha_registro).getFullYear().toString() === selectedYear &&
            new Date(r.fecha_registro).getMonth().toString() === selectedMonth
        );

        // Apply Search (Debounced)
        if (debouncedSearch) {
            const normalizedSearch = normalizeString(debouncedSearch);
            filtered = filtered.filter(r =>
                normalizeString(r.lote_interno).includes(normalizedSearch) ||
                normalizeString(r.producto_nombre).includes(normalizedSearch) ||
                normalizeString(r.verificado_por || r.usuario_nombre || '').includes(normalizedSearch)
            );
        }

        // Sort by date desc
        const sorted = filtered.sort((a, b) =>
            new Date(b.fecha_registro).getTime() - new Date(a.fecha_registro).getTime()
        );

        // Apply Limit (to total records)
        const confined = sorted.slice(0, limit);

        const groups: { title: string; items: RegistroWithDetails[] }[] = [];

        confined.forEach(reg => {
            const date = new Date(reg.fecha_registro);
            const key = date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
            const formattedKey = key.charAt(0).toUpperCase() + key.slice(1);

            let lastGroup = groups[groups.length - 1];
            if (!lastGroup || lastGroup.title !== formattedKey) {
                lastGroup = { title: formattedKey, items: [] };
                groups.push(lastGroup);
            }
            lastGroup.items.push(reg);
        });

        return groups;
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

            <main className="container mt-4">
                <div className="d-flex justify-content-between align-items-center mb-4">
                    <h2 className="mb-0 fw-bold text-dark">Historial de Registros</h2>
                </div>

                <div className="card shadow-sm border-0 bg-white" style={{ borderRadius: '12px', minHeight: '600px' }}>
                    <div className="card-body p-4">

                        {/* Toolbar */}
                        {/* Toolbar */}
                        {/* Toolbar */}
                        <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid #dee2e6' }}>
                            {/* Left Side: Filters */}
                            <div style={{ display: 'flex', flexDirection: 'row', gap: '10px', alignItems: 'center' }}>
                                <select
                                    className="form-select form-select-sm rounded-pill border-secondary-subtle bg-light text-secondary fw-medium shadow-none"
                                    value={selectedYear}
                                    onChange={(e) => setSelectedYear(e.target.value)}
                                    aria-label="Año"
                                    style={{ width: 'auto', display: 'inline-block' }}
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
                                    style={{ width: 'auto', display: 'inline-block' }}
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
                        {groupedRegistros.length === 0 ? (
                            <div className="empty-state text-center py-5">
                                <div className="mb-3 text-secondary" style={{ opacity: 0.5 }}>
                                    {/* Icon removed as requested */}
                                </div>
                                {!selectedYear || !selectedMonth ? (
                                    <p className="text-muted">Seleccione año y mes para ver los registros.</p>
                                ) : (
                                    <p className="text-muted">No se encontraron registros con los filtros actuales.</p>
                                )}
                            </div>
                        ) : (
                            groupedRegistros.map((group) => (
                                <div key={group.title} className="mb-5 group-section">
                                    <h5 className="text-secondary fw-bold mb-3 border-start border-4 border-primary ps-2">{group.title}</h5>
                                    <div className="table-responsive">
                                        <table className="table table-hover align-middle">
                                            <thead className="table-light text-secondary text-uppercase small">
                                                <tr>
                                                    <th className="fw-semibold text-secondary" style={{ width: '15%' }}>Fecha</th>
                                                    <th className="fw-semibold text-secondary" style={{ width: '15%' }}>Lote Interno</th>
                                                    <th className="fw-semibold text-secondary" style={{ width: '35%' }}>Producto</th>
                                                    <th className="fw-semibold text-secondary" style={{ width: '20%' }}>Verificado por</th>
                                                    <th className="fw-semibold text-secondary text-end" style={{ width: '15%' }}>Acciones</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {group.items.map((registro) => (
                                                    <tr key={registro.id}>
                                                        <td className="text-muted fw-medium">{formatDate(registro.fecha_registro).split(',')[0]}</td>
                                                        <td className="fw-bold text-dark">{registro.lote_interno}</td>
                                                        <td className="text-dark">{registro.producto_nombre}</td>
                                                        <td className="text-secondary small">
                                                            <div className="d-flex align-items-center gap-2">
                                                                {registro.verificado_por || registro.usuario_nombre}
                                                            </div>
                                                        </td>
                                                        <td className="text-end">
                                                            <div className="d-flex justify-content-end gap-2">
                                                                <button
                                                                    className="btn btn-sm btn-link text-primary p-0 text-decoration-none fw-medium"
                                                                    onClick={() => viewDetails(registro)}
                                                                >
                                                                    Ver
                                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" className="bi bi-eye ms-1" viewBox="0 0 16 16">
                                                                        <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z" />
                                                                        <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z" />
                                                                    </svg>
                                                                </button>
                                                                <span className="text-muted separator">|</span>
                                                                <button
                                                                    className="btn btn-sm btn-link text-secondary p-0 text-decoration-none"
                                                                    onClick={() => handleDownloadPDF(registro)}
                                                                    disabled={downloadingId === registro.id}
                                                                >
                                                                    {downloadingId === registro.id ? '...' : (
                                                                        <>
                                                                            PDF
                                                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" className="bi bi-file-earmark-arrow-down ms-1" viewBox="0 0 16 16">
                                                                                <path d="M8.5 6.5a.5.5 0 0 0-1 0v3.793L6.354 9.146a.5.5 0 1 0-.708.708l2 2a.5.5 0 0 0 .708 0l2-2a.5.5 0 0 0-.708-.708L8.5 10.293V6.5z" />
                                                                                <path d="M14 14V4.5L9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2zM9.5 3A1.5 1.5 0 0 0 11 4.5h2V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5.5v2z" />
                                                                            </svg>
                                                                        </>
                                                                    )}
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ))
                        )}


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

            <style jsx>{`
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

            {/* Lightbox / Zoom Modal */}
            {zoomImage && (
                <div className="zoom-overlay" onClick={() => setZoomImage(null)}>
                    <div className="zoom-content" onClick={e => e.stopPropagation()}>
                        <button className="zoom-close" onClick={() => setZoomImage(null)}>&times;</button>
                        <img src={zoomImage.url} alt="Zoom" className="zoom-img" />
                        {zoomImage.description && (
                            <div className="zoom-caption">{zoomImage.description}</div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
