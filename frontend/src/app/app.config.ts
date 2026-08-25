import { ApplicationConfig, inject, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, TitleStrategy } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeuix/themes/aura';

import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { getFunctions, provideFunctions } from '@angular/fire/functions';
import { provideStorage, getStorage } from '@angular/fire/storage';
import { routes } from './app.routes';
import { environment } from '../environments/environment';
import { Title } from '@angular/platform-browser';
import { CustomTitleStrategy } from './custom-title-strategy';
import { ConfirmationService } from 'primeng/api';
import { DialogService } from 'primeng/dynamicdialog';
import { catchError, of, take } from 'rxjs';
import { UserService } from '../service/user.service';

export const appConfig: ApplicationConfig = {
  providers: [
    Title,
    { provide: TitleStrategy, useClass: CustomTitleStrategy },
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(),
    provideAnimationsAsync(),
    providePrimeNG({ theme: { preset: Aura } }),
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideAuth(() => getAuth()),
    provideFirestore(() => getFirestore()),
    provideFunctions(() => getFunctions()),
    provideStorage(() => getStorage()),
    provideAppInitializer(() =>
      inject(UserService).autoLogin().pipe(
        take(1),
        catchError(() => of(null)),
      )
    ),
    ConfirmationService,
    DialogService,
  ],
};
