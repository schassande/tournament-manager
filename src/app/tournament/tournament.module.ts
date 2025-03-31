import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { SharedModule } from '../shared/shared.module';
import { TournamentRoutingModule } from './tournament-routing.module';

import { TournamentListComponent } from './tournament-list/tournament-list.component';
import { TournamentEditComponent } from './tournament-edit/tournament-edit.component';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { DatePickerModule } from 'primeng/datepicker';
import { FormsModule} from '@angular/forms';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputMaskModule } from 'primeng/inputmask';
import { CardModule } from 'primeng/card';
import { TournamentDaysEditComponent } from './tournament-days-edit.component';
import { TournamentFieldsEditComponent } from './tournament-fields-edit.component';
import { TournamentDayTimeslotEditComponent } from './tournament-day-timeslot-edit.component';
import { TournamentDayEditComponent } from './tournament-day-edit.component';
import { TournamentDivisionsEditComponent } from './tournament-divisions-edit.component';
import { TournamentDivisionEditComponent } from './tournament-division-edit.component';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeng/themes/aura';

@NgModule({
  declarations: [
    TournamentDayEditComponent,
    TournamentDayTimeslotEditComponent,
    TournamentDaysEditComponent,
    TournamentDivisionEditComponent,
    TournamentDivisionsEditComponent,
    TournamentEditComponent,
    TournamentFieldsEditComponent,
    TournamentListComponent
  ],
  imports: [
    FormsModule,
    CommonModule,
    IonicModule,
    SharedModule,
    TournamentRoutingModule,
    ButtonModule,
    CardModule,
    TableModule,
    DatePickerModule,
    InputNumberModule,
    InputMaskModule
  ],
  providers: [
    provideAnimationsAsync(),
    providePrimeNG({
      theme: { preset: Aura },
      zIndex: {
        modal: 11000,    // dialog, sidebar
        overlay: 100000,  // dropdown, overlaypanel
        menu: 10000,     // overlay menus
        tooltip: 11000   // tooltip
      }
    })
  ]
})
export class TournamentModule { }
