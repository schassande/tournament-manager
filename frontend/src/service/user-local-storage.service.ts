import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class UserLocalStorageService {

  /** Set an user property */
  setUserProperty(key: string, value: any): void {
    localStorage.setItem(key, JSON.stringify(value));
    if (this.getUserProperty(key) !== value) {
      console.error('Pb storing key='+key+', value:',value, this.getUserProperty(key));
    }
  }

  /** Get an user property */
  getUserProperty(key: string): any {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  }

  /** Remove an user property */
  removeUserProperty(key: string): void {
    localStorage.removeItem(key);
  }

  /** Delete all user property */
  clearUserProperties(): void {
    localStorage.clear();
  }
}
