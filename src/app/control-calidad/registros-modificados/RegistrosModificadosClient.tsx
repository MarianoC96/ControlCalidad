'use client';

import React, { useState, useEffect } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { formatDate } from '@/lib/utils';
import LoadingOverlay from '@/components/LoadingOverlay';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function RegistrosModificadosClient() {
    const router = useRouter();
    const [selectedHistory, setSelectedHistory] = useState<any[]>([]);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [selectedDetail, setSelectedDetail] = useState<any>(null);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [zoomImage, setZoomImage] = useState<{ url: string, description?: string } | null>(null);

    const { data: response, error, isLoading } = useSWR('/api/registros/modificados', fetcher);

    const registros = response?.data || [];

    const handleViewHistory = async (registroId: number) => {
        setLoadingHistory(true);
        try {
            const res = await fetch(`/api/registros/history?id=${registroId}`);
            if (res.ok) {
                const data = await res.json();
                setSelectedHistory(data);
                setIsHistoryModalOpen(true);
            }
        } catch (err) {
            console.error('Error fetching history:', err);
        } finally {
            setLoadingHistory(false);
        }
    };

    if (isLoading) return <LoadingOverlay message="Cargando registros modificados..." />;

    return (
        <>
            <main className="page-container">
                <div className="header-card">
                    <div className="header-info">
                        <div className="badge"><span className="dot"></span>AUDITORÍA</div>
                        <h1 className="title">Registros Modificados</h1>
                        <p className="subtitle">Visualice únicamente los registros que han tenido ediciones técnicas.</p>
                    </div>
                    <div className="stats">
                        <div className="stat-pill">
                            <span className="val">{registros.length}</span>
                            <span className="lab">MODIFICADOS</span>
                        </div>
                    </div>
                </div>

                <div className="content-card">
                    <div className="table-wrapper">
                        <table className="custom-table">
                            <thead>
                                <tr>
                                    <th>ID REGISTRO</th>
                                    <th>LOTE INTERNO</th>
                                    <th>PRODUCTO</th>
                                    <th>ÚLTIMA EDICIÓN</th>
                                    <th className="text-end">ACCIONES</th>
                                </tr>
                            </thead>
                            <tbody>
                                {registros.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="empty-row">No se encontraron registros modificados.</td>
                                    </tr>
                                ) : (
                                    registros.map((reg: any) => {
                                        const d = new Date(reg.fecha_registro);
                                        const mes = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'][d.getMonth()];
                                        const displayId = `${mes}${String(reg.id).padStart(4, '0')}`;

                                        return (
                                            <tr key={reg.id}>
                                                <td className="id-cell">{displayId}</td>
                                                <td className="fw-bold">{reg.lote_interno}</td>
                                                <td>{reg.producto_nombre}</td>
                                                <td className="date-cell">
                                                    <span className="recent-badge">Reciente</span>
                                                    {formatDate(reg.ultima_modificacion)}
                                                </td>
                                                <td className="text-end">
                                                    <button
                                                        className="btn-history"
                                                        onClick={() => handleViewHistory(reg.id)}
                                                        disabled={loadingHistory}
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                                            <path d="M8.515 1.019A7 7 0 0 0 8 1V0a8 8 0 0 1 .589.022l-.074.997zm2.004.45a7.003 7.003 0 0 0-.985-.299l.219-.976c.383.086.76.2 1.126.342l-.36.933zm1.37.71a7.01 7.01 0 0 0-.439-.27l.493-.87a8.02 8.02 0 0 1 .979.654l-.615.789a6.996 6.996 0 0 0-.418-.302zm1.834 1.79a6.99 6.99 0 0 0-.653-.796l.724-.69c.27.285.52.59.747.91l-.818.576zm.744 1.352a7.08 7.08 0 0 0-.214-.468l.893-.45a7.976 7.976 0 0 1 .45 1.088l-.95.313a7.023 7.023 0 0 0-.179-.483zm.53 2.507a6.991 6.991 0 0 0-.1-1.025l.985-.17c.067.386.106.778.116 1.17l-1 .025zm-.131 1.538c.033-.17.06-.339.081-.51l.993.123a7.957 7.957 0 0 1-.23 1.155l-.964-.267c.046-.165.086-.332.12-.501zm-.952 2.379c.184-.29.346-.594.486-.908l.914.405c-.16.36-.345.706-.555 1.038l-.845-.535zm-.964 1.205c.122-.122.239-.248.35-.378l.758.653a8.073 8.073 0 0 1-.401.432l-.707-.707z" />
                                                            <path d="M8 1a7 7 0 1 0 4.95 11.95l.707.707A8.001 8.001 0 1 1 8 0v1z" />
                                                        </svg>
                                                        Historial
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>

            {/* History Modal */}
            {isHistoryModalOpen && (
                <div className="modal-overlay" onClick={() => setIsHistoryModalOpen(false)}>
                    <div className="modal-card" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <h3>Historial de Ediciones</h3>
                                <p>Todos los cambios realizados a este registro</p>
                            </div>
                            <button className="close-btn" onClick={() => setIsHistoryModalOpen(false)}>&times;</button>
                        </div>
                        <div className="modal-body p-0">
                            <div className="history-list">
                                {selectedHistory.map((item, idx) => (
                                    <div key={item.id} className="history-item" onClick={() => setSelectedDetail(item)}>
                                        <div className="item-main">
                                            <div className="user-icon">{item.usuarios?.nombre_completo?.charAt(0) || 'U'}</div>
                                            <div className="info">
                                                <div className="user-name">{item.usuarios?.nombre_completo}</div>
                                                <div className="timestamp">{formatDate(item.created_at)}</div>
                                            </div>
                                        </div>
                                        <div className="action-tag">
                                            {(() => {
                                                if (!item.action) return 'Edición general';
                                                const parts = item.action.split(',');
                                                const summary = [];
                                                if (parts.some((p: string) => p.startsWith('field_edit'))) summary.push('Campos editados');
                                                if (parts.some((p: string) => p.startsWith('add_photo'))) summary.push('Fotos agregadas');
                                                if (parts.some((p: string) => p.startsWith('delete_photo'))) summary.push('Fotos eliminadas');
                                                return summary.length > 0 ? summary.join(', ') : 'Edición general';
                                            })()}
                                        </div>
                                        <div className="chevron">&rsaquo;</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* History Detail Modal (Reusing existing visual logic) */}
            {selectedDetail && (
                <div className="modal-overlay" style={{ zIndex: 2400 }} onClick={() => setSelectedDetail(null)}>
                    <div className="modal-card detail-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header gradient">
                            <div className="d-flex align-items-center gap-3">
                                <div className="detail-icon">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16">
                                        <path d="M8.515 1.019A7 7 0 0 0 8 1V0a8 8 0 0 1 .589.022l-.074.997zm2.004.45a7.003 7.003 0 0 0-.985-.299l.219-.976c.383.086.76.2 1.126.342l-.36.933zm1.37.71a7.01 7.01 0 0 0-.439-.27l.493-.87a8.02 8.02 0 0 1 .979.654l-.615.789a6.996 6.996 0 0 0-.418-.302zm1.834 1.79a6.99 6.99 0 0 0-.653-.796l.724-.69c.27.285.52.59.747.91l-.818.576zm.744 1.352a7.08 7.08 0 0 0-.214-.468l.893-.45a7.976 7.976 0 0 1 .45 1.088l-.95.313a7.023 7.023 0 0 0-.179-.483zm.53 2.507a6.991 6.991 0 0 0-.1-1.025l.985-.17c.067.386.106.778.116 1.17l-1 .025zm-.131 1.538c.033-.17.06-.339.081-.51l.993.123a7.957 7.957 0 0 1-.23 1.155l-.964-.267c.046-.165.086-.332.12-.501zm-.952 2.379c.184-.29.346-.594.486-.908l.914.405c-.16.36-.345.706-.555 1.038l-.845-.535zm-.964 1.205c.122-.122.239-.248.35-.378l.758.653a8.073 8.073 0 0 1-.401.432l-.707-.707z" />
                                    </svg>
                                </div>
                                <div>
                                    <h4 className="m-0">Detalles de la Edición</h4>
                                    <p className="m-0 small text-muted">Auditoría técnica del registro</p>
                                </div>
                            </div>
                            <button className="close-btn" onClick={() => setSelectedDetail(null)}>&times;</button>
                        </div>
                        <div className="modal-body">
                            <div className="responsible-box mb-4">
                                <div className="d-flex align-items-center gap-3">
                                    <div className="user-initial">{selectedDetail.usuarios?.nombre_completo?.charAt(0)}</div>
                                    <div>
                                        <div className="label">RESPONSABLE</div>
                                        <div className="val">{selectedDetail.usuarios?.nombre_completo}</div>
                                    </div>
                                </div>
                                <div className="text-end border-start ps-4">
                                    <div className="label">FECHA Y HORA</div>
                                    <div className="val-small">{new Date(selectedDetail.created_at).toLocaleString('es-PE')}</div>
                                </div>
                            </div>

                            {selectedDetail.field_changes && Object.keys(selectedDetail.field_changes).length > 0 && (
                                <div className="changes-section mb-4 p-4 bg-white border rounded-4 shadow-sm">
                                    <h6 className="section-title mb-4"><span className="badge-tech">CAMBIOS</span> Campos Modificados</h6>
                                    <div className="table-responsive border rounded-3 overflow-hidden">
                                        <table className="table table-sm table-hover mb-0">
                                            <thead>
                                                <tr>
                                                    <th>Campo</th>
                                                    <th>Anterior</th>
                                                    <th>Nuevo</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {Object.entries(selectedDetail.field_changes).map(([field, vals]: [string, any]) => (
                                                    <tr key={field}>
                                                        <td className="text-capitalize fw-bold">{field.replace('_', ' ')}</td>
                                                        <td className="old-val">{vals.old || '-'}</td>
                                                        <td className="new-val">{vals.new || '-'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {selectedDetail.photos_added && selectedDetail.photos_added.length > 0 && (
                                <div className="mb-4 bg-white p-4 rounded-4 border shadow-sm">
                                    <h6 className="fw-bold fs-6 text-dark mb-4 d-flex align-items-center" style={{ gap: '15px' }}>
                                        <span className="badge-tech bg-success" style={{ fontSize: '0.65rem', fontWeight: '800', letterSpacing: '0.5px', borderRadius: '6px', color: '#ffffff' }}>AGREGADO</span>
                                        Fotos Agregadas ({selectedDetail.photos_added.length})
                                    </h6>
                                    <div className="d-flex flex-wrap gap-3">
                                        {selectedDetail.photos_added.map((p: any, i: number) => {
                                            const raw = p?.data || p?.datos_base64 || p?.url || p?.path || (typeof p === 'string' ? p : '');
                                            if (!raw || raw.length < 10) return null;
                                            const clean = raw.trim().replace(/\s/g, '');
                                            const src = (clean.startsWith('data:') || clean.startsWith('http')) ? clean : `data:image/jpeg;base64,${clean}`;

                                            return (
                                                <div
                                                    key={i}
                                                    className="photo-thumb"
                                                    style={{
                                                        width: '100px',
                                                        height: '100px',
                                                        backgroundImage: `url("${src}")`,
                                                        backgroundSize: 'cover',
                                                        backgroundPosition: 'center',
                                                        cursor: 'pointer',
                                                        borderRadius: '8px',
                                                        border: '1px solid #e2e8f0'
                                                    }}
                                                    onClick={() => setZoomImage({ url: src, description: 'Foto agregada' })}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {selectedDetail.photos_deleted && selectedDetail.photos_deleted.length > 0 && (
                                <div className="mb-4 bg-white p-4 rounded-4 border shadow-sm">
                                    <h6 className="fw-bold fs-6 text-dark mb-4 d-flex align-items-center" style={{ gap: '15px' }}>
                                        <span className="badge-tech bg-danger" style={{ fontSize: '0.65rem', fontWeight: '800', letterSpacing: '0.5px', borderRadius: '6px', color: '#ffffff', backgroundColor: '#ef4444' }}>ELIMINADO</span>
                                        Fotos Eliminadas ({selectedDetail.photos_deleted.length})
                                    </h6>
                                    <div className="d-flex flex-wrap gap-3">
                                        {selectedDetail.photos_deleted.map((p: any, i: number) => {
                                            const raw = p?.data || p?.datos_base64 || p?.url || p?.path || (typeof p === 'string' ? p : '');
                                            const id = p?.id || (typeof p === 'number' ? p : 'N/A');

                                            if (!raw || raw.length < 20) {
                                                return (
                                                    <div key={i} className="border border-danger rounded-3 d-flex flex-column align-items-center justify-content-center bg-danger bg-opacity-10 text-danger text-center px-1" style={{ width: '100px', height: '100px' }}>
                                                        <span className="fw-bold" style={{ fontSize: '10px' }}>ID: {id}</span>
                                                        <span style={{ fontSize: '9px' }}>SIN VISTA PREVIA</span>
                                                    </div>
                                                );
                                            }
                                            const clean = raw.trim().replace(/\s/g, '');
                                            const src = (clean.startsWith('data:') || clean.startsWith('http')) ? clean : `data:image/jpeg;base64,${clean}`;

                                            return (
                                                <div
                                                    key={i}
                                                    className="photo-thumb position-relative"
                                                    style={{
                                                        width: '100px',
                                                        height: '100px',
                                                        backgroundImage: `url("${src}")`,
                                                        backgroundSize: 'cover',
                                                        backgroundPosition: 'center',
                                                        cursor: 'pointer',
                                                        borderRadius: '8px',
                                                        border: '1px solid #feb2b2',
                                                        overflow: 'hidden'
                                                    }}
                                                    onClick={() => setZoomImage({ url: src, description: 'Foto eliminada' })}
                                                >
                                                    <div className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ zIndex: 2, pointerEvents: 'none', backgroundColor: 'rgba(220, 53, 69, 0.25)' }}>
                                                        <span className="badge bg-danger shadow-sm px-2 py-1" style={{ fontSize: '0.6rem', fontWeight: 'bold' }}>ELIMINADA</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn-close-modal" onClick={() => setSelectedDetail(null)}>Cerrar Detalles</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Lightbox */}
            {zoomImage && (
                <div className="zoom-overlay" onClick={() => setZoomImage(null)}>
                    <div className="zoom-content" onClick={e => e.stopPropagation()}>
                        <img src={zoomImage.url} alt="Zoom" className="zoom-img" />
                        {zoomImage.description && <div className="zoom-caption">{zoomImage.description}</div>}
                    </div>
                </div>
            )}

            <style jsx>{`
                .page-container {
                    max-width: 1100px;
                    margin: 0 auto;
                    padding: 40px 20px;
                    font-family: 'Inter', system-ui, sans-serif;
                }
                .header-card {
                    background: white;
                    border-radius: 20px;
                    padding: 30px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 25px;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.05);
                }
                .badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    color: #6366f1;
                    font-weight: 800;
                    font-size: 0.75rem;
                    margin-bottom: 10px;
                }
                .dot { width: 8px; height: 8px; background: #6366f1; border-radius: 50%; }
                .title { font-size: 1.8rem; font-weight: 900; color: #1e293b; margin: 0; }
                .subtitle { color: #64748b; font-size: 0.95rem; margin-top: 5px; }
                .stat-pill { background: #f8fafc; padding: 10px 20px; border-radius: 12px; border: 1px solid #e2e8f0; text-align: center; }
                .stat-pill .val { display: block; font-weight: 900; font-size: 1.4rem; color: #1e293b; }
                .stat-pill .lab { font-size: 0.65rem; font-weight: 800; color: #94a3b8; }
                
                .content-card { background: white; border-radius: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); overflow: hidden; }
                .table-wrapper { padding: 20px; }
                .custom-table { width: 100%; border-collapse: collapse; }
                .custom-table th { text-align: left; padding: 15px; border-bottom: 2px solid #f1f5f9; color: #64748b; font-size: 0.75rem; font-weight: 800; text-transform: uppercase; }
                .custom-table td { padding: 15px; border-bottom: 1px solid #f1f5f9; font-size: 0.9rem; color: #334155; }
                .id-cell { font-weight: 800; color: #6366f1; }
                .date-cell { display: flex; align-items: center; gap: 8px; }
                .recent-badge { background: #ecfdf5; color: #059669; font-size: 0.65rem; font-weight: 800; padding: 2px 8px; border-radius: 20px; }
                .btn-history { background: #f1f5f9; border: none; padding: 8px 15px; border-radius: 10px; font-weight: 700; font-size: 0.8rem; color: #475569; display: flex; align-items: center; gap: 8px; cursor: pointer; transition: all 0.2s; }
                .btn-history:hover { background: #e2e8f0; color: #1e293b; }
                .empty-row { text-align: center; padding: 50px !important; color: #94a3b8; }

                /* Modals */
                .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 2200; padding: 20px; }
                .modal-card { background: white; border-radius: 20px; width: 100%; max-width: 500px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); overflow: hidden; animation: slideUp 0.3s ease; }
                .detail-modal { max-width: 700px; }
                .modal-header { padding: 20px 25px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; }
                .modal-header.gradient { background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); }
                .modal-header h3 { margin: 0; font-size: 1.25rem; font-weight: 800; color: #1e293b; }
                .modal-header p { margin: 0; font-size: 0.85rem; color: #64748b; }
                .close-btn { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #94a3b8; }
                
                .history-list { max-height: 420px; overflow-y: auto; overflow-x: hidden; scrollbar-gutter: stable; }
                .history-item { padding: 18px 25px; display: flex; align-items: center; border-bottom: 1px solid #f1f5f9; cursor: pointer; transition: background 0.2s; gap: 12px; }
                .history-item:hover { background: #f8fafc; }
                .item-main { display: flex; align-items: center; gap: 15px; flex: 1; min-width: 0; }
                .info { min-width: 0; flex: 1; }
                .user-icon { width: 40px; height: 40px; background: #6366f1; color: white; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1rem; flex-shrink: 0; box-shadow: 0 4px 10px rgba(99, 102, 241, 0.2); }
                .user-name { font-weight: 700; color: #1e293b; font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }
                .timestamp { font-size: 0.78rem; color: #94a3b8; margin-top: 2px; }
                .action-tag { font-size: 0.7rem; font-weight: 800; color: #6366f1; background: #eef2ff; padding: 5px 12px; border-radius: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 160px; flex-shrink: 0; border: 1px solid #e0e7ff; }
                .chevron { color: #cbd5e1; font-size: 1.5rem; transition: color 0.2s; flex-shrink: 0; }
                .history-item:hover .chevron { color: #6366f1; }
                
                .modal-body { padding: 30px 40px; }
                
                .responsible-box { background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px 25px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 10px rgba(0,0,0,0.02); }
                .user-initial { width: 44px; height: 44px; background: #10b981; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; box-shadow: 0 4px 10px rgba(16, 185, 129, 0.2); }
                .label { font-size: 0.65rem; font-weight: 800; color: #94a3b8; letter-spacing: 0.8px; text-transform: uppercase; }
                .val { font-weight: 900; color: #1e293b; font-size: 1.1rem; }
                .val-small { font-weight: 700; color: #475569; font-size: 0.9rem; background: #f8fafc; padding: 6px 14px; border-radius: 10px; margin-top: 4px; border: 1px solid #e2e8f0; }
                
                .section-title { font-size: 1rem; font-weight: 900; color: #1e293b; margin-bottom: 20px; display: flex; align-items: center; gap: 15px; }
                .badge-tech { font-size: 0.7rem; font-weight: 800; background: rgba(16, 185, 129, 0.1); color: #10b981; padding: 4px 12px; border-radius: 8px; letter-spacing: 0.5px; }
                .old-val { color: #ef4444; background: rgba(239, 68, 68, 0.05); text-decoration: line-through; }
                .new-val { color: #10b981; background: rgba(16, 185, 129, 0.05); font-weight: 700; }
                
                .photo-grid { display: flex; flex-wrap: wrap; gap: 10px; }
                .photo-thumb { width: 80px; height: 80px; border-radius: 10px; background-size: cover; background-position: center; border: 2px solid #f1f5f9; cursor: pointer; transition: transform 0.2s; }
                .photo-thumb:hover { transform: scale(1.05); }
                
                .modal-footer { padding: 20px 25px; display: flex; justify-content: flex-end; }
                .btn-close-modal { background: #1e293b; color: white; border: none; padding: 10px 30px; border-radius: 10px; font-weight: 700; cursor: pointer; }
                
                .zoom-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.9); z-index: 9999; display: flex; align-items: center; justify-content: center; cursor: zoom-out; }
                .zoom-img { max-width: 90%; max-height: 80vh; border-radius: 8px; box-shadow: 0 0 40px rgba(0,0,0,0.5); }
                .zoom-caption { color: white; margin-top: 20px; background: rgba(0,0,0,0.5); padding: 5px 20px; border-radius: 20px; }

                @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                
                @media (max-width: 768px) {
                    .header-card { flex-direction: column; text-align: center; gap: 20px; }
                    .custom-table th:nth-child(3), .custom-table td:nth-child(3) { display: none; }
                }
            `}</style>
        </>
    );
}
