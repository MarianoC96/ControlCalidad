'use client';

import dynamic from 'next/dynamic';

const AuditoriaClient = dynamic(() => import('./AuditoriaClient'), { ssr: false });

export default function AuditoriaPage() {
    return <AuditoriaClient />;
}
