import { NgModule } from '@angular/core';
import { BrowserModule, Title } from '@angular/platform-browser';
import { IonicModule, IonicRouteStrategy } from '@ionic/angular';
import { AppRoutingModule } from './app-routing.module';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
//import { ServiceWorkerModule } from '@angular/service-worker';
import { FormsModule } from '@angular/forms';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeng/themes/aura';

// Import Firebase Modules
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { environment } from '../environments/environment';

// Components
import { AppComponent } from './app.component';
import { PreloadAllModules, TitleStrategy } from '@angular/router';
import { getFunctions, provideFunctions } from '@angular/fire/functions';
import { getMessaging, provideMessaging } from '@angular/fire/messaging';
import { SharedModule } from './shared/shared.module';
import { CustomTitleStrategy } from './custom-title-strategy';
import { HomeComponent } from './components/home/home.component';

@NgModule({
  declarations: [AppComponent, HomeComponent],
  bootstrap: [AppComponent],
  imports: [
    AppRoutingModule,
    BrowserModule,
    BrowserAnimationsModule,
    FormsModule,
    IonicModule.forRoot(),
    SharedModule
  ],
  providers: [
    { provide: PreloadAllModules, useClass: IonicRouteStrategy },
    Title,
    { provide: TitleStrategy, useClass: CustomTitleStrategy },
    provideFirebaseApp(() => initializeApp(environment.firebaseConfig)),
    provideAuth(() => getAuth()),
    provideFirestore(() => getFirestore()),
    provideFunctions(() => getFunctions()),
    provideMessaging(() => getMessaging()),
    provideAnimationsAsync(),
    providePrimeNG({ theme: { preset: Aura } })
  ]
})
export class AppModule {}
