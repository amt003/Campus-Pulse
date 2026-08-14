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
import { RecruiterApplicationsComponent } from './pages/recruiter/applications/applications';
import { OfferGeneratorComponent } from './pages/recruiter/offer-generator/offer-generator.component';
import { ProfileOnHoldComponent } from './pages/recruiter/profile-on-hold/profile-on-hold.component';
import { StudentLayoutComponent } from './pages/student/layout/layout.component';
import { StudentDashboardComponent } from './pages/student/dashboard/dashboard';
import { StudentApplicationsComponent } from './pages/student/applications/applications';
import { StudentSchedulesComponent } from './pages/student/schedules/schedules';
import { StudentOffersComponent } from './pages/student/offers/offers';
import { StudentProfileComponent } from './pages/student/profile/profile';
import { TermsComponent } from './pages/terms/terms.component';
import { PrivacyComponent } from './pages/privacy/privacy.component';
import { roleAuthGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: 'recruiter/edit-profile',
    component: ProfileOnHoldComponent,
    canActivate: [roleAuthGuard],
    data: { roles: ['recruiter'] },
  },
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
    path: 'terms',
    component: TermsComponent,
  },
  {
    path: 'privacy',
    component: PrivacyComponent,
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
      {
        path: 'applications/:driveId',
        component: RecruiterApplicationsComponent,
      },
      {
        path: 'offer/:applicationId',
        component: OfferGeneratorComponent,
      },
    ],
  },
  {
    path: 'student',
    component: StudentLayoutComponent,
    canActivate: [roleAuthGuard],
    data: { roles: ['student'] },
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        path: 'dashboard',
        component: StudentDashboardComponent,
      },
      {
        path: 'applications',
        component: StudentApplicationsComponent,
      },
      {
        path: 'schedules',
        component: StudentSchedulesComponent,
      },
      {
        path: 'offers',
        component: StudentOffersComponent,
      },
      {
        path: 'offer/:applicationId',
        component: StudentOffersComponent,
      },
      {
        path: 'profile',
        component: StudentProfileComponent,
      },
    ],
  },
];


