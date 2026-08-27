import { Component, inject, Input, OnInit } from '@angular/core';
import { Country, Gender, Person, RefereeCoach, Tournament } from '@tournament-manager/persistent-data-model';
import { RegionService } from '../service/region.service';
import { PersonService } from '../service/person.service';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FieldsetModule } from 'primeng/fieldset';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TabsModule } from 'primeng/tabs';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { NgxColorsModule } from 'ngx-colors';
import { AttendeeUnavailabilityComponent } from './attendee-unavailability.component';

@Component({
  selector: 'app-tournament-referee-coach-edit',
  imports: [
    AttendeeUnavailabilityComponent,
    AutoCompleteModule,
    CommonModule,
    FieldsetModule,
    FormsModule,
    InputTextModule,
    NgxColorsModule,
    SelectModule,
    TabsModule,
    ToggleSwitchModule,
  ],
  template: `
<div>
@if (coach?.attendee?.person) {
  <p-tabs value="general">
    <p-tablist>
      <p-tab value="general">General</p-tab>
      <p-tab value="unavailability">Unavailability</p-tab>
    </p-tablist>
    <p-tabpanels>
      <p-tabpanel value="general">
        <div class="form-field fieldSet">
          <label for="search">Search a person:</label>
          <p-autocomplete [(ngModel)]="existingStr" [suggestions]="existingPersons" optionLabel="firstName"
            [forceSelection]="true" (completeMethod)="searchExisting()" class="longText"
            (onSelect)="onSelectPerson($event.value)">
            <ng-template #header>
              <div class="font-medium px-3 py-2">Found persons</div>
            </ng-template>
            <ng-template let-person #item>
              <div>{{ personToLabel(person) }}</div>
            </ng-template>
          </p-autocomplete>
        </div>

        <p-fieldset legend="Person information" class="fieldSet">
          <div class="form-field">
            <label for="firstName">First name</label>
            <input id="firstName" type="text" pInputText [(ngModel)]="coach!.attendee.person!.firstName"
            required minlength="2" maxlength="30" class="longText"/>
          </div>
          <div class="form-field">
            <label for="lastName">Last name</label>
            <input id="lastName" type="text" pInputText [(ngModel)]="coach!.attendee.person!.lastName" required minlength="2" maxlength="30" class="longText"/>
          </div>
          <div class="form-field">
            <label for="shortName">Short name</label>
            <input id="shortName" type="text" pInputText [(ngModel)]="coach!.attendee.person!.shortName" required maxlength="6" minlength="3" style="width: 5rem;" />
          </div>
          <div class="form-field">
            <label for="country">Country</label>
            <p-select id="country" size="small" [options]="countries" optionLabel="name"
              [(ngModel)]="refereeCoachCountry" [filter]="true" class="longText"
              appendTo="body" (onChange)="countrySelected($event.value)" required>
              <ng-template let-country #item>{{ country.name }}</ng-template>
              <ng-template let-country #selectedItem>{{ country.name }}</ng-template>
              <ng-template #dropdownicon><i class="pi pi-map"></i></ng-template>
            </p-select>
          </div>
          <div class="form-field">
            <label for="gender">Gender</label>
            <p-select id="gender" size="small" [options]="genders" [(ngModel)]="coach!.attendee.person!.gender" appendTo="body" required/>
          </div>
          <div class="form-field">
            <label for="email">Email</label>
            <input id="email" type="email" pInputText [(ngModel)]="coach!.attendee.person!.email" class="longText" maxlength="50"/>
          </div>
          <div class="form-field">
            <label for="phone">Phone</label>
            <input id="phone" type="phone" pInputText [(ngModel)]="coach!.attendee.person!.phone"/>
          </div>
        </p-fieldset>

        <p-fieldset legend="Referee Coach information" class="fieldSet">
          <div class="form-field">
            <label for="refereeBadgeSystem">Badge System</label>
            <input id="refereeBadgeSystem" type="number" pInputText
              [(ngModel)]="coach!.attendee!.refereeCoach!.badgeSystem"
              min="3" max="6" style="width: 4rem;" (change)="adjustUpgrade()"/>
              <span>levels</span>
            <span class="inputInfo" *ngIf="refereeCoachCountry!.badgeSystem! > 0">Country badge system: {{refereeCoachCountry!.badgeSystem}}</span>
          </div>
          <div class="form-field">
            <label for="refereeCoachBadge">Badge Level</label>
            <input id="refereeCoachBadge" type="number" pInputText
              [(ngModel)]="coach!.attendee!.refereeCoach!.badge" (change)="adjustUpgrade()"
              min="0" max="{{coach!.attendee!.refereeCoach!.badgeSystem}}" style="width: 4rem;"/>
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
          @if (coach && coach.attendee && coach.attendee.refereeCoach) {
            <div class="form-field">
              <label for="background">Color</label>
              Font: <ngx-colors class="colorPicker" ngx-colors-trigger overlayClassName="referee-coach-color-picker-overlay"
                [(ngModel)]="coach!.attendee!.refereeCoach!.fontColor"></ngx-colors>
              Bakckground: <ngx-colors class="colorPicker" ngx-colors-trigger overlayClassName="referee-coach-color-picker-overlay"
                [(ngModel)]="coach!.attendee!.refereeCoach!.backgroundColor"></ngx-colors>
              <span style="margin-left: 10px; padding: 10px; color: {{coach!.attendee!.refereeCoach!.fontColor}}; background-color: {{coach!.attendee!.refereeCoach!.backgroundColor}}">{{coach!.attendee.person!.shortName}}</span>
            </div>
          }
        </p-fieldset>
      </p-tabpanel>

      <p-tabpanel value="unavailability">
        @if (coach && tournament) {
          <app-attendee-unavailability
            [attendee]="coach.attendee"
            [tournament]="tournament">
          </app-attendee-unavailability>
        }
      </p-tabpanel>
    </p-tabpanels>
  </p-tabs>
}
</div>`,
  styles: [`
    .fieldSet { margin-top: 10px; }
    .form-field { margin-bottom: 5px; }
    .longText {  width: 60%; }
    .form-field label { width: 25%; display: inline-block; text-align: right; padding-right: 5px; }
    .categorySelect { width: 5rem; }
    .inputInfo { font-size: 0.8rem;  margin-left: 5px; font-style: italic;}
    .colorPicker { display: inline-block; }
  `],
  standalone: true
})
export class TournamentRefereeCoachEditComponent  implements OnInit {

