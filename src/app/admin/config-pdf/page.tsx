'use client';

import RouteGuard from '@/components/RouteGuard';
import ConfigPdfClient from './ConfigPdfClient';

export default function ConfigPdfPage() {
    return <RouteGuard><ConfigPdfClient /></RouteGuard>;
}
