import { Component, model, OnInit, output } from '@angular/core';
import { Field, FieldQuality } from 'src/app/shared/data.model';

const defaultFieldquality: FieldQuality = 2;
const defaultVideo = false;

@Component({
  selector: 'app-tournament-fields-edit',
  template: `
    <p-card [style]="{'max-width': '600px'}">
    <div class="fieldTable">
    <p-table [value]="fields()" stripedRows
      showGridlines [size]="'small'" tableLayout="fixed"
      sortField="orderView" [sortOrder]="1">
      <ng-template #header>
          <tr class="tableRowTitle">
            <th style="width:15%" pSortableColumn="orderView">View Order</th>
            <th style="width:40%">Name</th>
            <th style="width:10%">Video</th>
            <th style="width:20%">Quality</th>
            <th style="width:15%" (click)="addField()">
            <i class="pi pi-plus action-add" aria-label="add field"></i> Add
            </th>
          </tr>
      </ng-template>
      <ng-template #body let-field let-ri="rowIndex">
          <tr class="tableRowItem">
              <td style="text-align: left; padding-left: 15px;">
                <span>{{field.orderView}}</span>
                <i class="pi pi-arrow-up action"            aria-label="up" (click)="upField(field.id)" *ngIf="field.orderView > 1"></i>
                <i class="pi pi-arrow-down action"          aria-label="down" (click)="downField(field.id)" *ngIf="field.orderView < fields().length"></i>

              </td>
              <td [pEditableColumn]="field.name" pEditableColumnField="name">
                <p-cellEditor>
                  <ng-template #input><input pInputText type="text" [(ngModel)]="field.name" (paste)="onPaste($event, ri)" /></ng-template>
                  <ng-template #output>{{ field.name }}</ng-template>
                </p-cellEditor>
              </td>
              <td><p-toggleswitch [(ngModel)]="field.video"/></td>
              <td><p-rating [ngModel]="field.quality" [stars]="3"/></td>
              <td style="text-align: center;" (click)="removeField(field.id)">
                <i class="pi pi-trash action action-remove" aria-label="remove field"></i>
              </td>
          </tr>
      </ng-template>
    </p-table>
    </div>
    </p-card>`,
  styles: [`
    .fieldTable {  margin-left: 10px; }
    .fieldTable, p-table { max-width: 600px; margin: 10 auto;}
    .tableRowTitle th, .tableRowItem td { text-align: center;}
    .action { font-size: 1rem; margin: 0 5px; }
    .action-remove { color: red; }
  `],
  standalone: false
})
export class TournamentFieldsEditComponent  {
  fields = model.required<Field[]>();
  fieldChanged = output<Field[]>()

  addField() {
    this.fields.update(fields => {
      fields.push({
        id: this.computeAvailableId(fields),
        name: this.computeAvailableName(fields),
        video: false,
        quality: 3,
        orderView: fields.length
      });
      fields.forEach((f, idx) => f.orderView = (idx+1));
      this.fieldChanged.emit(fields);
      setTimeout(() => this.fields.set(fields), 10);
      return [];
    });
  }
  removeField(fieldId: string) {
    this.fields.update(fields => {
      const idx = fields.findIndex(f => f.id === fieldId);
      if (idx < 0) return fields;
      fields.splice(idx, 1);
      fields.forEach((f, idx) => f.orderView = (idx+1));
      this.fieldChanged.emit(fields);
      setTimeout(() => this.fields.set(fields), 10);
      return [];
    });
  }
  upField(fieldId: string) {
    this.fields.update(fields => {
      // console.log('up', fieldId, JSON.stringify(fields, null, 2));
      const idx = fields.findIndex(f => f.id === fieldId);
      if (idx < 1) return fields;

      // console.log('swap up', fields[idx-1].name, fields[idx].name)
      const f = fields[idx-1];
      fields[idx-1] = fields[idx];
      fields[idx] = f;

      fields.forEach((f, idx) => f.orderView = (idx+1));
      this.fieldChanged.emit(fields);
      setTimeout(() => this.fields.set(fields), 10);
      return [];
    });
  }
  downField(fieldId: string) {
    this.fields.update(fields => {
      // console.log('down', fieldId, JSON.stringify(fields, null, 2));
      const idx = fields.findIndex(f => f.id === fieldId);
      if (idx < 0 || idx === (fields.length -1)) return fields;

      // console.log('swap down', fields[idx].name, fields[idx+1].name)
      const f = fields[idx];
      fields[idx] = fields[idx+1];
      fields[idx+1] = f;

      fields.forEach((f, idx) => f.orderView = (idx+1));
      this.fieldChanged.emit(fields);
      setTimeout(() => this.fields.set(fields), 10);
      return [];
    });
  }

