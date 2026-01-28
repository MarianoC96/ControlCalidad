import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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
}

/**
 * Generates a PDF report for a quality control registro
 * Matches the original PHP PDF format
 */
export function generateRegistroPDF(registro: RegistroForPDF): void {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Reporte de Control de Calidad', pageWidth / 2, 20, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Fecha de generación: ${new Date().toLocaleDateString('es-PE')}`, pageWidth / 2, 28, { align: 'center' });

    // Horizontal line
    doc.setLineWidth(0.5);
    doc.line(14, 32, pageWidth - 14, 32);

    // Registro details section
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Información del Registro', 14, 42);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    const details: [string, string][] = [
        ['Lote Interno:', registro.lote_interno],
        ['Guía:', registro.guia || 'N/A'],
        ['Producto:', registro.producto_nombre],
        ['Cantidad:', registro.cantidad?.toString() || 'N/A'],
        ['Verificado por:', registro.verificado_por || 'N/A'],
        ['Fecha:', new Date(registro.fecha_registro).toLocaleDateString('es-PE')],
    ];

    let yPosition = 50;
    details.forEach(([label, value]) => {
        doc.setFont('helvetica', 'bold');
        doc.text(label, 14, yPosition);
        doc.setFont('helvetica', 'normal');
        doc.text(value, 55, yPosition);
        yPosition += 7;
    });

    // Observaciones
    if (registro.observaciones_generales) {
        yPosition += 5;
        doc.setFont('helvetica', 'bold');
        doc.text('Observaciones:', 14, yPosition);
        doc.setFont('helvetica', 'normal');
        yPosition += 7;

        const obsLines = doc.splitTextToSize(registro.observaciones_generales, pageWidth - 28);
        doc.text(obsLines, 14, yPosition);
        yPosition += obsLines.length * 5 + 5;
    }

    // Controls table
    if (registro.controles && registro.controles.length > 0) {
        yPosition += 10;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('Controles de Calidad', 14, yPosition);

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
            alternateRowStyles: {
                fillColor: [245, 247, 250],
            },
            columnStyles: {
                0: { cellWidth: 40 },
                1: { cellWidth: 35 },
                2: { cellWidth: 25 },
                3: { cellWidth: 20 },
                4: { cellWidth: 'auto' },
            },
            styles: {
                fontSize: 9,
                cellPadding: 3,
            },
            didParseCell: (data) => {
                // Highlight out-of-range values
                if (data.column.index === 3 && data.cell.text[0] === 'FUERA') {
                    data.cell.styles.textColor = [220, 53, 69];
                    data.cell.styles.fontStyle = 'bold';
                }
            },
        });
    }

    // Photos section (if any)
    if (registro.fotos && registro.fotos.length > 0) {
        // Get final Y position from autoTable
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
        doc.text('Fotos', 14, yPosition);
        yPosition += 10;

        let xPosition = 14;
        const imageWidth = 80;
        const imageHeight = 60;

        registro.fotos.forEach((foto, index) => {
            if (foto.datos_base64) {
                try {
                    // Check if we need a new row
                    if (xPosition + imageWidth > pageWidth - 14) {
                        xPosition = 14;
                        yPosition += imageHeight + 15;
                    }

                    // Check if we need a new page
                    if (yPosition + imageHeight > doc.internal.pageSize.getHeight() - 20) {
                        doc.addPage();
                        yPosition = 20;
                        xPosition = 14;
                    }

                    doc.addImage(foto.datos_base64, 'JPEG', xPosition, yPosition, imageWidth, imageHeight);

                    if (foto.descripcion) {
                        doc.setFontSize(8);
                        doc.setFont('helvetica', 'normal');
                        doc.text(foto.descripcion, xPosition, yPosition + imageHeight + 5, { maxWidth: imageWidth });
                    }

                    xPosition += imageWidth + 10;
                } catch (err) {
                    console.error(`Error adding photo ${index + 1}:`, err);
                }
            }
        });
    }

    // Footer with page numbers
    const totalPages = doc.internal.pages.length - 1; // pages array has empty first element
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(
            `Página ${i} de ${totalPages}`,
            pageWidth / 2,
            doc.internal.pageSize.getHeight() - 10,
            { align: 'center' }
        );
    }

    // Save the PDF
    const fileName = `registro_${registro.lote_interno}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
}
