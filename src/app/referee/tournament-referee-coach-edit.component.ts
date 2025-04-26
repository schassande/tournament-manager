import { Component, inject, Input, OnInit } from '@angular/core';
import { RegionService } from '../shared/services/region.service';
import { ModalController } from '@ionic/angular';
import { PersonService } from '../shared/services/person.service';
import { Country, Gender, Person, RefereeCoach, Tournament } from '../shared/data.model';

@Component({
  selector: 'app-tournament-referee-coach-edit',
  template: `

<div style="padding: 10px;">
  <h1 style="text-align: center;">Find or edit a referee</h1>
@if (coach?.person) {
  <div class="fieldSet"></div>
  <div class="form-field">
    <label for="search">Search a person:</label>
    <p-autocomplete [(ngModel)]="existingStr" [suggestions]="existingPersons" optionLabel="firstName"
      [forceSelection]="true" (completeMethod)="searchExisting()" class="longText"
      (onSelect)="onSelectPerson($event.value)">
      <ng-template #header>
        <div class="font-medium px-3 py-2">Found persons</div>
      </ng-template>
      <ng-template let-person #item>
        <div>{{ personToLabel(person) }})</div>
      </ng-template>
    </p-autocomplete>
  </div>

  <div class="fieldSet"></div>
  <p-fieldset legend="Person information" class="fieldSet">
    <div class="form-field">
      <label for="firstName">First name</label>
      <input id="firstName" type="text" pInputText [(ngModel)]="coach!.person!.firstName"
      required minlength="2" maxlength="30" class="longText"/>
    </div>
    <div class="form-field">
      <label for="lastName">Last name</label>
      <input id="lastName" type="text" pInputText [(ngModel)]="coach!.person!.lastName" required minlength="2" maxlength="30" class="longText"/>
    </div>
    <div class="form-field">
      <label for="shortName">Short name</label>
      <input id="shortName" type="text" pInputText [(ngModel)]="coach!.person!.shortName" required maxlength="6" minlength="3" style="width: 5rem;" />
    </div>
    <div class="form-field">
      <label for="country">Country</label>
      <p-select id="country" size="small" [options]="countries" optionLabel="name"
        [(ngModel)]="refereeCoachCountry" [editable]="true" class="longText"
        appendTo="body" (onChange)="countrySelected($event.value)" required>
        <ng-template let-country #item>{{ country.name }}</ng-template>
        <ng-template let-country #selectedItem>{{ country.name }}</ng-template>
        <ng-template #dropdownicon><i class="pi pi-map"></i></ng-template>
      </p-select>
    </div>
    <div class="form-field">
      <label for="gender">Gender</label>
      <p-select id="gender" size="small" [options]="genders" [(ngModel)]="coach!.person!.gender" appendTo="body" required/>
    </div>
    <div class="form-field">
      <label for="email">Email</label>
      <input id="email" type="email" pInputText [(ngModel)]="coach!.person!.email" class="longText" maxlength="50"/>
    </div>
    <div class="form-field">
      <label for="phone">Phone</label>
      <input id="phone" type="phone" pInputText [(ngModel)]="coach!.person!.phone"/>
    </div>
  </p-fieldset>

  <div class="fieldSet"></div>
  <p-fieldset legend="Referee information">
    <div class="form-field">
      <label for="refereeBadgeSystem">Badge System</label>
      <input id="refereeBadgeSystem" type="number" pInputText
        [(ngModel)]="coach!.attendee!.refereeCoach!.badgeSystem"
        min="3" max="6" style="width: 2rem;" (change)="adjustUpgrade()"/>
        <span>levels</span>
      <span class="inputInfo" *ngIf="refereeCoachCountry!.badgeSystem! > 0">Country badge system: {{refereeCoachCountry!.badgeSystem}}</span>
    </div>
    <div class="form-field">
      <label for="refereeCoachBadge">Badge Level</label>
      <input id="refereeCoachBadge" type="number" pInputText
        [(ngModel)]="coach!.attendee!.refereeCoach!.badge" (change)="adjustUpgrade()"
        min="0" max="{{coach!.attendee!.refereeCoach!.badgeSystem}}" style="width: 2rem;"/>
    </div>
    <div class="form-field" *ngIf="coach!.attendee!.refereeCoach!.badge < coach!.attendee!.refereeCoach!.badgeSystem">
      <label for="refereeBadge">Upgrade?</label>
      <span style="vertical-align: middle;">
        <p-toggleswitch [(ngModel)]="refereeCoachUpgrade" (onChange)="onUpgradeChange()"/>
      </span>
      <span style="vertical-align: middle; margin: 0 5px;" *ngIf="refereeCoachUpgrade">to</span>
      <input id="refereeBadge" type="number" pInputText
        [(ngModel)]="coach!.attendee!.refereeCoach!.upgrade!.badge"
        min="0" max="{{coach!.attendee!.refereeCoach!.upgrade!.badgeSystem}}"
        style="margin-left: 5px; width: 2rem;"
        *ngIf="refereeCoachUpgrade"/>
    </div>
  </p-fieldset>
}
</div>`,
  styles: [`
    .fieldSet { margin-top: 10px; }
    .form-field { margin-bottom: 5px; }
    .longText {  width: 60%; }
    .form-field label { width: 25%; display: inline-block; text-align: right; padding-right: 5px; }
    .categorySelect { width: 5rem; }
    .inputInfo { font-size: 0.8rem;  margin-left: 5px; font-style: italic;}
  `],
  standalone: false
})
export class TournamentRefereeCoachEditComponent  implements OnInit {

