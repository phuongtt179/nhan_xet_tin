import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: typeof autoTable;
  }
}

export function addPDFHeader(
  doc: jsPDF,
  title: string,
  subtitle?: string
) {
  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 105, 20, { align: 'center' });

  // Subtitle
  if (subtitle) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(subtitle, 105, 28, { align: 'center' });
  }

  // Date
  doc.setFontSize(10);
  doc.setFont('helvetica', 'italic');
  doc.text(`Ngay xuat: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 105, subtitle ? 35 : 28, { align: 'center' });
}

export function addPDFFooter(doc: jsPDF, pageNumber: number, totalPages: number) {
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.text(
    `Trang ${pageNumber} / ${totalPages}`,
    105,
    doc.internal.pageSize.height - 10,
    { align: 'center' }
  );
}

export function renderStarsText(rating: number): string {
  if (rating === 0) return '-';
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  let stars = '★'.repeat(fullStars);
  if (hasHalfStar) stars += '½';
  stars += '☆'.repeat(3 - Math.ceil(rating));
  return `${stars} (${rating.toFixed(1)})`;
}

export function getStarColor(rating: number): [number, number, number] {
  if (rating >= 2.5) return [34, 197, 94]; // Green
  if (rating >= 2.0) return [59, 130, 246]; // Blue
  if (rating >= 1.5) return [234, 179, 8]; // Yellow
  return [239, 68, 68]; // Red
}
