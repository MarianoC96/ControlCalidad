import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import fs from 'fs';
import path from 'path';
import { getPdfConfig } from '@/lib/config-helper';
import type { Control, Foto } from '@/lib/supabase/types';

interface RegistroForPDF {
    id: number;
    lote_interno: string;
    guia: string | null;
    cantidad: number;
    producto_id: number;
    producto_nombre: string;
    usuario_id: number;
    usuario_nombre: string;
    observaciones_generales: string | null;
    verificado_por: string | null;
    fecha_registro: string;
    controles?: Control[];
    fotos?: Foto[];
    pdf_titulo?: string | null;
    pdf_codigo?: string | null;
    pdf_edicion?: string | null;
    pdf_aprobado_por?: string | null;
}

const DEFAULT_HEADER_CONFIG = {
    titulo: "REPORTE DE CONTROL DE CALIDAD",
    codigo: "PE C - CC001",
    edicion: "ED. 01",
    aprobado_por: "Aprob. J. Calidad"
};

async function loadServerImageToBase64(relativePath: string): Promise<string | null> {
    try {
        // remove leading slash
        const cleanPath = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
        const fullPath = path.join(process.cwd(), 'public', cleanPath);

        if (fs.existsSync(fullPath)) {
            const bitmap = await fs.promises.readFile(fullPath);
            const base64 = Buffer.from(bitmap).toString('base64');
            const ext = path.extname(fullPath).substring(1).toLowerCase();
            const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
            return `data:${mime};base64,${base64}`;
        }
        return null;
    } catch (e) {
        console.error("Error loading server logo:", e);
        return null;
    }
}

