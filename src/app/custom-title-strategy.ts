import { Injectable } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRouteSnapshot, RouterStateSnapshot, TitleStrategy } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class CustomTitleStrategy extends TitleStrategy {
  constructor(private titleService: Title) {
    super();
  }

  override updateTitle(routerState: RouterStateSnapshot): void {
    const route = this.getDeepestChild(routerState.root);
    // Récupération du titre défini dans les données de la route
    if (route.data?.['title']) {
      this.titleService.setTitle(route.data?.['title']);
    } else {
      this.titleService.setTitle('Tournament Manager');
    }
  }
  private getDeepestChild(route: ActivatedRouteSnapshot): ActivatedRouteSnapshot {
    while (route.firstChild) {
      route = route.firstChild;
    }
    return route;
  }
}
