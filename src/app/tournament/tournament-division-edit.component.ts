import { Component, model } from '@angular/core';
import { Division } from '../shared/data.model';

@Component({
  selector: 'app-tournament-division-edit',
  template: `<p>
    tournament-division-edit works!
  </p>`,
  styles: [`
  `],
  standalone: false
})
export class TournamentDivisionEditComponent {

  division = model.required<Division>();

}
