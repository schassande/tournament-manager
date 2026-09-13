import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import { TournamentRefereeRanking } from '@tournament-manager/persistent-data-model';
import { PanelTable, panelResultLabel } from '../component/ranking-panel/panel-table';

/** Exports the visible comparison without computing or modifying saved data. */
@Injectable({ providedIn: 'root' })
export class PanelRankingExportService {
  /** Creates a single worksheet containing ranking context and the exact displayed table. */
  workbook(ranking: TournamentRefereeRanking, table: PanelTable): XLSX.WorkBook {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ['Ranking', ranking.name],
      ['Status', ranking.status],
      ['Result', panelResultLabel(ranking)],
      [],
      table.headers,
      ...table.rows,
    ]);
    sheet['!cols'] = table.headers.map((_, index) => ({ wch: index === 0 || index === 3 ? 8 : 32 }));
    XLSX.utils.book_append_sheet(workbook, sheet, 'Panel');
    return workbook;
  }

  /** Downloads as <tournament name>-referee-ranking-<ranking name>.xlsx with filesystem-safe characters. */
  download(tournamentName: string, ranking: TournamentRefereeRanking, table: PanelTable): void {
    const name = `${tournamentName}-referee-ranking-${ranking.name}`.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_');
    XLSX.writeFile(this.workbook(ranking, table), `${name}.xlsx`);
  }
}