  onPaste(event: ClipboardEvent, rowIndex: number) {
    event.preventDefault(); // Empêcher le collage natif

    const clipboardData = event.clipboardData || (window as any).clipboardData;
    const pastedText = clipboardData.getData('text'); // Récupérer le texte collé
    if (pastedText) {
      this.fields.update(fields => {
        // parse clipboard and filter values
        const rows: string[][] = pastedText.split('\n')
          .filter((r:string) => r.trim() !== '')
          .map((r:string) => r.split('\t').filter(c => c.trim().length > 0))
          .filter((r:string[]) => r.length > 0 && r[0].trim().length > 0)

        rows.forEach((row:string[],idx:number) => {
          // build new field
          const field: Field = {
            id: this.computeAvailableId(fields),
            name: (row.length > 0 ? row[0] : this.computeAvailableName(fields)),
            video: (row.length > 1 ? this.toFieldVideo(row[1], defaultVideo) : defaultVideo),
            quality: (row.length > 2 ? this.toFieldQuality(row[2], defaultFieldquality) : defaultFieldquality),
            orderView: 0 // managed just after injection
          };
          // inject new field
          const targetIdx = rowIndex + idx;
          if (targetIdx < fields.length) {
            fields[targetIdx] = field;
          } else {
            fields.push(field);
          }
        });

        fields.forEach((f, idx) => f.orderView = (idx+1));

        this.fieldChanged.emit(fields);
        setTimeout(() => this.fields.set(fields), 10);
        return [];
        });
    }
  }
  private toFieldVideo(str: string, defaultValue: boolean): boolean {
    if (str === undefined) return defaultValue;
    const s = str.trim();
    if (str.length === 0) return defaultValue;
    const lcStr = s.toLowerCase();
    if (['o', 'y', '1', 'yes', 'oui'].indexOf(lcStr) >= 0) return true;
    if (['n', '0', 'no', 'non'].indexOf(lcStr) >= 0) return false;
    return defaultValue;
  }
  private toFieldQuality(str: string, defaultValue: FieldQuality): FieldQuality {
    if (str === undefined) return defaultValue;
    const s = str.trim();
    if (str.length === 0) return defaultValue;
    const n = Number.parseInt(s);
    if (Number.isNaN(n)) {
      const lcStr = s.toLowerCase();
      if (['good', 'high', 'great', 'bon', '1'].indexOf(lcStr) >= 0) return 3;
      if (['medium', 'average', 'moyen'].indexOf(lcStr) >= 0) return 2;
      if (['poor', 'low', 'bad', '0','mauvais'].indexOf(lcStr) >= 0) return 1;
      return defaultValue;
    }
    const modulo = n % 4;
    if (modulo === 0) return 1;
    return modulo as FieldQuality;
  }
  private computeAvailableId(fields: Field[]): string {
    let i = 0;
    let id: string;
    do {
      i++;
      id = i.toString();
    } while(fields.findIndex(f => f.id === id) >= 0);
    return id;
  }
  private computeAvailableName(fields: Field[]): string {
    let i = 0;
    let name: string;
    do {
      i++;
      name = 'Field '+ i;
    } while(fields.findIndex(f => f.name === name) >= 0);
    return name;
  }
}
