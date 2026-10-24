import { Injectable } from '@angular/core';
import { WaterCarrierPlanning } from '@tournament-manager/persistent-data-model';
import { buildWaterCarrierPdf } from './water-carrier-pdf';

/** Creates downloadable PDFs in the browser using a locally bundled Unicode font. */
@Injectable({ providedIn: 'root' })
export class WaterCarrierPdfService {
  private font?: Promise<string>;

  /** Downloads the selected visible period for an eligible tournament manager or coach. */
  async download(planning: WaterCarrierPlanning): Promise<void> {
    if (!planning.actor?.canPrint || !planning.printedEnabled || !planning.selectedPeriodId) {
      throw new Error('PDF export is not available.');
    }
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
    pdf.addFileToVFS('NotoSans-Regular.ttf', await this.loadFont());
    pdf.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal');
    pdf.setFont('NotoSans');
    buildWaterCarrierPdf(pdf, planning);
    const period = planning.periods.find((item) => item.id === planning.selectedPeriodId)?.label ?? '';
    const filename = `${planning.tournamentName}-${period}-water-carrier`.replace(/[<>:"/\\|?*]/g, '_');
    await pdf.save(`${filename}.pdf`, { returnPromise: true });
  }

  /** Loads the bundled SIL-licensed font once, resetting the cache after a failed download. */
  private async loadFont(): Promise<string> {
    this.font ??= fetch(new URL('fonts/NotoSans-Regular.ttf', document.baseURI)).then(async (response) => {
      if (!response.ok) throw new Error('Unable to load the PDF font.');
      const bytes = new Uint8Array(await response.arrayBuffer());
      let binary = '';
      for (let index = 0; index < bytes.length; index += 8192) {
        binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
      }
      return btoa(binary);
    });
    try {
      return await this.font;
    } catch (error: unknown) {
      this.font = undefined;
      throw error;
    }
  }
}
