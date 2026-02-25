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

    // Smart polling: only poll when there are pending/processing items
    const hasActiveDownloads = downloads.some(d => d.status === 'pending' || d.status === 'processing');

    useEffect(() => {
        fetchDownloads();
    }, []);

    useEffect(() => {
        if (!hasActiveDownloads) return;
        // Only poll when there are active downloads
        const interval = setInterval(fetchDownloads, 3000);
        return () => clearInterval(interval);
    }, [hasActiveDownloads]);

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
            filtered = filtered.filter(d => {
                const date = new Date(d.created_at);
                const monthStr = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'][date.getMonth()];
                const displayId = `M-${monthStr}${String(d.id).padStart(4, '0')}`;

                // Las fechas en UI se ven DD-MM-YYYY
                const formattedStartDate = d.start_date ? d.start_date.split('-').reverse().join('-') : '';
                const formattedStartDateSlash = d.start_date ? d.start_date.split('-').reverse().join('/') : '';
                const formattedEndDate = d.end_date ? d.end_date.split('-').reverse().join('-') : '';
                const formattedEndDateSlash = d.end_date ? d.end_date.split('-').reverse().join('/') : '';
                const formattedCreatedAt = date.toLocaleString('es-PE');

                return normalizeString(d.usuarios?.nombre_completo || '').includes(search) ||
                    normalizeString(d.start_date).includes(search) ||
                    normalizeString(formattedStartDate).includes(search) ||
                    normalizeString(formattedStartDateSlash).includes(search) ||
                    normalizeString(d.end_date).includes(search) ||
                    normalizeString(formattedEndDate).includes(search) ||
                    normalizeString(formattedEndDateSlash).includes(search) ||
                    normalizeString(formattedCreatedAt).includes(search) ||
                    d.id.toString().includes(search) ||
                    normalizeString(displayId).includes(search);
            });
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
                <div className="toolbar-row">
                    {/* Left Side: Filters */}
                    <div className="toolbar-filters">
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
                    <div className="toolbar-search">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" className="search-icon" viewBox="0 0 16 16">
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

                {/* Desktop Table */}
                <div className="desktop-table">
                    <div className="table-responsive">
                        <table className="table table-hover mb-0 align-middle">
                            <thead className="table-light text-secondary text-uppercase small">
                                <tr>
                                    <th className="ps-3 fw-semibold text-secondary">ID</th>
                                    <th className="fw-semibold text-secondary">Fecha Solicitud</th>
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
                                        <td colSpan={7} className="text-center py-4 text-muted">
                                            No se encontraron descargas con los filtros actuales.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredDownloads.map(d => {
                                        const date = new Date(d.created_at);
                                        const monthStr = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'][date.getMonth()];
                                        const displayId = `M-${monthStr}${String(d.id).padStart(4, '0')}`;

                                        return (
                                            <tr key={d.id}>
                                                <td className="ps-3 fw-bold text-primary">{displayId}</td>
                                                <td className="text-muted fw-medium">{new Date(d.created_at).toLocaleString('es-PE')}</td>
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
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Mobile Cards */}
                <div className="mobile-cards">
                    {filteredDownloads.length === 0 ? (
                        <div className="text-center py-4 text-muted">
                            No se encontraron descargas con los filtros actuales.
                        </div>
                    ) : (
                        filteredDownloads.map(d => {
                            const date = new Date(d.created_at);
                            const monthStr = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'][date.getMonth()];
                            const displayId = `M-${monthStr}${String(d.id).padStart(4, '0')}`;

                            return (
                                <div key={d.id} className="mobile-card">
                                    <div className="mobile-card-header">
                                        <span className="mobile-card-users fw-bold text-primary">{displayId}</span>
                                        {getStatusBadge(d.status)}
                                    </div>
                                    <div className="mobile-card-body">
                                        <div className="mobile-card-row mb-1">
                                            <span className="label">Usuario:</span>
                                            <span className="value fw-bold">{d.usuarios?.nombre_completo || 'Desconocido'}</span>
                                        </div>
                                        <div className="mobile-card-row">
                                            <span className="label">Fecha:</span>
                                            <span className="value">{new Date(d.created_at).toLocaleString('es-PE')}</span>
                                        </div>
                                        <div className="mobile-card-row">
                                            <span className="label">Rango:</span>
                                            <span className="value">{d.start_date.split('-').reverse().join('-')} al {d.end_date.split('-').reverse().join('-')}</span>
                                        </div>
                                        <div className="mobile-card-row">
                                            <span className="label">Archivos:</span>
                                            <span className="value">{d.total_files}</span>
                                        </div>
                                        {d.error_message && (
                                            <div className="text-danger small mt-1">{d.error_message}</div>
                                        )}
                                    </div>
                                    {d.status === 'ready' && (
                                        <div className="mobile-card-actions">
                                            <a
                                                href={`/api/downloads/${d.id}/download`}
                                                target="_blank"
                                                className="mobile-action-btn download"
                                            >
                                                ⬇ Descargar ZIP
                                            </a>
                                        </div>
                                    )}
                                </div>
                            )
                        })
                    )}
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
            <style jsx>{`
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
                    padding-bottom: 8px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .mobile-card-users {
                    font-weight: 800;
                    font-size: 0.95rem;
                    color: #1e293b;
                }
                .mobile-card-body {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    margin-bottom: 10px;
                }
                .mobile-card-row {
                    display: flex;
                    justify-content: space-between;
                    font-size: 0.85rem;
                }
                .mobile-card-row .label {
                    color: #64748b;
                    font-weight: 500;
                }
                .mobile-card-row .value {
                    color: #334155;
                    font-weight: 600;
                    text-align: right;
                }
                .mobile-card-actions {
                    display: flex;
                    gap: 8px;
                    padding-top: 5px;
                }
                .mobile-action-btn {
                    flex: 1;
                    padding: 8px 0;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    background: #f8fafc;
                    font-size: 0.85rem;
                    font-weight: 600;
                    cursor: pointer;
                    text-align: center;
                    transition: background 0.2s;
                    text-decoration: none;
                    display: block;
                }
                .mobile-action-btn:hover { background: #e2e8f0; }
                .mobile-action-btn.download { color: #2563eb; background: #eff6ff; border-color: #bfdbfe; }

                /* ===== MOBILE BREAKPOINT ===== */
                @media (max-width: 768px) {
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
                }
            `}</style>
        </div>
    );
}
