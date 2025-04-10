import { Injectable } from '@angular/core';
import { Country, Region } from '../data.model';
import { AbstractPersistentDataService } from '../abstract-persistent-data.service';
import { map, mergeMap, of } from 'rxjs';
import { defaultRegions } from './regions.default';

@Injectable({
  providedIn: 'root'
})
export class RegionService extends AbstractPersistentDataService<Region>{

  protected override getCollectionName(): string { return 'region'; }
  readonly regions: Region[] = [];

  constructor() {
    super();
    // this.init();
    this.loadRegions();
  }

  private loadRegions() {
    this.all().pipe(
      map((regions: Region[]) => {
        this.regions.splice(0, this.regions.length);
        this.regions.push(...regions);
      })
    ).subscribe();
  }

  protected init() {
    console.log('Initialize regions');
    defaultRegions.forEach(region => {
      this.byId(region.id).pipe(
        mergeMap(r => !r ? this.save(region) : of(r) ),
      ).subscribe();
    });
  }

  public regionById(id: string): Region|undefined {
    return this.regions.find(region => region.id === id);
  }

  public countryById(id: string): Country|undefined {
    for (const region of this.regions) {
      const country = region.countries.find(country => country.id === id);
      if (country) {
        return country;
      }
    }
    return undefined;
  }
}
