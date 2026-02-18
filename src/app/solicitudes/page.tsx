'use client';

import RouteGuard from '@/components/RouteGuard';
import SolicitudesClient from './SolicitudesClient';

export default function SolicitudesPage() {
    return <RouteGuard><SolicitudesClient /></RouteGuard>;
}
