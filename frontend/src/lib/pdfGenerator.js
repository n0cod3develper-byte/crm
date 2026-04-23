import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

function formatCurrency(val) {
  return new Intl.NumberFormat('es-CO', { 
    style: 'currency', 
    currency: 'COP', 
    maximumFractionDigits: 0 
  }).format(val || 0);
}

export function generateQuotePDF(quote) {
  const doc = new jsPDF();

  // --- Header ---
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('COTIZACIÓN', 14, 25);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`N°: ${quote.quote_number}`, 14, 32);
  doc.text(`Fecha: ${new Date(quote.created_at).toLocaleDateString('es-CO')}`, 14, 38);
  if (quote.valid_until) {
    doc.text(`Válida hasta: ${new Date(quote.valid_until).toLocaleDateString('es-CO')}`, 14, 44);
  }

  // --- Empresa Emisora ---
  doc.setFont('helvetica', 'bold');
  doc.text('Emisor:', 120, 25);
  doc.setFont('helvetica', 'normal');
  doc.text('CARGAR SAS', 120, 32);
  doc.text('NIT: 900.xxx.xxx-x', 120, 38);
  doc.text('info@cargarsas.com', 120, 44);

  // --- Datos del Cliente ---
  doc.line(14, 52, 196, 52); // horizontal line
  doc.setFont('helvetica', 'bold');
  doc.text('Cliente:', 14, 62);
  doc.setFont('helvetica', 'normal');
  
  const clientName = quote.company_name || 'Cliente sin empresa asignada';
  doc.text(clientName, 14, 68);
  if (quote.contact_name) {
    doc.text(`Atención: ${quote.contact_name}`, 14, 74);
  }

  // --- Tabla de Ítems ---
  const tableBody = (quote.items || []).map(item => [
    item.description,
    item.quantity,
    formatCurrency(item.unit_price),
    `${item.discount}%`,
    formatCurrency(item.quantity * item.unit_price * (1 - item.discount / 100))
  ]);

  autoTable(doc, {
    startY: 85,
    head: [['Descripción', 'Cant.', 'Precio Unit.', 'Dto.', 'Subtotal']],
    body: tableBody,
    theme: 'grid',
    headStyles: { fillColor: [99, 102, 241], textColor: [255, 255, 255], fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 4 },
    columnStyles: {
      1: { halign: 'center', cellWidth: 20 },
      2: { halign: 'right', cellWidth: 35 },
      3: { halign: 'center', cellWidth: 20 },
      4: { halign: 'right', cellWidth: 35 }
    }
  });

  // --- Totales ---
  const finalY = doc.lastAutoTable.finalY + 10;
  
  doc.setFontSize(10);
  doc.text('Subtotal:', 140, finalY);
  doc.text(formatCurrency(quote.subtotal), 196, finalY, { align: 'right' });
  
  doc.text(`IVA (${quote.tax_rate}%):`, 140, finalY + 7);
  doc.text(formatCurrency(quote.tax_amount), 196, finalY + 7, { align: 'right' });
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL:', 140, finalY + 15);
  doc.text(formatCurrency(quote.total), 196, finalY + 15, { align: 'right' });

  // --- Notas ---
  if (quote.notes) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.text('Notas / Condiciones Comerciales:', 14, finalY + 5);
    doc.setFont('helvetica', 'normal');
    
    const splitNotes = doc.splitTextToSize(quote.notes, 100);
    doc.text(splitNotes, 14, finalY + 11);
  }

  // --- Descarga ---
  doc.save(`${quote.quote_number}_Cotizacion_CargarSAS.pdf`);
}
