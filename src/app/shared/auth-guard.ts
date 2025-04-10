import { Observable, map } from 'rxjs';
import { inject, Injectable } from '@angular/core';

import { ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, Router } from '@angular/router';
import { UserService } from './services/user.service';

@Injectable({
  providedIn: 'root',
})
export class AuthGuard {
  userService = inject(UserService)
  router = inject(Router)

  canActivate(next: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean|Observable<boolean> {
    if (this.userService.isConnected()) {
      console.debug('AuthGuard: User is connected');
      return true;
    }
    return this.userService.autoLogin().pipe(
      map(() => {
        if (this.userService.isConnected()) {
          console.debug('AuthGuard: After auto login, User is connected');
          return true;
        } else {
          console.debug('AuthGuard: After auto login, User is NOT connected');
          this.router.navigate(['/user/login']);
          return false;
        }
      })
    );
  }
}
