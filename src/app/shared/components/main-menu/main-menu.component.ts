import { Component, inject, OnInit, output } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  standalone: false,
  selector: 'app-main-menu',
  templateUrl: './main-menu.component.html',
  styleUrls: ['./main-menu.component.scss'],
})
export class MainMenuComponent {
  router = inject(Router);
  closeMenu = output();

  route(path: string) {
    console.log('Routing to', path);
    this.router.navigate([path]);
    this.closeMenu.emit();
  }
}
