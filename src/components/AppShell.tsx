'use client';

import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Navbar';
import ScannerSidebar from '@/components/ScannerSidebar';
import SystemSidebar from '@/components/SystemSidebar';
import { useAuth } from '@/hooks/useAuth';

// Pages that should NOT show the sidebar
const PUBLIC_PATHS = ['/', '/olvide-password', '/restablecer-password', '/dashboard'];

export default function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isPublicPage = PUBLIC_PATHS.includes(pathname);
    const isScannerPath = pathname.startsWith('/escaner-codigos');
    const isSystemPath = pathname.startsWith('/control-sistema') || pathname.startsWith('/control-sistema/centro-solicitudes');

    const { userName, userRole } = useAuth({ redirectOnFail: false });

    if (isPublicPage) {
        return <>{children}</>;
    }

    return (
        <>
            {isScannerPath ? (
                <ScannerSidebar userName={userName} userRole={userRole} />
            ) : isSystemPath ? (
                <SystemSidebar userName={userName} userRole={userRole} />
            ) : (
                <Sidebar userName={userName} userRole={userRole} />
            )}
            {children}
        </>
    );
}
