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
import { TournamentRefereeCoachComponent } from './tournament-referee-coach.component';
import { TournamentRefereeCoachEditComponent } from './tournament-referee-coach-edit.component';
import { TournamentRefereesAllocationsComponent } from './allocation/tournament-referees-allocations.components';
import { TournamentRefereesAllocationComponent } from './allocation/tournament-referees-allocation.component';
import { CardModule } from 'primeng/card';
import { NgSelectModule } from '@ng-select/ng-select';
import { GameRefereeAllocatorComponent } from './allocation/game-referee-allocator.component';
import { NgxColorsModule } from 'ngx-colors';
import { BadgeModule } from 'primeng/badge';
import { OverlayBadgeModule } from 'primeng/overlaybadge';

@NgModule({
  declarations: [
    TournamentRefereeComponent,
    TournamentRefereeEditComponent,
    TournamentRefereeCoachComponent,
    TournamentRefereeCoachEditComponent,
    TournamentRefereesAllocationComponent,
    TournamentRefereesAllocationsComponent,
    GameRefereeAllocatorComponent
  ],
  imports: [
    RefereeRoutingModule,
    FormsModule,
    CommonModule,
    IonicModule,
    SharedModule,
    NgxColorsModule,
    ButtonModule,
    CardModule,
    TableModule,
    InputNumberModule,
    ToggleSwitchModule,
    SelectModule,
    TabsModule,
    FieldsetModule,
    AutoCompleteModule,
    ConfirmDialogModule,
    MessageModule,
    NgSelectModule,
    BadgeModule, OverlayBadgeModule
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
