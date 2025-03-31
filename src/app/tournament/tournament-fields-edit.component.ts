import { Component, model, OnInit, output } from '@angular/core';
import { Field } from 'src/app/shared/data.model';

@Component({
  selector: 'app-tournament-fields-edit',
  template: `
  <div class="fieldTable">
    <p-table [value]="fields()" stripedRows [tableStyle]="{'max-width': '50rem'}"
      showGridlines [size]="'small'" tableLayout="fixed"
      sortField="name" [sortOrder]="1">
      <ng-template #header>
          <tr class="tableRowTitle">
              <th style="width:50%" pSortableColumn="name">Name&nbsp;<p-sortIcon field="name"/></th>
              <th style="width:20%">Video</th>
              <th style="width:20%">Quality</th>
              <th style="width:10%" (click)="addField()">
                <i class="pi pi-plus action-add" aria-label="add field"></i>
              </th>
          </tr>
      </ng-template>
      <ng-template #body let-field let-ri="rowIndex">
          <tr class="tableRowItem">
              <td [pEditableColumn]="field.name" pEditableColumnField="name">
                <p-cellEditor>
                  <ng-template #input><input pInputText type="text" [(ngModel)]="field.name" /></ng-template>
                  <ng-template #output>{{ field.name }}</ng-template>
                </p-cellEditor>
              </td>
              <td><p-toggleswitch [(ngModel)]="field.video"/></td>
              <td><p-rating [ngModel]="field.quality" [stars]="3"/></td>
              <td (click)="removeField(field.id)">
                <i class="pi pi-trash action-remove"  aria-label="remove field"></i>
              </td>
          </tr>
      </ng-template>
    </p-table>
    </div>`,
  styles: [`
    .fieldTable {  margin-left: 10px; }
    .fieldTable, p-table { max-width: 500px; margin: 10 auto;}
    .tableRowTitle th, .tableRowItem td { text-align: center;}
  `],
  standalone: false
})
export class TournamentFieldsEditComponent  {
  fields = model.required<Field[]>();
  fieldChanged = output<Field[]>()

  addField() {
    this.fields.update(fields => {
      // find a free field name 'Field X'
      let i = 0;
      let name: string;
      do {
        i++;
        name = 'Field '+ i;
      } while(fields.findIndex(f => f.name === name) >= 0);

      // find a free field id
      i = 0;
      let id: string;
      do {
        i++;
        id = i.toString();
      } while(fields.findIndex(f => f.id === id) >= 0);

      fields.push({ id, name, video: false, quality: 3 });
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
      this.fieldChanged.emit(fields);
      setTimeout(() => this.fields.set(fields), 10);
      return [];
    });
  }

}
