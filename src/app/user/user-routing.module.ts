import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { UserLoginComponent } from './components/user-login/user-login.component';
import { UserCreateComponent } from './components/user-create/user-create.component';

const routes: Routes = [
  { path: 'login',  component: UserLoginComponent , data: { title: 'Login' }},
  { path: 'create', component: UserCreateComponent, data: { title: 'Create an account' }}
];

@NgModule({
  declarations: [],
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class UserRoutingModule {}
