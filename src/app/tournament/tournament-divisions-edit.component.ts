import { Component, model } from '@angular/core';
import { Division } from '../shared/data.model';

@Component({
  selector: 'app-tournament-divisions-edit',
  template: `<p>
    tournament-divisions-edit works!
  </p>`,
  styles: [''],
  standalone: false
})
export class TournamentDivisionsEditComponent {

  divisions = model.required<Division[]>()

  public addDivision() {
  }

}
