import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { SharedModule } from '../shared/shared.module';
import { FormsModule } from '@angular/forms';
import { UserLoginComponent } from './components/user-login/user-login.component';
import { UserCreateComponent } from './components/user-create/user-create.component';
import { UserRoutingModule } from './user-routing.module';

@NgModule({
  declarations: [UserLoginComponent, UserCreateComponent],
  imports: [ CommonModule, IonicModule, SharedModule, FormsModule, UserRoutingModule],
  exports: [UserLoginComponent, UserCreateComponent]
})
export class UserModule { }
