import { Routes } from '@angular/router';
import { LandingPage } from './pages/landing-page/landing-page';
import { LoginPage } from './pages/login-page/login-page';
import { RegisterPage } from './pages/register-page/register-page';
import { TpoLayoutComponent } from './pages/tpo/layout/layout.component';
import { TpoDashboardComponent } from './pages/tpo/dashboard/dashboard';
import { TpoApprovalComponent } from './pages/tpo/approval/approval.component';
import { TpoStudentsComponent } from './pages/tpo/students/students.component';
import { RecruiterDashboardComponent } from './pages/recruiter/dashboard/dashboard';
import { RecruiterLayoutComponent } from './pages/recruiter/layout/layout.component';
import { RecruiterProfileComponent } from './pages/recruiter/profile/profile';
import { StudentDashboardComponent } from './pages/student/dashboard/dashboard';
import { roleAuthGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    component: LandingPage,
  },
  {
    path: 'login',
    component: LoginPage,
  },
  {
    path: 'register',
    component: RegisterPage,
  },
  {
    path: 'tpo',
    component: TpoLayoutComponent,
    canActivate: [roleAuthGuard],
    data: { roles: ['tpo'] },
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        path: 'dashboard',
        component: TpoDashboardComponent,
      },
      {
        path: 'approval',
        component: TpoApprovalComponent,
      },
      {
        path: 'students',
        component: TpoStudentsComponent,
      },
    ],
  },
  {
    path: 'recruiter',
    component: RecruiterLayoutComponent,
    canActivate: [roleAuthGuard],
    data: { roles: ['recruiter'] },
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        path: 'dashboard',
        component: RecruiterDashboardComponent,
      },
      {
        path: 'profile',
        component: RecruiterProfileComponent,
      },
    ],
  },
  {
    path: 'student/dashboard',
    component: StudentDashboardComponent,
    canActivate: [roleAuthGuard],
    data: { roles: ['student'] },
  },
  {
    path: 'student',
    redirectTo: 'student/dashboard',
    pathMatch: 'full',
  },
];


