import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { SharedModule } from '../shared/shared.module';
import { TournamentRoutingModule } from './tournament-routing.module';

import { TournamentListComponent } from './tournament-list.component';
import { TournamentEditComponent } from './tournament-edit.component';
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
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeng/themes/aura';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { RatingModule } from 'primeng/rating';
import { SelectModule } from 'primeng/select';
import { MessageModule } from 'primeng/message';
import { TournamentHomeComponent } from './tournament-home.component';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TournamentGamesComponent } from './tournament-games.component';

@NgModule({
  declarations: [
    TournamentDayEditComponent,
    TournamentDayTimeslotEditComponent,
    TournamentDaysEditComponent,
    TournamentDivisionEditComponent,
    TournamentDivisionsEditComponent,
    TournamentEditComponent,
    TournamentFieldsEditComponent,
    TournamentHomeComponent,
    TournamentListComponent,
    TournamentGamesComponent
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
    InputMaskModule,
    ToggleSwitchModule,
    RatingModule,
    SelectModule,
    SelectButtonModule,
    MessageModule
  ],
  providers: [
    // provideAnimationsAsync(),
    providePrimeNG({
      theme: { preset: Aura }
    })
  ]
})
export class TournamentModule { }
