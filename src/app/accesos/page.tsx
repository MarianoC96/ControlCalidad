'use client';

import RouteGuard from '@/components/RouteGuard';
import AccesosClient from './AccesosClient';

export default function AccesosPage() {
    return <RouteGuard><AccesosClient /></RouteGuard>;
}
