'use client';

import dynamic from 'next/dynamic';

const TemporalClient = dynamic(() => import('./TemporalClient'), { ssr: false });

export default function TemporalPage() {
    return <TemporalClient />;
}
