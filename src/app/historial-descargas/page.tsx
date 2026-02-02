'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import DownloadHistory from '@/components/DownloadHistory';
import BulkDownloadModal from '@/components/BulkDownloadModal';
import { useRouter } from 'next/navigation';

export default function HistorialDescargasPage() {
    const router = useRouter();
    const [userName, setUserName] = useState('');
    const [userRole, setUserRole] = useState<'administrador' | 'trabajador'>('trabajador');
    const [loading, setLoading] = useState(true);
    const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
    // Key to trigger refresh in DownloadHistory if needed (though it polls, so might not be strictly necessary, 
    // but good for immediate feedback)
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const response = await fetch('/api/auth/me');
                if (!response.ok) {
                    router.push('/');
                    return;
                }
                const user = await response.json();
                setUserName(user.nombre_completo);
                setUserRole(user.roles);
            } catch (error) {
                console.error('Error checking auth:', error);
            } finally {
                setLoading(false);
            }
        };
        checkAuth();
    }, [router]);

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/');
    };

    if (loading) {
        return (
            <div className="container mt-4 text-center">
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Cargando...</span>
                </div>
            </div>
        );
    }

    return (
        <>
            <Navbar userName={userName} userRole={userRole} onLogout={handleLogout} />

            <main className="container mt-4">
                <div className="d-flex justify-content-between align-items-center mb-4">
                    <h2 className="mb-0 fw-bold text-dark">Historial de Descargas Masivas</h2>
                    <button
                        className="btn btn-primary d-flex align-items-center gap-2"
                        onClick={() => setIsDownloadModalOpen(true)}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-cloud-plus" viewBox="0 0 16 16">
                            <path fillRule="evenodd" d="M8 5.5a.5.5 0 0 1 .5.5v1.5H10a.5.5 0 0 1 0 1H8.5V10a.5.5 0 0 1-1 0V8.5H6a.5.5 0 0 1 0-1h1.5V6a.5.5 0 0 1 .5-.5z" />
                            <path d="M4.406 1.342A5.53 5.53 0 0 1 8 0c2.69 0 4.923 2 5.166 4.579C14.758 4.804 16 6.137 16 7.773 16 9.569 14.502 11 12.687 11H10a.5.5 0 0 1 0-1h2.688C13.979 10 15 8.988 15 7.773c0-1.216-1.02-2.228-2.313-2.228h-.5v-.5C12.188 2.825 10.328 1 8 1a4.53 4.53 0 0 0-2.941 1.1c-.757.652-1.153 1.438-1.153 2.055v.448l-.445.049C2.064 4.805 1 5.952 1 7.318 1 8.785 2.23 10 3.781 10H6a.5.5 0 0 1 0 1H3.781C1.708 11 0 9.366 0 7.318c0-1.763 1.266-3.223 2.942-3.593.143-.863.698-1.723 1.464-2.383z" />
                        </svg>
                        Nueva Descarga
                    </button>
                </div>

                <DownloadHistory key={refreshKey} />

                {isDownloadModalOpen && (
                    <BulkDownloadModal
                        onClose={() => setIsDownloadModalOpen(false)}
                        onSuccess={() => {
                            // Force refresh of history component
                            setRefreshKey(prev => prev + 1);
                        }}
                    />
                )}
            </main>
        </>
    );
}
