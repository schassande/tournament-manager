import { RegionService } from 'src/app/shared/services/region.service';
import { Component, effect, inject, Input, input, model, OnInit, signal } from '@angular/core';
import { Country, Gender, Person, Referee, RefereeCategory, Team, TeamDivision, Tournament } from '../shared/data.model';
import { ModalController } from '@ionic/angular';
import { PersonService } from '../shared/services/person.service';

@Component({
  selector: 'app-tournament-referee-edit',
  template: `
<div style="padding: 10px;">
  <h1 style="text-align: center;">Find or edit a referee</h1>
@if (referee?.person) {
  <div class="fieldSet"></div>
  <div class="form-field" *ngIf="tournament?.allowPlayerReferees">
    <label for="playerTeam">Player referee?</label>
    <p-toggleswitch [(ngModel)]="referee!.isPR"/>
  </div>
  <div class="form-field" *ngIf="referee!.isPR">
    <label for="playerTeam">Team</label>
    <p-select id="team" size="small" [options]="teams"
      [(ngModel)]="referee!.team" class="longText"
      appendTo="body" placeholder="Team" (onChange)="teamSelected($event.value)">
      <ng-template let-team #item #selectedItem >
        <div class="flex items-center gap-2">
            <div>{{ team.divisionShortName }}/{{ team.shortName }}</div>
        </div>
      </ng-template>
    </p-select>
  </div>

  <div class="form-field" *ngIf="!referee!.isPR">
    <label for="playerTeam">Search a person:</label>
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

  <div class="fieldSet" *ngIf="!referee!.isPR"></div>
  <p-fieldset legend="Person information" class="fieldSet" *ngIf="!referee!.isPR">
    <div class="form-field">
      <label for="firstName">First name</label>
      <input id="firstName" type="text" pInputText [(ngModel)]="referee!.person!.firstName"
      required minlength="2" maxlength="30" class="longText"/>
    </div>
    <div class="form-field">
      <label for="lastName">Last name</label>
      <input id="lastName" type="text" pInputText [(ngModel)]="referee!.person!.lastName" required minlength="2" maxlength="30" class="longText"/>
    </div>
    <div class="form-field">
      <label for="shortName">Short name</label>
      <input id="shortName" type="text" pInputText [(ngModel)]="referee!.person!.shortName" required maxlength="6" minlength="3" style="width: 5rem;" />
    </div>
    <div class="form-field">
      <label for="country">Country</label>
      <p-select id="country" size="small" [options]="countries" optionLabel="name"
        [(ngModel)]="refereeCountry" [editable]="true" class="longText"
        appendTo="body" (onChange)="countrySelected($event.value)" required>
        <ng-template let-country #item>{{ country.name }}</ng-template>
        <ng-template let-country #selectedItem>{{ country.name }}</ng-template>
        <ng-template #dropdownicon><i class="pi pi-map"></i></ng-template>
      </p-select>
    </div>
    <div class="form-field">
      <label for="gender">Gender</label>
      <p-select id="gender" size="small" [options]="genders" [(ngModel)]="referee!.person!.gender" appendTo="body" required/>
    </div>
    <div class="form-field">
      <label for="email">Email</label>
      <input id="email" type="email" pInputText [(ngModel)]="referee!.person!.email" class="longText" maxlength="50"/>
    </div>
    <div class="form-field">
      <label for="phone">Phone</label>
      <input id="phone" type="phone" pInputText [(ngModel)]="referee!.person!.phone"/>
    </div>
  </p-fieldset>

  <div class="fieldSet" *ngIf="!referee!.isPR"></div>
  <p-fieldset legend="Referee information" *ngIf="!referee!.isPR">
    <div class="form-field">
      <label for="refereeBadgeSystem">Badge System</label>
      <input id="refereeBadgeSystem" type="number" pInputText
        [(ngModel)]="referee!.attendee!.referee!.badgeSystem"
        min="3" max="6" style="width: 2rem;" (change)="adjustUpgrade()"/>
        <span>levels</span>
      <span class="inputInfo" *ngIf="refereeCountry!.badgeSystem! > 0">Country badge system: {{refereeCountry!.badgeSystem}}</span>
    </div>
    <div class="form-field">
      <label for="refereeBadge">Badge Level</label>
      <input id="refereeBadge" type="number" pInputText
        [(ngModel)]="referee!.attendee!.referee!.badge" (change)="adjustUpgrade()"
        min="0" max="{{referee!.attendee!.referee!.badgeSystem}}" style="width: 2rem;"/>
    </div>
    <div class="form-field">
      <label for="refereeCategory">Category</label>
      <p-select id="refereeCategory" size="small" [options]="refereeCategories"
        [(ngModel)]="referee!.attendee!.referee!.category" appendTo="body" required/>
    </div>
    <div class="form-field" *ngIf="referee!.attendee!.referee!.badge < referee!.attendee!.referee!.badgeSystem">
      <label for="refereeBadge">Upgrade?</label>
      <span style="vertical-align: middle;">
        <p-toggleswitch [(ngModel)]="refereeUpgrade" (onChange)="onUpgradeChange()"/>
      </span>
      <span style="vertical-align: middle; margin: 0 5px;" *ngIf="refereeUpgrade">to</span>
      <input id="refereeBadge" type="number" pInputText
        [(ngModel)]="referee!.attendee!.referee!.upgrade!.badge"
        min="0" max="{{referee!.attendee!.referee!.upgrade!.badgeSystem}}"
        style="margin-left: 5px; width: 2rem;"
        *ngIf="refereeUpgrade"/>
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
export class TournamentRefereeEditComponent implements OnInit{
  regionService = inject(RegionService);
  modalController = inject(ModalController);
  personService = inject(PersonService);

  @Input() referee: Referee|undefined;
  refereeCountry : Country | undefined = undefined;
  readonly genders: Gender[] = ['M', 'F'];
  countries = this.regionService.countries;
  readonly refereeCategories : RefereeCategory[] = ['J', 'O', 'S', 'M'];
  refereeUpgrade: boolean = false;
  @Input() teams : TeamDivision[] = []
  @Input() tournament : Tournament|undefined = undefined;
  existingStr: string = '';
  existingPersons: Person[] = [];

  ngOnInit(): void {
    if (this.referee && this.referee.person && this.referee.person.countryId) {
      this.refereeCountry = this.regionService.countryById(this.referee!.person!.countryId);
      console.log(this.refereeCountry);
      this.computeRefereeUpgrade();
    }
  }

  private computeRefereeUpgrade() {
    if (!this.referee || !this.referee.attendee || !this.referee.attendee.referee) return;
    this.refereeUpgrade = this.referee.attendee.referee.upgrade.badge === 0
      || this.referee.attendee.referee.badge === this.referee.attendee.referee.badgeSystem;

  }
  countrySelected(country: Country) {
    console.log('Selected country',country)
    this.referee!.person!.countryId = country.id;
    this.referee!.person!.regionId = this.regionService.regionByCountryId(country.id)!.id;
  }
  teamSelected(team: Team) {
    // update the referee with the selected team
    this.referee!.team = team;
    if (this.referee!.attendee.player) {
      this.referee!.attendee.player.teamId;
    } else {
      this.referee!.attendee.player = { teamId: team.id, num: -1 };
    }
  }
  searchExisting() {
    console.log('search person with keyword', this.existingStr);
    this.personService.search({keyword: this.existingStr}).subscribe(persons => {
      this.existingPersons = persons;
    });
  }
  onSelectPerson(person: Person) {
    console.log('onSelectPerson', person);
    this.referee!.person = person;
    this.referee!.attendee.personId = person.id;
    if (person.referee) this.referee!.attendee!.referee = person.referee
    if (person.refereeCoach) this.referee!.attendee!.refereeCoach = person.refereeCoach
  }
  personToLabel(person:any): string {
    const country = this.regionService.countryById(person.countryId)
    return person.firstName + ' ' + person.lastName + (country ? ' ('+country.shortName+')' : '');
  }
  adjustUpgrade() {
    if (this.referee!.attendee.referee!.badge > this.referee!.attendee.referee!.badgeSystem) {
      this.referee!.attendee.referee!.badge = this.referee!.attendee.referee!.badgeSystem
    }
    if (this.referee!.attendee.referee?.badge === this.referee!.attendee.referee?.badgeSystem) {
      this.refereeUpgrade = false;
      this.onUpgradeChange();
    }
    this.referee!.person!.referee = this.referee!.attendee.referee;
  }
  onUpgradeChange() {
    this.computeRefereeUpgrade();
    if (this.referee && this.referee.person) {
      this.referee.person.referee = this.referee.attendee.referee;
    }
  }
}
