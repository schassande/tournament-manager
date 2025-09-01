import { inject, Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { TitleService } from '../service/title.service';

@Injectable({ providedIn: 'root' })
export class CustomTitleStrategy extends TitleStrategy {
  private titleService = inject(TitleService);

  constructor() { super(); }

  override updateTitle(routerState: RouterStateSnapshot): void {
    const route = this.getDeepestChild(routerState.root);
    // Récupération du titre défini dans les données de la route
    if (route.data?.['title']) {
      this.titleService.title$.set(route.data?.['title']);
    } else {
      this.titleService.title$.set('Tournament Manager');
    }
  }
  private getDeepestChild(route: ActivatedRouteSnapshot): ActivatedRouteSnapshot {
    while (route.firstChild) {
      route = route.firstChild;
    }
    return route;
  }
}
