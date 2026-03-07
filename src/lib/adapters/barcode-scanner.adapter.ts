/**
 * IBarcodeScanner Interface
 * 
 * S.O.L.I.D. - Interface Segregation & Dependency Inversion:
 * This interface defines the contract for any barcode scanner implementation.
 * It allows swapping the underlying library (e.g., html5-qrcode, quagga, etc.) 
 * without affecting the React components.
 */

export interface ScannerResult {
    text: string;
    format?: string;
}

export interface ScannerConfig {
    fps: number;
    qrbox: number | { width: number; height: number };
    aspectRatio?: number;
}

export interface IBarcodeScanner {
    /**
     * Initializes the scanner on a specific element ID.
     */
    initialize(elementId: string, config: ScannerConfig): Promise<void>;

    /**
     * Starts scanning and calls onResult when a code is detected.
     */
    start(onResult: (result: ScannerResult) => void, onError?: (error: string) => void): Promise<void>;

    /**
     * Stops the camera and cleans up resources.
     */
    stop(): Promise<void>;

    /**
     * Checks if the device has camera permissions.
     */
    checkPermissions(): Promise<boolean>;

    /**
     * Switches between available cameras.
     */
    switchCamera(): Promise<void>;
}
