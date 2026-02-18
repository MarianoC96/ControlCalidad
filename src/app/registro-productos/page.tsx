'use client';

import RouteGuard from '@/components/RouteGuard';
import RegistroProductosClient from './RegistroProductosClient';

export default function RegistroProductosPage() {
    return <RouteGuard><RegistroProductosClient /></RouteGuard>;
}
