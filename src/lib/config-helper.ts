import fs from 'fs/promises';
import path from 'path';

const CONFIG_PATH = path.join(process.cwd(), 'src', 'config', 'pdfConfig.json');

export interface PdfConfig {
    titulo: string;
    codigo: string;
    edicion: string;
    aprobado_por: string;
}

export const DEFAULT_CONFIG: PdfConfig = {
    titulo: "REPORTE DE CONTROL DE CALIDAD",
    codigo: "PE C - CC001",
    edicion: "ED. 01",
    aprobado_por: "Aprob. J. Calidad"
};

export async function getPdfConfig(): Promise<PdfConfig> {
    try {
        const data = await fs.readFile(CONFIG_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error("Error reading PDF config, returning default:", error);
        return DEFAULT_CONFIG;
    }
}

export async function updatePdfConfig(config: PdfConfig): Promise<void> {
    try {
        const dir = path.dirname(CONFIG_PATH);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
    } catch (error) {
        console.error("Error writing PDF config:", error);
        throw error;
    }
}
