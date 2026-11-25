import type { jsPDF } from 'jspdf';
import type { WaterCarrierMatch, WaterCarrierPlanning } from '@tournament-manager/persistent-data-model';

/** Measured text and height for a match cell, keeping its writing area intact. */
interface PdfMatchCell {
  match?: WaterCarrierMatch;
  title: string[];
  referees: string[];
  height: number;
}

/** Builds a dense vector A4 landscape grid with repeated headers and four handwriting lines. */
export function buildWaterCarrierPdf(pdf: jsPDF, planning: WaterCarrierPlanning): void {
  const period = planning.periods.find((item) => item.id === planning.selectedPeriodId)?.label ?? '';
  const title = `${planning.tournamentName} - ${period} - Water Carrier`;
  const fields = planning.fields;
  const cells = new Map(planning.matches.map((match) => [`${match.timeslotId}:${match.fieldId}`, match]));
  let firstPage = true;
  // Five fields per horizontal section reduce the number of pages while keeping labels readable.
  for (let offset = 0; offset < Math.max(fields.length, 1); offset += 5) {
    const section = fields.slice(offset, offset + 5);
    const width = 255 / Math.max(section.length, 1);
    if (!firstPage) pdf.addPage('a4', 'landscape');
    firstPage = false;
    let y = drawHeader(pdf, title, section, width);
    for (const slot of planning.timeslots) {
      const row = section.map((field) => measureCell(pdf, cells.get(`${slot.id}:${field.id}`), width));
      const height = Math.max(12, ...row.map((cell) => cell.height));
      if (height > 158) throw new Error('A match contains too much text for one printable cell.');
      if (y + height > 195) {
        pdf.addPage('a4', 'landscape');
        y = drawHeader(pdf, title, section, width);
      }
      pdf.setDrawColor(140).setTextColor(20).setFontSize(9);
      pdf.rect(10, y, 22, height);
      pdf.text(
        new Intl.DateTimeFormat('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: planning.timeZone,
        }).format(new Date(slot.start * 1000)),
        21,
        y + 6,
        { align: 'center' },
      );
      row.forEach((cell, index) => drawCell(pdf, cell, 32 + index * width, y, width, height));
      y += height;
    }
    if (!planning.matches.length) pdf.text('No matches in this period.', 10, y + 8);
  }
  for (let page = 1; page <= pdf.getNumberOfPages(); page++) {
    pdf.setPage(page);
    pdf.setTextColor(70).setFontSize(8).text(`${page} / ${pdf.getNumberOfPages()}`, 287, 204, { align: 'right' });
  }
}

/** Measures compact match/referee text and reserves 16mm for four handwriting lines. */
function measureCell(pdf: jsPDF, match: WaterCarrierMatch | undefined, width: number): PdfMatchCell {
  pdf.setFontSize(7);
  const title: string[] = match ? pdf.splitTextToSize(match.description, width - 6) : [];
  const referees: string[] = match?.referees.flatMap((person) => pdf.splitTextToSize(person.name, width - 6)) ?? [];
  return { match, title, referees, height: match ? 10 + (title.length + referees.length) * 3 + 16 : 10 };
}

/** Repeats the title, scope, timeslot label and field headers on each page. */
function drawHeader(pdf: jsPDF, title: string, fields: WaterCarrierPlanning['fields'], width: number): number {
  pdf.setTextColor(20).setFontSize(11);
  const lines: string[] = pdf.splitTextToSize(title, 277);
  pdf.text(lines.slice(0, 3), 10, 13);
  const top = 16 + Math.min(lines.length, 3) * 5;
  pdf.setFontSize(7).setDrawColor(140);
  pdf.rect(10, top, 22, 12);
  pdf.text('Time', 21, top + 7, { align: 'center' });
  fields.forEach((field, index) => {
    const x = 32 + index * width;
    pdf.rect(x, top, width, 12);
    const name: string[] = pdf.splitTextToSize(field.name, width - 6);
    pdf.text(name.slice(0, 2), x + width / 2, top + 5, { align: 'center' });
  });
  return top + 12;
}

/** Draws a complete match with compact text and a fixed four-line blank area. */
function drawCell(pdf: jsPDF, cell: PdfMatchCell, x: number, y: number, width: number, height: number): void {
  pdf.setDrawColor(140).rect(x, y, width, height);
  if (!cell.match) return;
  const titleHeight = cell.title.length * 3 + 3;
  pdf.setFillColor(safeColor(cell.match.backgroundColor, '#ffffff')).rect(x, y, width, titleHeight, 'F');
  pdf.setTextColor(safeColor(cell.match.fontColor, '#000000')).setFontSize(7);
  pdf.text(cell.title, x + width / 2, y + 4, { align: 'center', lineHeightFactor: 1.15 });
  pdf.setTextColor(20);
  if (cell.referees.length) {
    pdf.text(cell.referees, x + width / 2, y + titleHeight + 4, { align: 'center', lineHeightFactor: 1.15 });
  }
  pdf.setDrawColor(175);
  for (let line = 0; line < 4; line++) {
    const lineY = y + height - 2 - line * 4;
    pdf.line(x + 4, lineY, x + width - 4, lineY);
  }
}

/** Accepts only portable hexadecimal colors from division configuration. */
function safeColor(value: string, fallback: string): string {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}