export async function generateServerPDF(registro: RegistroForPDF): Promise<Buffer> {
    let headerConfig = DEFAULT_HEADER_CONFIG;
    try {
        const config = await getPdfConfig();
        if (config) headerConfig = config as any;
    } catch (err) {
        console.error("Error fetching PDF Config", err);
    }

    const CUTOFF_DATE = new Date('2025-01-29T00:00:00');
    let isNewFormat = false;

    if (registro.pdf_codigo) {
        isNewFormat = true;
        headerConfig = {
            titulo: registro.pdf_titulo || headerConfig.titulo,
            codigo: registro.pdf_codigo || headerConfig.codigo,
            edicion: registro.pdf_edicion || headerConfig.edicion,
            aprobado_por: registro.pdf_aprobado_por || headerConfig.aprobado_por
        };
    } else if (new Date(registro.fecha_registro) >= CUTOFF_DATE) {
        isNewFormat = true;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPosition = 20;

    if (isNewFormat) {
        const logoBase64 = await loadServerImageToBase64('/logo.png');

        const hMargen = 14;
        const hTop = 10;
        const hHeight = 30;
        const hWidth = pageWidth - (hMargen * 2);

        const col1W = 45;
        const col3W = 40;
        const col2W = hWidth - col1W - col3W;

        const xCol1 = hMargen;
        const xCol2 = hMargen + col1W;
        const xCol3 = hMargen + col1W + col2W;

        doc.setLineWidth(0.3);
        doc.setDrawColor(0);
        doc.rect(xCol1, hTop, hWidth, hHeight);
        doc.line(xCol2, hTop, xCol2, hTop + hHeight);
        doc.line(xCol3, hTop, xCol3, hTop + hHeight);

        if (logoBase64) {
            const imgMargin = 2;
            doc.addImage(logoBase64, 'PNG', xCol1 + imgMargin, hTop + imgMargin, col1W - (imgMargin * 2), hHeight - (imgMargin * 2), undefined, 'FAST');
        } else {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'italic');
            doc.text("[Logo]", xCol1 + col1W / 2, hTop + hHeight / 2, { align: 'center' });
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        const titleRef = headerConfig.titulo;
        const titleLines = doc.splitTextToSize(titleRef, col2W - 4);
        doc.text(titleLines, xCol2 + col2W / 2, hTop + hHeight / 2, { align: 'center', baseline: 'middle' });

        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');

        const rowH = hHeight / 3;
        const yRow1 = hTop + (rowH / 2) + 2;
        doc.text(headerConfig.codigo, xCol3 + col3W / 2, yRow1, { align: 'center' });
        doc.line(xCol3, hTop + rowH, xCol3 + col3W, hTop + rowH);

        const yRow2 = hTop + rowH + (rowH / 2) + 2;
        doc.text(headerConfig.edicion, xCol3 + col3W / 2, yRow2, { align: 'center' });
        doc.line(xCol3, hTop + (rowH * 2), xCol3 + col3W, hTop + (rowH * 2));

        const yRow3 = hTop + (rowH * 2) + (rowH / 2) + 2;
        let approvalText = headerConfig.aprobado_por;
        const dateMatch = approvalText.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (dateMatch) {
            approvalText = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
        }
        doc.text(approvalText, xCol3 + col3W / 2, yRow3, { align: 'center' });

        yPosition = hTop + hHeight + 10;

    } else {
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('Reporte de Control de Calidad', pageWidth / 2, 20, { align: 'center' });
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Fecha de generación: ${new Date().toLocaleDateString('es-PE')}`, pageWidth / 2, 28, { align: 'center' });
        doc.setLineWidth(0.5);
        doc.line(14, 32, pageWidth - 14, 32);
        yPosition = 42;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Información del Registro', 14, yPosition);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    const details: [string, string][] = [
        ['Lote Interno:', registro.lote_interno],
        ['Guía:', registro.guia || 'N/A'],
        ['Producto:', registro.producto_nombre],
        ['Cantidad:', registro.cantidad?.toString() || 'N/A'],
        ['Verificado por:', registro.verificado_por || 'N/A'],
        ['Fecha Registro:', new Date(registro.fecha_registro).toLocaleDateString('es-PE')],
    ];

    yPosition += 8;
    details.forEach(([label, value]) => {
        doc.setFont('helvetica', 'bold');
        doc.text(label, 14, yPosition);
        doc.setFont('helvetica', 'normal');
        doc.text(value, 55, yPosition);
        yPosition += 7;
    });

    if (registro.observaciones_generales) {
        yPosition += 5;
        doc.setFont('helvetica', 'bold');
        doc.text('Evaluación / Conclusión:', 14, yPosition);
        doc.setFont('helvetica', 'normal');
        yPosition += 7;
        const obsLines = doc.splitTextToSize(registro.observaciones_generales, pageWidth - 28);
        doc.text(obsLines, 14, yPosition);
        yPosition += obsLines.length * 5 + 5;
    }

    if (registro.controles && registro.controles.length > 0) {
        yPosition += 5;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('Resultados del Control', 14, yPosition);

        const tableData = registro.controles.map((control) => [
            control.parametro_nombre,
            control.rango_completo || 'N/A',
            control.valor_control?.toString() || control.texto_control || 'N/A',
            control.fuera_de_rango ? 'FUERA' : 'OK',
            control.observacion || '',
        ]);

        autoTable(doc, {
            startY: yPosition + 5,
            head: [['Parámetro', 'Rango', 'Valor', 'Estado', 'Observación']],
            body: tableData,
            theme: 'striped',
            headStyles: {
                fillColor: [74, 85, 104],
                textColor: 255,
                fontStyle: 'bold',
            },
            alternateRowStyles: { fillColor: [245, 247, 250] },
            columnStyles: {
                0: { cellWidth: 40 },
                1: { cellWidth: 35 },
                2: { cellWidth: 25 },
                3: { cellWidth: 20 },
                4: { cellWidth: 'auto' },
            },
            styles: { fontSize: 9, cellPadding: 3 },
            didParseCell: (data) => {
                if (data.column.index === 3 && data.cell.text[0] === 'FUERA') {
                    data.cell.styles.textColor = [220, 53, 69];
                    data.cell.styles.fontStyle = 'bold';
                }
            },
        });
    }

    if (registro.fotos && registro.fotos.length > 0) {
        const autoTableResult = doc as jsPDF & { lastAutoTable?: { finalY: number } };
        const finalY = autoTableResult.lastAutoTable?.finalY || yPosition;

        if (finalY > doc.internal.pageSize.getHeight() - 100) {
            doc.addPage();
            yPosition = 20;
        } else {
            yPosition = finalY + 15;
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(0);
        doc.text('Evidencia Fotográfica', 14, yPosition);
        yPosition += 10;

        const imageWidth = 150;
        const imageHeight = 112;
        let xPosition = (pageWidth - imageWidth) / 2;

        registro.fotos.forEach((foto, index) => {
            if (foto.datos_base64) {
                try {
                    if (yPosition + imageHeight > doc.internal.pageSize.getHeight() - 30) {
                        doc.addPage();
                        yPosition = 20;
                    }

                    let format = 'JPEG';
                    if (foto.datos_base64.startsWith('data:image/png')) format = 'PNG';
                    else if (foto.datos_base64.startsWith('data:image/webp')) format = 'WEBP';

                    doc.addImage(foto.datos_base64, format, xPosition, yPosition, imageWidth, imageHeight);

                    if (foto.descripcion) {
                        doc.setFontSize(9);
                        doc.setFont('helvetica', 'italic');
                        doc.text(foto.descripcion, pageWidth / 2, yPosition + imageHeight + 6, { align: 'center', maxWidth: imageWidth });
                        yPosition += imageHeight + 18;
                    } else {
                        yPosition += imageHeight + 12;
                    }
                } catch (err) {
                    console.error(`Error adding photo ${index + 1}:`, err);
                    yPosition += 10;
                }
            }
        });
    }

    const totalPages = doc.internal.pages.length - 1;
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(
            `Página ${i} de ${totalPages} - Generado el ${new Date().toLocaleDateString('es-PE')}`,
            pageWidth / 2,
            doc.internal.pageSize.getHeight() - 10,
            { align: 'center' }
        );
    }

    return Buffer.from(doc.output('arraybuffer'));
}
