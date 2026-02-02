'use client';
import { useState, useEffect, useMemo } from 'react';
import { normalizeString } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

interface DownloadRecord {
    id: number;
    start_date: string;
    end_date: string;
    total_files: number;
    status: 'pending' | 'processing' | 'ready' | 'error';
    error_message: string | null;
    created_at: string;
    zip_path: string | null;
    usuarios: {
        nombre_completo: string;
    };
}

export default function DownloadHistory() {
    const [downloads, setDownloads] = useState<DownloadRecord[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [selectedYear, setSelectedYear] = useState<string>('');
    const [selectedMonth, setSelectedMonth] = useState<string>('');
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

    const fetchDownloads = async () => {
        try {
            const res = await fetch('/api/downloads/history');
            if (res.ok) {
                const data = await res.json();
                setDownloads(data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDownloads();
        // Polling
        const interval = setInterval(fetchDownloads, 5000);
        return () => clearInterval(interval);
    }, []);

    // Derived Data for Filters
    const availableYears = useMemo(() => {
        const years = new Set(downloads.map(d => new Date(d.created_at).getFullYear()));
        return Array.from(years).sort((a, b) => b - a);
    }, [downloads]);

    const availableMonths = useMemo(() => {
        if (!selectedYear) return [];
        const year = parseInt(selectedYear);
        const months = new Set(
            downloads
                .filter(d => new Date(d.created_at).getFullYear() === year)
                .map(d => new Date(d.created_at).getMonth())
        );
        return Array.from(months).sort((a, b) => a - b);
    }, [downloads, selectedYear]);

    // Auto-select latest filters
    useEffect(() => {
        if (!loading && downloads.length > 0) {
            if (!selectedYear || !availableYears.includes(parseInt(selectedYear))) {
                if (availableYears.length > 0) setSelectedYear(availableYears[0].toString());
            }
        }
    }, [loading, downloads, availableYears, selectedYear]);

    useEffect(() => {
        if (!loading && availableMonths.length > 0) {
            if (!selectedMonth || !availableMonths.includes(parseInt(selectedMonth))) {
                setSelectedMonth(availableMonths[availableMonths.length - 1].toString());
            }
        }
    }, [loading, availableMonths, selectedMonth]);

    const MONTH_NAMES = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    const getStatusBadge = (status: string) => {
        const style = { padding: '0.25em 0.6em', borderRadius: '0.25rem', fontSize: '0.75em', fontWeight: 700, color: 'white' };
        switch (status) {
            case 'pending': return <span style={{ ...style, backgroundColor: '#6c757d' }}>Pendiente</span>;
            case 'processing': return <span style={{ ...style, backgroundColor: '#ffc107', color: 'black' }}>Procesando</span>;
            case 'ready': return <span style={{ ...style, backgroundColor: '#198754' }}>Listo</span>;
            case 'error': return <span style={{ ...style, backgroundColor: '#dc3545' }}>Error</span>;
            default: return status;
        }
    };

    // Filter Logic
    const filteredDownloads = useMemo(() => {
        if (!selectedYear || !selectedMonth) return [];

        let filtered = downloads.filter(d =>
            new Date(d.created_at).getFullYear().toString() === selectedYear &&
            new Date(d.created_at).getMonth().toString() === selectedMonth
        );

        if (debouncedSearch) {
            const search = normalizeString(debouncedSearch);
            filtered = filtered.filter(d =>
                normalizeString(d.usuarios?.nombre_completo || '').includes(search) ||
                normalizeString(d.start_date).includes(search) ||
                normalizeString(d.end_date).includes(search)
            );
        }

        return filtered.slice(0, limit);
    }, [downloads, selectedYear, selectedMonth, debouncedSearch, limit]);

    if (loading && downloads.length === 0) return (
        <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Cargando...</span>
            </div>
        </div>
    );

    return (
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
                            placeholder="Buscar usuario..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ fontSize: '0.9rem', backgroundColor: '#f8f9fa', paddingLeft: '35px' }}
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="table-responsive">
                    <table className="table table-hover mb-0 align-middle">
                        <thead className="table-light text-secondary text-uppercase small">
                            <tr>
                                <th className="ps-3 fw-semibold text-secondary">Fecha Solicitud</th>
                                <th className="fw-semibold text-secondary">Usuario</th>
                                <th className="fw-semibold text-secondary">Rango</th>
                                <th className="fw-semibold text-secondary">Estado</th>
                                <th className="fw-semibold text-secondary">Archivos</th>
                                <th className="text-end pe-3 fw-semibold text-secondary">Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredDownloads.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-4 text-muted">
                                        No se encontraron descargas con los filtros actuales.
                                    </td>
                                </tr>
                            ) : (
                                filteredDownloads.map(d => (
                                    <tr key={d.id}>
                                        <td className="ps-3 text-muted fw-medium">{new Date(d.created_at).toLocaleString('es-PE')}</td>
                                        <td className="fw-bold text-dark">{d.usuarios?.nombre_completo || 'Desconocido'}</td>
                                        <td className="text-muted">{d.start_date.split('-').reverse().join('-')} al {d.end_date.split('-').reverse().join('-')}</td>
                                        <td>
                                            {getStatusBadge(d.status)}
                                            {d.error_message && <div className="text-danger small mt-1">{d.error_message}</div>}
                                        </td>
                                        <td className="text-dark">{d.total_files}</td>
                                        <td className="text-end pe-3">
                                            {d.status === 'ready' && (
                                                <a
                                                    href={`/api/downloads/${d.id}/download`}
                                                    target="_blank"
                                                    className="btn btn-sm btn-link text-primary p-0 text-decoration-none fw-medium"
                                                    title="Descargar archivo ZIP"
                                                >
                                                    Descargar ZIP
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-file-earmark-arrow-down ms-1" viewBox="0 0 16 16">
                                                        <path d="M8.5 6.5a.5.5 0 0 0-1 0v3.793L6.354 9.146a.5.5 0 1 0-.708.708l2 2a.5.5 0 0 0 .708 0l2-2a.5.5 0 0 0-.708-.708L8.5 10.293V6.5z" />
                                                        <path d="M14 14V4.5L9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2zM9.5 3A1.5 1.5 0 0 0 11 4.5h2V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5.5v2z" />
                                                    </svg>
                                                </a>
                                            )}
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
    );
}
