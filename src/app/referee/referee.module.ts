import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { SharedModule } from '../shared/shared.module';

import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { FormsModule} from '@angular/forms';
import { InputNumberModule } from 'primeng/inputnumber';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeng/themes/aura';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { SelectModule } from 'primeng/select';
import { MessageModule } from 'primeng/message';
import { TournamentRefereeComponent } from './tournament-referee.component';
import { RefereeRoutingModule } from './referee-routing.module';
import { TournamentRefereeEditComponent } from './tournament-referee-edit.component';
import { TabsModule } from 'primeng/tabs';
import { FieldsetModule } from 'primeng/fieldset';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';

@NgModule({
  declarations: [
    TournamentRefereeComponent, TournamentRefereeEditComponent
  ],
  imports: [
    RefereeRoutingModule,
    FormsModule,
    CommonModule,
    IonicModule,
    SharedModule,
    ButtonModule,
    TableModule,
    InputNumberModule,
    ToggleSwitchModule,
    SelectModule,
    TabsModule,
    FieldsetModule,
    AutoCompleteModule,
    ConfirmDialogModule,
    MessageModule
  ],
  providers: [
    // provideAnimationsAsync(),
    ConfirmationService,
    providePrimeNG({
      theme: { preset: Aura }
    })
  ]
})
export class RefereeModule { }
