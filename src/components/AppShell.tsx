'use client';

import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Navbar';
import { useState, useEffect } from 'react';

// Pages that should NOT show the sidebar
const PUBLIC_PATHS = ['/', '/olvide-password', '/restablecer-password'];

export default function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isPublicPage = PUBLIC_PATHS.includes(pathname);

    const [userName, setUserName] = useState('');
    const [userRole, setUserRole] = useState<'administrador' | 'trabajador'>('trabajador');

    useEffect(() => {
        const getCookie = (name: string) => {
            const v = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
            return v ? decodeURIComponent(v[2]) : '';
        };
        setUserName(getCookie('user_name'));
        setUserRole(getCookie('user_role') as 'administrador' | 'trabajador');
    }, [pathname]); // re-read on navigation in case login just happened

    if (isPublicPage) {
        return <>{children}</>;
    }

    return (
        <>
            <Sidebar userName={userName} userRole={userRole} />
            {children}
        </>
    );
}
