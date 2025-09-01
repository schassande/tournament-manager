import { IonMenu } from '@ionic/angular';
import { UserService } from './shared/services/user.service';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal, viewChild, ViewChild, ChangeDetectorRef } from '@angular/core';
import { RegionService } from './shared/services/region.service';
import { Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { TournamentService } from './shared/services/tournament.service';
import { NgSelectConfig } from '@ng-select/ng-select';

@Component({
  standalone: false,
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent implements OnInit {

  userService = inject(UserService);
  tournamentService = inject(TournamentService);
  router = inject(Router);
  regionService = inject(RegionService);
  cdr = inject(ChangeDetectorRef)

  userMenu = viewChild<IonMenu>('userMenu');
  mainMenu = viewChild<IonMenu>('mainMenu');
  titleService = inject(Title);
  title = signal('');

  ngOnInit(): void {
    // Update the page title each time
    this.router.events.pipe().subscribe(() => this.title.set(this.titleService.getTitle()));
    this.tournamentService.loadCurrentTournamentFromLocalStorage().subscribe(t => {
      if (t) {
        // if asked page is home '/', then go to tournament home
        if (this.router.url === '/') {
          //this.router.navigate(['/tournament', t.id, 'home']);
        }
      }
    });
  }

  closeUserMenu() {
    this.userMenu()?.close();
  }
  closeMainMenu() {
    this.mainMenu()?.close();
  }
}
