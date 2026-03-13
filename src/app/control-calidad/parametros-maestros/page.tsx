'use client';

import RouteGuard from '@/components/RouteGuard';
import ParametrosMaestrosClient from './ParametrosMaestrosClient';

export default function ParametrosMaestrosPage() {
    return <RouteGuard><ParametrosMaestrosClient /></RouteGuard>;
}
