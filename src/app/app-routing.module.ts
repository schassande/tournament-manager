import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './components/home/home.component';

const routes: Routes = [
  { path: 'home',       component: HomeComponent , data: { title: 'Home' }, pathMatch: 'full'},
  { path: 'user',       loadChildren: () => import('./user/user.module').then( m => m.UserModule), pathMatch: 'prefix'},
  { path: 'tournament', loadChildren: () => import('./tournament/tournament.module').then( m => m.TournamentModule), pathMatch: 'prefix'},
  { path: '',         redirectTo: '/home', pathMatch: 'full' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)], // , { enableTracing: true }
  exports: [RouterModule]
})
export class AppRoutingModule {}
