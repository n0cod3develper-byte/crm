import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

function formatCurrency(val) {
  return new Intl.NumberFormat('es-CO', { 
    style: 'currency', 
    currency: 'COP', 
    maximumFractionDigits: 0 
  }).format(val || 0);
}

export function generateQuotePDF(quote, action = 'download') {
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
  const tableBody = (quote.items || []).map(item => {
    const margin = item.discount || 0;
    const finalUnitPrice = item.unit_price * (1 + margin / 100);
    return [
      item.description,
      item.quantity,
      formatCurrency(finalUnitPrice),
      formatCurrency(item.quantity * finalUnitPrice)
    ];
  });

  autoTable(doc, {
    startY: 85,
    head: [['Descripción', 'Cant.', 'Precio Unit.', 'Subtotal']],
    body: tableBody,
    theme: 'grid',
    headStyles: { fillColor: [99, 102, 241], textColor: [255, 255, 255], fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 4 },
    columnStyles: {
      1: { halign: 'center', cellWidth: 20 },
      2: { halign: 'right', cellWidth: 35 },
      3: { halign: 'right', cellWidth: 35 }
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

  // --- Save or Preview ---
  const filename = `cotizacion_${quote.quote_number || '000'}.pdf`;
  if (action === 'preview') {
    window.open(doc.output('bloburl'), '_blank');
  } else {
    doc.save(filename);
  }
}

export function generateSupplierQuotePDF(quote, action = 'download') {
  const doc = new jsPDF();

  // --- Header ---
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('COTIZACIÓN DE PROVEEDOR', 14, 25);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`N°: ${quote.consecutivo}`, 14, 32);
  doc.text(`Fecha: ${new Date(quote.created_at).toLocaleDateString('es-CO')}`, 14, 38);
  doc.text(`Estado: ${quote.estado}`, 14, 44);

  // --- Proveedor ---
  doc.setFont('helvetica', 'bold');
  doc.text('Proveedor:', 120, 25);
  doc.setFont('helvetica', 'normal');
  const providerName = quote.proveedor_razon_social || 'Proveedor no especificado';
  doc.text(providerName, 120, 32);

  // --- Cliente Final ---
  doc.line(14, 52, 196, 52); // horizontal line
  doc.setFont('helvetica', 'bold');
  doc.text('Solicitado por (Para Empresa):', 14, 62);
  doc.setFont('helvetica', 'normal');
  const clientName = quote.empresa_nombre || 'CARGAR SAS (Interno)';
  doc.text(clientName, 14, 68);

  // --- Tabla de Ítems ---
  const tableBody = (quote.items || []).map(item => [
    item.company_name || '—',
    item.inventario_nombre || item.descripcion_manual || 'Ítem',
    item.proveedor_nombre || 'N/A',
    item.cantidad,
    formatCurrency(item.precio_unitario),
    item.comentarios || '',
    formatCurrency(item.cantidad * item.precio_unitario)
  ]);

  autoTable(doc, {
    startY: 80,
    head: [['Empresa', 'Descripción', 'Proveedor', 'Cant.', 'Precio Costo', 'Comentarios', 'Subtotal']],
    body: tableBody,
    theme: 'grid',
    headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 4 },
    columnStyles: {
      0: { halign: 'left', cellWidth: 25 },
      1: { halign: 'left', cellWidth: 30 },
      2: { halign: 'center', cellWidth: 15 },
      3: { halign: 'center', cellWidth: 10 },
      4: { halign: 'right', cellWidth: 20 },
      6: { halign: 'right', cellWidth: 20 }
    }
  });

  // --- Totales ---
  const finalY = doc.lastAutoTable.finalY + 10;
  
  doc.setFontSize(10);
  doc.text('Subtotal (Costo):', 140, finalY);
  doc.text(formatCurrency(quote.subtotal), 196, finalY, { align: 'right' });
  
  doc.text(`Margen (${quote.margen_utilidad}%):`, 140, finalY + 7);
  doc.text(formatCurrency(quote.subtotal * (quote.margen_utilidad / 100)), 196, finalY + 7, { align: 'right' });
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL VENTA:', 140, finalY + 15);
  doc.text(formatCurrency(quote.total), 196, finalY + 15, { align: 'right' });

  // --- Save or Preview ---
  const filename = `${quote.consecutivo}_Cot_Prov_${providerName.replace(/[^a-z0-9]/gi, '_')}.pdf`;
  if (action === 'preview') {
    window.open(doc.output('bloburl'), '_blank');
  } else {
    doc.save(filename);
  }
}
