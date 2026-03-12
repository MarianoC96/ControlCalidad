'use client';

import RouteGuard from '@/components/RouteGuard';
import UsuariosClient from './UsuariosClient';

export default function UsuariosPage() {
    return <RouteGuard><UsuariosClient /></RouteGuard>;
}
