import { Injectable } from '@angular/core';
import { Country, Region } from '../data.model';
import { AbstractPersistentDataService } from './abstract-persistent-data.service';
import { map, mergeMap, of } from 'rxjs';
import { defaultRegions } from './regions.default';

@Injectable({
  providedIn: 'root'
})
export class RegionService extends AbstractPersistentDataService<Region>{

  protected override getCollectionName(): string { return 'region'; }
  public readonly regions: Region[] = [];
  public readonly countries: Country[] = [];

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

        this.countries.splice(0, this.countries.length);
        this.regions.forEach(region => this.countries.push(...region.countries));
        this.countries.sort((country1, country2) => country1.name.localeCompare(country2.name));
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

  public regionByCountryId(countryId: string): Region|undefined {
    for (const region of this.regions) {
      const country = region.countries.find(country => country.id === countryId);
      if (country) {
        return region;
      }
    }
    return undefined;
  }
}
