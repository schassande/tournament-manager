import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';

/** A rectangular export table with a header row. */
export interface PlanningExportTable {
  headers: string[];
  rows: string[][];
  cellTitleStyles?: Array<Array<PlanningExportCellStyle | undefined>>;
}

/** Optional visual styles applied to a planning export cell. */
export interface PlanningExportCellStyle {
  backgroundColor?: string;
  color?: string;
}

/** Provides browser exports for referee planning tables. */
@Injectable({ providedIn: 'root' })
export class RefereePlanningService {
  /** Downloads an Excel workbook containing the supplied planning table. */
  exportExcel(table: PlanningExportTable, fileName: string): void {
    const sheet = XLSX.utils.aoa_to_sheet([table.headers, ...table.rows]);
    sheet['!freeze'] = { xSplit: 1, ySplit: 1 };
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Planning');
    XLSX.writeFile(workbook, `${this.safeFileName(fileName)}.xlsx`);
  }

  /** Opens a print-ready browser document that the user can save as PDF. */
  exportPdf(table: PlanningExportTable, title: string): void {
    const popup = window.open('', '_blank');
    if (!popup) return;
    const header = table.headers
      .map((value) => `<th>${this.escapeHtml(value)}</th>`)
      .join('');
    const rows = table.rows
      .map(
        (row, rowIndex) =>
          `<tr>${row
            .map((value, columnIndex) => {
              const style = table.cellTitleStyles?.[rowIndex]?.[columnIndex];
              return `<td>${this.exportCellContent(value, style)}</td>`;
            })
            .join('')}</tr>`,
      )
      .join('');
    popup.document
      .write(`<html><head><title>${this.escapeHtml(title)}</title><style>
      body { font-family: Arial, sans-serif; font-size: 10px; }
      table { border-collapse: collapse; width: 100%; } th, td { border: 1px solid #999; padding: 0; vertical-align: top; text-align: center; white-space: pre-line; }
      .export-match-title { padding: 0.2rem 0.3rem; }
      th { background: #eee; } @media print { @page { size: landscape; margin: 10mm; } }
    </style></head><body><h1>${this.escapeHtml(title)}</h1><table><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table></body></html>`);
    popup.document.close();
    popup.focus();
    popup.print();
  }

  /** Sanitizes a generated download filename. */
  private safeFileName(value: string): string {
    return value.replace(/[<>:"/\\|?*]/g, '_').trim() || 'referee-planning';
  }

  /** Escapes text inserted into the print document. */
  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** Builds the inline style attribute for an exported cell. */
  private cellStyleAttribute(style: PlanningExportCellStyle): string {
    const declarations = [
      style.backgroundColor && `background-color: ${style.backgroundColor}`,
      style.color && `color: ${style.color}`,
    ].filter(Boolean);
    return declarations.length
      ? ` style="${this.escapeHtml(declarations.join('; '))}"`
      : '';
  }

  /** Renders an exported cell while styling only its first, match-title line. */
  private exportCellContent(
    value: string,
    titleStyle: PlanningExportCellStyle | undefined,
  ): string {
    if (!titleStyle) {
      return this.escapeHtml(value);
    }
    const [title, ...details] = value.split('\n');
    const styleAttribute = this.cellStyleAttribute(titleStyle);
    return [
      `<div class="export-match-title"${styleAttribute}>${this.escapeHtml(title)}</div>`,
      ...details.map((detail) => `<div>${this.escapeHtml(detail)}</div>`),
    ].join('');
  }
}
