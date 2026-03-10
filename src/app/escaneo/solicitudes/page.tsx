'use client';

import RouteGuard from '@/components/RouteGuard';
import SolicitudesClient from '@/app/solicitudes/SolicitudesClient';

export default function EscaneoSolicitudesPage() {
    return <RouteGuard moduleKey="solicitudes"><SolicitudesClient /></RouteGuard>;
}
