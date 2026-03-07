'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function DashboardGateway() {
    const router = useRouter();

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 bg-[radial-gradient(circle_at_top_right,_var(--primary-400)_0%,_transparent_25%),_radial-gradient(circle_at_bottom_left,_var(--accent-400)_0%,_transparent_25%)]">
            {/* Header Section */}
            <div className="text-center mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
                <h1 className="text-4xl font-bold text-slate-900 mb-4 tracking-tight">
                    Bienvenido al <span className="text-primary">Centro de Operaciones</span>
                </h1>
                <p className="text-lg text-slate-600 max-w-2xl">
                    Selecciona el módulo con el que deseas trabajar hoy. Tu sesión está activa y protegida.
                </p>
            </div>

            {/* Gateway Cards Container */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-5xl px-4">

                {/* Card 1: Control de Calidad */}
                <Link href="/registro-productos" className="group">
                    <div className="relative h-[400px] rounded-3xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 cursor-pointer bg-white border border-slate-200">
                        {/* Background Image with Overlay */}
                        <div
                            className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                            style={{ backgroundImage: 'url("/quality-control.png")' }}
                        >
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent group-hover:from-black/90 transition-all duration-500"></div>
                        </div>

                        {/* Content */}
                        <div className="absolute inset-0 flex flex-col justify-end p-8">
                            <div className="bg-primary/20 backdrop-blur-md w-14 h-14 rounded-2xl flex items-center justify-center mb-6 border border-white/20 group-hover:bg-primary/40 transition-colors">
                                <i className="bi bi-shield-check text-white text-3xl"></i>
                            </div>
                            <h2 className="text-3xl font-bold text-white mb-3">Control de Calidad</h2>
                            <p className="text-slate-200 text-lg opacity-90 group-hover:opacity-100 transition-opacity">
                                Registro de inspecciones técnicas, validación de parámetros y gestión de protocolos normativos.
                            </p>

                            <div className="mt-6 flex items-center text-primary font-semibold text-lg group-hover:translate-x-2 transition-transform">
                                Ingresar al módulo <i className="bi bi-arrow-right ml-2"></i>
                            </div>
                        </div>
                    </div>
                </Link>

                {/* Card 2: Escaneo de Códigos */}
                <Link href="/escaneo" className="group">
                    <div className="relative h-[400px] rounded-3xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 cursor-pointer bg-white border border-slate-200">
                        {/* Background Image with Overlay */}
                        <div
                            className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                            style={{ backgroundImage: 'url("/barcode-scanner.png")' }}
                        >
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/50 to-transparent group-hover:from-slate-900 transition-all duration-500"></div>
                        </div>

                        {/* Content */}
                        <div className="absolute inset-0 flex flex-col justify-end p-8">
                            <div className="bg-blue-500/20 backdrop-blur-md w-14 h-14 rounded-2xl flex items-center justify-center mb-6 border border-white/20 group-hover:bg-blue-500/40 transition-colors">
                                <i className="bi bi-qr-code-scan text-white text-3xl"></i>
                            </div>
                            <h2 className="text-3xl font-bold text-white mb-3">Escaneo de Códigos</h2>
                            <p className="text-slate-200 text-lg opacity-90 group-hover:opacity-100 transition-opacity">
                                Identificación rápida de productos y lotes mediante cámara para agilizar la captura de datos.
                            </p>

                            <div className="mt-6 flex items-center text-blue-400 font-semibold text-lg group-hover:translate-x-2 transition-transform">
                                Ingresar al módulo <i className="bi bi-arrow-right ml-2"></i>
                            </div>
                        </div>
                    </div>
                </Link>

            </div>

            {/* Footer Info */}
            <div className="mt-16 text-slate-400 text-sm flex items-center gap-4 animate-in fade-in duration-1000">
                <span className="flex items-center"><i className="bi bi-lock-fill mr-1"></i> Conexión Segura</span>
                <span>•</span>
                <span>Versión 2.5.0</span>
                <span>•</span>
                <span>El Olivar - Calidad Superior</span>
            </div>

            <style jsx>{`
        .animate-in {
          animation: 0.7s ease-out both;
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slide-in-from-top-4 {
          from { transform: translateY(-1rem); }
          to { transform: translateY(0); }
        }
        .fade-in { animation-name: fade-in; }
        .slide-in-from-top-4 { animation-name: slide-in-from-top-4; }
      `}</style>
        </div>
    );
}