  regionService = inject(RegionService);
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
    if (this.coach && this.coach.attendee.person && this.coach.attendee.person.countryId) {
      this.refereeCoachCountry = this.regionService.countryById(this.coach!.attendee.person!.countryId);
      // console.log(this.refereeCountry);
      this.computeRefereeCoachUpgrade();
    }
  }

  private computeRefereeCoachUpgrade() {
    if (!this.coach || !this.coach.attendee || !this.coach.attendee.refereeCoach) return;
    this.refereeCoachUpgrade = this.coach.attendee.refereeCoach?.upgrade?.badge === 0
      || this.coach.attendee.refereeCoach?.badge === this.coach.attendee.refereeCoach?.badgeSystem;

  }
  countrySelected(country: Country) {
    // console.log('Selected country',country)
    this.coach!.attendee.person!.countryId = country.id;
    this.coach!.attendee.person!.regionId = this.regionService.regionByCountryId(country.id)!.id;
  }
  searchExisting() {
    console.log('search person with keyword', this.existingStr);
    this.personService.search({keyword: this.existingStr}).subscribe(persons => {
      this.existingPersons = persons;
    });
  }
  onSelectPerson(person: Person) {
    const attendee = this.coach!.attendee;
    // console.log('onSelectPerson', person, attendee.person);
    attendee.person!.personId = person.id ?? '';
    attendee.person!.firstName = person.firstName ?? '';
    attendee.person!.lastName = person.lastName ?? '';
    attendee.person!.shortName = person.shortName ?? '';
    attendee.person!.countryId = person.countryId ?? '';
    attendee.person!.regionId = person.regionId ?? '';
    attendee.person!.email = person.email ?? '';
    attendee.person!.phone = person.phone ?? '';
    attendee.person!.gender = person.gender ?? 'M';
    attendee.refereeCoach = person.refereeCoach ?? { 
      backgroundColor: 'white', 
      fontColor: 'black', 
      badge: 0, 
      badgeSystem: 5,
      upgrade: {badge: 0, badgeSystem: 5}
    };
  }
  personToLabel(person:Person): string {
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
  }
  onUpgradeChange() {
    this.computeRefereeCoachUpgrade();
  }
}
