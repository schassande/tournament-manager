import { Component, model, OnInit } from '@angular/core';
import { Field } from 'src/app/shared/data.model';

@Component({
  selector: 'app-tournament-fields-edit',
  template: `
    todo
    `,
  styles: [''],
  standalone: false
})
export class TournamentFieldsEditComponent  {
  fields = model.required<Field[]>();

  addField() {
    this.fields.update(fields => {
      const id = fields.length.toString();
      fields.push({ id, name: 'Field '+id, video: false, quality: 1 });
      return fields;
    });
  }
  removeField(index: number) {
    this.fields.update(fields => {
      fields.splice(index, 1);
      return fields;
    });
  }

}
