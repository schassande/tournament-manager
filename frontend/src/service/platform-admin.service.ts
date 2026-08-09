import { Injectable } from '@angular/core';
import { PlatformAdmin } from '@tournament-manager/persistent-data-model';
import { AbstractPersistentDataService } from './abstract-persistent-data.service';


@Injectable({
  providedIn: 'root'
})
export class PersonService extends AbstractPersistentDataService<PlatformAdmin>{

  protected override getCollectionName(): string { return 'platform-admin'; }

  constructor() {
    super();
    this.autoIdAllocation = false;
  }
}
