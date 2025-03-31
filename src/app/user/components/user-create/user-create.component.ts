import { UserService } from 'src/app/shared/services/user.service';
import { from, map, mergeMap, Observable } from 'rxjs';
import { RegionService } from 'src/app/shared/services/region.service';
import { Component, inject, OnInit } from '@angular/core';
import { Country, Person, Region } from 'src/app/shared/data.model';
import { Auth, createUserWithEmailAndPassword, UserCredential } from '@angular/fire/auth';
import { PersonService } from 'src/app/shared/services/person.service';

@Component({
  standalone: false,
  selector: 'app-user-create',
  templateUrl: './user-create.component.html',
  styleUrls: ['./user-create.component.scss'],
})
export class UserCreateComponent  implements OnInit {

  regionService = inject(RegionService);

  user?: Person;
  password: string= '';
  regions$: Observable<Region[]> = this.regionService.all();
  region?: Region;
  country?: Country;
  userService = inject(UserService);

  ngOnInit(): void {
    this.user = {
      id: '',
      countryId: '',
      email: '',
      firstName: '',
      lastName: '',
      lastChange: 0,
      regionId: '',
      shortName: '',
      userAuthId: '',
      gender: 'M',
    }
  }

  updateShortName() {
    //TODO
  }
  save() {
    if (!this.user || !this.user.firstName || !this.user.lastName  || !this.user.email || !this.password) {
      console.error('Champ(s) incomplet(s)');
      return;
    }
    this.userService.createUser(this.user, this.password).subscribe();
  }
}
