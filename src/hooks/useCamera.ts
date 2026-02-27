'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/** Represents a captured or selected photo with its compressed preview */
export interface PhotoEntry {
    readonly file: File;
    readonly preview: string;
}

interface UseCameraReturn {
    readonly showCamera: boolean;
    readonly cameraError: string;
    readonly activePhotoIndex: number | null;
    readonly videoRef: React.RefObject<HTMLVideoElement | null>;
    readonly canvasRef: React.RefObject<HTMLCanvasElement | null>;
    readonly nativeCameraInputRef: React.RefObject<HTMLInputElement | null>;
    readonly isMobile: boolean;
    readonly fotos: (PhotoEntry | null)[];
    readonly handleCameraRequest: (index: number) => void;
    readonly capturePhoto: () => void;
    readonly stopCamera: () => void;
    readonly handleFileChange: (e: React.ChangeEvent<HTMLInputElement>, index: number) => void;
    readonly handleNativeCameraCapture: (e: React.ChangeEvent<HTMLInputElement>) => void;
    readonly removePhoto: (index: number) => void;
    readonly resetPhotos: () => void;
}

const MAX_DIMENSION = 1024;
const JPEG_QUALITY = 0.7;
const INITIAL_PHOTO_SLOTS = 2;

/**
 * Compresses an image file to a JPEG base64 string within MAX_DIMENSION bounds.
 *
 * Why separate function: keeps the compression logic pure and testable
 * independent of React state management.
 */
function compressImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_DIMENSION) {
                        height *= MAX_DIMENSION / width;
                        width = MAX_DIMENSION;
                    }
                } else {
                    if (height > MAX_DIMENSION) {
                        width *= MAX_DIMENSION / height;
                        height = MAX_DIMENSION;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
}

/**
 * Manages camera access, photo capture, file selection, and image compression.
 *
 * Why this hook exists: RegistroProductosClient.tsx had ~120 lines of camera/photo
 * logic interleaved with form state. This isolates all media concerns into a
 * single, reusable unit.
 */
export function useCamera(): UseCameraReturn {
    const [showCamera, setShowCamera] = useState(false);
    const [activePhotoIndex, setActivePhotoIndex] = useState<number | null>(null);
    const [cameraError, setCameraError] = useState('');
    const [isMobile, setIsMobile] = useState(false);
    const [fotos, setFotos] = useState<(PhotoEntry | null)[]>(
        () => Array.from({ length: INITIAL_PHOTO_SLOTS }, () => null)
    );

    const videoRef = useRef<HTMLVideoElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const nativeCameraInputRef = useRef<HTMLInputElement | null>(null);

    // Detect mobile on mount
    useEffect(() => {
        setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
    }, []);

    // Initialize/cleanup camera stream
    useEffect(() => {
        let stream: MediaStream | null = null;
        let track: MediaStreamTrack | null = null;

        const initCamera = async () => {
            if (!showCamera || !videoRef.current) return;

            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment' },
                });
                track = stream.getVideoTracks()[0];
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
            } catch {
                setCameraError('No se pudo acceder a la cámara. Verifique los permisos.');
            }
        };

        if (showCamera) {
            initCamera();
        }

        return () => {
            if (track) track.stop();
            if (stream) stream.getTracks().forEach((t) => t.stop());
        };
    }, [showCamera]);

    const processFile = useCallback(async (file: File, index: number) => {
        try {
            const preview = await compressImage(file);
            setFotos((prev) => {
                const updated = [...prev];
                updated[index] = { file, preview };
                return updated;
            });
        } catch (e) {
            console.error('Error processing file:', e);
            alert('Error al procesar la imagen. Intente con otra.');
        }
    }, []);

    const handleCameraRequest = useCallback(
        (index: number) => {
            setActivePhotoIndex(index);

            if (isMobile) {
                nativeCameraInputRef.current?.click();
            } else {
                setCameraError('');
                setShowCamera(true);
            }
        },
        [isMobile]
    );

    const stopCamera = useCallback(() => {
        setShowCamera(false);
        setActivePhotoIndex(null);
    }, []);

    const capturePhoto = useCallback(() => {
        if (!videoRef.current || !canvasRef.current || activePhotoIndex === null) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        if (!context) return;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(
            (blob) => {
                if (blob) {
                    const file = new File([blob], `captura-${Date.now()}.jpg`, { type: 'image/jpeg' });
                    processFile(file, activePhotoIndex);
                    stopCamera();
                }
            },
            'image/jpeg',
            0.8
        );
    }, [activePhotoIndex, processFile, stopCamera]);

    const handleFileChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
            const file = e.target.files?.[0];
            if (file) {
                processFile(file, index);
            }
        },
        [processFile]
    );

    const handleNativeCameraCapture = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (file && activePhotoIndex !== null) {
                processFile(file, activePhotoIndex);
                setActivePhotoIndex(null);
                if (nativeCameraInputRef.current) nativeCameraInputRef.current.value = '';
            }
        },
        [activePhotoIndex, processFile]
    );

    const removePhoto = useCallback((index: number) => {
        setFotos((prev) => {
            const updated = [...prev];
            updated[index] = null;
            return updated;
        });
        const input = document.getElementById(`foto-${index}`) as HTMLInputElement;
        if (input) input.value = '';
    }, []);

    const resetPhotos = useCallback(() => {
        setFotos(Array.from({ length: INITIAL_PHOTO_SLOTS }, () => null));
    }, []);

    return {
        showCamera,
        cameraError,
        activePhotoIndex,
        videoRef,
        canvasRef,
        nativeCameraInputRef,
        isMobile,
        fotos,
        handleCameraRequest,
        capturePhoto,
        stopCamera,
        handleFileChange,
        handleNativeCameraCapture,
        removePhoto,
        resetPhotos,
    };
}
