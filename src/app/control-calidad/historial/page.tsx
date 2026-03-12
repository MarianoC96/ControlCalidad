'use client';

import RouteGuard from '@/components/RouteGuard';
import RegistrosClient from './RegistrosClient';

export default function RegistrosPage() {
    return <RouteGuard><RegistrosClient /></RouteGuard>;
}
