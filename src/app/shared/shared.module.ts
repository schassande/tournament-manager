import { ButtonModule } from 'primeng/button';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MainMenuComponent } from './components/main-menu.component';
import { UserMenuComponent } from './components/user-menu.component';
import { IonicModule } from '@ionic/angular';
import { UserMenuTitleComponent } from './components/user-menu-title.component';
import { FormsModule } from '@angular/forms';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeng/themes/aura';
import { AuthGuard } from './auth-guard';

@NgModule({
  declarations: [MainMenuComponent, UserMenuComponent, UserMenuTitleComponent],
  imports: [CommonModule, IonicModule, FormsModule,ButtonModule],
  exports: [MainMenuComponent, UserMenuComponent, UserMenuTitleComponent],
  providers: [
    provideAnimationsAsync(),
    providePrimeNG({
        theme: {
            preset: Aura
        }
    }),
    AuthGuard
  ]
})
export class SharedModule { }
