import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class TitleService {
  public readonly title$ = signal<String>('Tournament Manager');
}
