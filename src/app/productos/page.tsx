'use client';

import RouteGuard from '@/components/RouteGuard';
import ProductosClient from './ProductosClient';

export default function ProductosPage() {
    return <RouteGuard><ProductosClient /></RouteGuard>;
}
