import { IonMenu } from '@ionic/angular';
import { UserService } from './shared/services/user.service';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal, viewChild, ViewChild, ChangeDetectorRef } from '@angular/core';
import { RegionService } from './shared/services/region.service';
import { Router } from '@angular/router';
import { Title } from '@angular/platform-browser';

@Component({
  standalone: false,
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent implements OnInit {

  userService = inject(UserService);
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
  }

  closeUserMenu() {
    this.userMenu()?.close();
  }
  closeMainMenu() {
    this.mainMenu()?.close();
  }
}