  regionService = inject(RegionService);
  modalController = inject(ModalController);
  personService = inject(PersonService);

  @Input() coach: RefereeCoach|undefined;
  refereeCoachCountry : Country | undefined = undefined;
  readonly genders: Gender[] = ['M', 'F'];
  countries = this.regionService.countries;
  refereeCoachUpgrade: boolean = false;
  @Input() tournament : Tournament|undefined = undefined;
  existingStr: string = '';
  existingPersons: Person[] = [];

  ngOnInit(): void {
    if (this.coach && this.coach.person && this.coach.person.countryId) {
      this.refereeCoachCountry = this.regionService.countryById(this.coach!.person!.countryId);
      // console.log(this.refereeCountry);
      this.computeRefereeCoachUpgrade();
    }
  }

  private computeRefereeCoachUpgrade() {
    if (!this.coach || !this.coach.attendee || !this.coach.attendee.referee) return;
    this.refereeCoachUpgrade = this.coach.attendee.refereeCoach?.upgrade?.badge === 0
      || this.coach.attendee.refereeCoach?.badge === this.coach.attendee.refereeCoach?.badgeSystem;

  }
  countrySelected(country: Country) {
    // console.log('Selected country',country)
    this.coach!.person!.countryId = country.id;
    this.coach!.person!.regionId = this.regionService.regionByCountryId(country.id)!.id;
  }
  searchExisting() {
    console.log('search person with keyword', this.existingStr);
    this.personService.search({keyword: this.existingStr}).subscribe(persons => {
      this.existingPersons = persons;
    });
  }
  onSelectPerson(person: Person) {
    // console.log('onSelectPerson', person);
    this.coach!.person = person;
    this.coach!.attendee.personId = person.id;
    if (person.referee) this.coach!.attendee!.referee = person.referee
    if (person.refereeCoach) this.coach!.attendee!.refereeCoach = person.refereeCoach
  }
  personToLabel(person:any): string {
    const country = this.regionService.countryById(person.countryId)
    return person.firstName + ' ' + person.lastName + (country ? ' ('+country.shortName+')' : '');
  }
  adjustUpgrade() {
    if (this.coach!.attendee.refereeCoach!.badge > this.coach!.attendee.refereeCoach!.badgeSystem) {
      this.coach!.attendee.refereeCoach!.badge = this.coach!.attendee.refereeCoach!.badgeSystem
    }
    if (this.coach!.attendee.refereeCoach?.badge === this.coach!.attendee.refereeCoach?.badgeSystem) {
      this.refereeCoachUpgrade = false;
      this.onUpgradeChange();
    }
    this.coach!.person!.refereeCoach = this.coach!.attendee.refereeCoach;
  }
  onUpgradeChange() {
    this.computeRefereeCoachUpgrade();
    if (this.coach && this.coach.person) {
      this.coach.person.refereeCoach = this.coach.attendee.refereeCoach;
    }
  }
}
