import { Routes } from '@angular/router';
import { LandingPage } from './pages/landing-page/landing-page';
import { LoginPage } from './pages/login-page/login-page';
import { RegisterPage } from './pages/register-page/register-page';
import { TpoLayoutComponent } from './pages/tpo/layout/layout.component';
import { TpoDashboardComponent } from './pages/tpo/dashboard/dashboard';
import { TpoApprovalComponent } from './pages/tpo/approval/approval.component';
import { TpoStudentsComponent } from './pages/tpo/students/students.component';
import { TpoDriveApprovalComponent } from './pages/tpo/drive-approval/drive-approval.component';
import { TpoCollegeConfigComponent } from './pages/tpo/college-config/college-config.component';
import { TpoSettingsComponent } from './pages/tpo/settings/settings.component';
import { TpoOverseeDrivesComponent } from './pages/tpo/oversee-drives/oversee-drives.component';
import { TpoDriveXrayComponent } from './pages/tpo/drive-xray/drive-xray.component';
import { TpoCalendarComponent } from './pages/tpo/calendar/calendar.component';
import { TpoAnalyzerComponent } from './pages/tpo/analyzer/analyzer.component';
import { StudentReadinessComponent } from './pages/student/readiness/readiness.component';
import { RecruiterDashboardComponent } from './pages/recruiter/dashboard/dashboard';
import { RecruiterLayoutComponent } from './pages/recruiter/layout/layout.component';
import { RecruiterProfileComponent } from './pages/recruiter/profile/profile';
import { RecruiterApplicationsComponent } from './pages/recruiter/applications/applications';
import { OfferGeneratorComponent } from './pages/recruiter/offer-generator/offer-generator.component';
import { ProfileOnHoldComponent } from './pages/recruiter/profile-on-hold/profile-on-hold.component';
import { RecruiterDrivesComponent } from './pages/recruiter/drives/drives';
import { RecruiterAllApplicationsComponent } from './pages/recruiter/all-applications/all-applications';
import { RecruiterOffersComponent } from './pages/recruiter/offers/offers';
import { StudentLayoutComponent } from './pages/student/layout/layout.component';
import { StudentDashboardComponent } from './pages/student/dashboard/dashboard';
import { StudentApplicationsComponent } from './pages/student/applications/applications';
import { StudentSchedulesComponent } from './pages/student/schedules/schedules';
import { StudentOffersComponent } from './pages/student/offers/offers';
import { StudentProfileComponent } from './pages/student/profile/profile';
import { TermsComponent } from './pages/terms/terms.component';
import { ForgotPasswordComponent } from './pages/auth/forgot-password/forgot-password.component';
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
    path: 'forgot-password',
    component: ForgotPasswordComponent,
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
        path: 'drive-approvals',
        component: TpoDriveApprovalComponent,
      },
      {
        path: 'students',
        component: TpoStudentsComponent,
      },
      {
        path: 'settings',
        component: TpoSettingsComponent,
      },
      {
        path: 'college-config',
        component: TpoCollegeConfigComponent,
      },
      {
        path: 'oversee-drives',
        component: TpoOverseeDrivesComponent,
      },
      {
        path: 'drive-xray/:driveId',
        component: TpoDriveXrayComponent,
      },
      {
        path: 'calendar',
        component: TpoCalendarComponent,
      },
      {
        path: 'analyzer',
        component: TpoAnalyzerComponent,
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
        path: 'drives',
        component: RecruiterDrivesComponent,
      },
      {
        path: 'all-applications',
        component: RecruiterAllApplicationsComponent,
      },
      {
        path: 'offers',
        component: RecruiterOffersComponent,
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
      {
        path: 'readiness',
        component: StudentReadinessComponent,
      },
    ],
  },
];


