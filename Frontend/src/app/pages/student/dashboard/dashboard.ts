import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';
import { StudentService, StudentProfile, Drive, Application } from '../../../services/student.service';

@Component({
  selector: 'app-student-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class StudentDashboardComponent implements OnInit {
  private readonly studentService = inject(StudentService);

  // States
  protected isLoading = signal<boolean>(true);
  protected profile = signal<StudentProfile | null>(null);
  protected allDrives = signal<Drive[]>([]);
  protected applications = signal<Application[]>([]);
  protected filterEligibleOnly = signal<boolean>(false);
  
  protected selectedApplication = signal<any | null>(null);
  protected schedules = signal<any[]>([]);
  protected isXaiModalOpen = signal<boolean>(false);
  protected selectedXaiApp = signal<any | null>(null);
  protected selectedDriveForJd = signal<Drive | null>(null);
  protected isJdModalOpen = signal<boolean>(false);
  protected Math = Math;

  protected isTodayOrPast(dateInput: string | Date | undefined): boolean {
    if (!dateInput) return false;
    const testDate = new Date(dateInput);
    testDate.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return testDate.getTime() <= today.getTime();
  }

  protected formatIcsDate(date: Date): string {
    const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
    return (
      date.getUTCFullYear() +
      pad(date.getUTCMonth() + 1) +
      pad(date.getUTCDate()) +
      'T' +
      pad(date.getUTCHours()) +
      pad(date.getUTCMinutes()) +
      pad(date.getUTCSeconds()) +
      'Z'
    );
  }

  protected parseScheduleDates(scheduleDate: string | Date, timeSlot?: string): { start: Date; end: Date } {
    const start = new Date(scheduleDate);
    const end = new Date(scheduleDate);

    if (timeSlot && timeSlot.includes('-')) {
      try {
        const [startTimeStr, endTimeStr] = timeSlot.split('-').map(t => t.trim());
        const parseTime = (baseDate: Date, timeStr: string): Date => {
          const d = new Date(baseDate);
          const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
          if (match) {
            let hours = parseInt(match[1], 10);
            const minutes = parseInt(match[2], 10);
            const ampm = match[3].toUpperCase();
            if (ampm === 'PM' && hours < 12) hours += 12;
            if (ampm === 'AM' && hours === 12) hours = 0;
            d.setHours(hours, minutes, 0, 0);
          }
          return d;
        };

        const parsedStart = parseTime(start, startTimeStr);
        const parsedEnd = parseTime(end, endTimeStr);
        return { start: parsedStart, end: parsedEnd };
      } catch (e) {
        // Fallback default
      }
    }

    start.setHours(10, 0, 0, 0);
    end.setHours(11, 0, 0, 0);
    return { start, end };
  }

  protected downloadScheduleICS(s: any): void {
    const companyName = s.companyName || 'Campus Recruiter';
    const driveTitle = s.driveTitle || 'Placement Drive';
    const eventType = s.eventType || 'Interview';
    const location = s.location || 'Online';
    const meetingUrl = s.meetingUrl ? `\\nMeeting Link: ${s.meetingUrl}` : '';

    const summary = `${eventType} Round - ${companyName} (${driveTitle})`;
    const description = `CampusPulse Placement Schedule\\nDrive: ${driveTitle}\\nCompany: ${companyName}\\nStage: ${eventType}${meetingUrl}`;

    const { start, end } = this.parseScheduleDates(s.date, s.timeSlot);

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//CampusPulse//Placement Engine//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      `LOCATION:${location}`,
      `DTSTART:${this.formatIcsDate(start)}`,
      `DTEND:${this.formatIcsDate(end)}`,
      `STATUS:CONFIRMED`,
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', `${companyName}_${eventType}_Schedule.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  protected addToGoogleCalendar(s: any): void {
    const companyName = s.companyName || 'Campus Recruiter';
    const driveTitle = s.driveTitle || 'Placement Drive';
    const eventType = s.eventType || 'Interview';
    const location = s.location || 'Online';
    const meetingUrl = s.meetingUrl ? `\nMeeting Link: ${s.meetingUrl}` : '';

    const summary = encodeURIComponent(`${eventType} Round - ${companyName} (${driveTitle})`);
    const details = encodeURIComponent(`CampusPulse Placement Schedule\nDrive: ${driveTitle}\nCompany: ${companyName}\nStage: ${eventType}${meetingUrl}`);
    const loc = encodeURIComponent(location);

    const { start, end } = this.parseScheduleDates(s.date, s.timeSlot);
    const dates = `${this.formatIcsDate(start)}/${this.formatIcsDate(end)}`;

    const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${summary}&dates=${dates}&details=${details}&location=${loc}`;
    window.open(googleCalendarUrl, '_blank');
  }

  // Computed Drive Filters
  protected filteredDrives = computed(() => {
    let list = this.allDrives();
    if (this.filterEligibleOnly()) {
      list = list.filter(d => this.isEligible(d));
    }
    return list;
  });

  ngOnInit(): void {
    this.loadDashboardData();
  }

  protected loadDashboardData(): void {
    this.isLoading.set(true);
    // Fetch profile first, then drives and applications
    this.studentService.getProfile().subscribe({
      next: (res) => {
        if (res && res.profile) {
          this.profile.set(res.profile);
          this.fetchDrivesAndApplications();
        } else {
          this.isLoading.set(false);
        }
      },
      error: (err) => {
        console.error('Failed to load student profile:', err);
        this.isLoading.set(false);
      }
    });
  }

  protected fetchDrivesAndApplications(): void {
    forkJoin({
      drives: this.studentService.getEligibleDrives(),
      apps: this.studentService.getApplications()
    }).subscribe({
      next: (result) => {
        this.allDrives.set(result.drives.drives || []);
        const apps = result.apps.applications || [];
        this.applications.set(apps);

        // Pre-select first application for timeline if available
        if (apps.length > 0) {
          this.selectedApplication.set(apps[0]);
        } else {
          this.selectedApplication.set(null);
        }

        // Fetch application schedules
        const appRequests = apps.map(app => this.studentService.getApplicationDetails(app._id));
        if (appRequests.length > 0) {
          forkJoin(appRequests).subscribe({
            next: (detailsList: any[]) => {
              let allSchedules: any[] = [];
              detailsList.forEach((details, index) => {
                const app = apps[index];
                const mapped = (details.schedules || []).map((s: any) => ({
                  ...s,
                  driveTitle: app.driveId?.title || 'Job Drive',
                  companyName: (app.driveId as any)?.companyName || 'Company'
                }));
                allSchedules = allSchedules.concat(mapped);
              });
              allSchedules.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
              this.schedules.set(allSchedules);
              this.isLoading.set(false);
            },
            error: (err) => {
              console.error('Failed to load application schedules:', err);
              this.isLoading.set(false);
            }
          });
        } else {
          this.schedules.set([]);
          this.isLoading.set(false);
        }
      },
      error: (err) => {
        console.error('Failed to fetch drives and applications:', err);
        this.isLoading.set(false);
      }
    });
  }

  // Drives Eligibility helpers
  protected isEligible(drive: Drive): boolean {
    const prof = this.profile();
    if (!prof) return false;
    if (prof.cgpa < drive.minCGPA) return false;
    if (prof.activeBacklogs > drive.maxBacklogs) return false;
    if (!drive.eligibleBranches.includes(prof.branch)) return false;
    return true;
  }

  protected hasApplied(driveId: string): boolean {
    return this.applications().some(app => app.driveId?._id === driveId);
  }

  protected toggleEligibilityFilter(): void {
    this.filterEligibleOnly.set(!this.filterEligibleOnly());
  }

  protected selectActiveApplication(driveId: string): void {
    const app = this.applications().find(a => a.driveId?._id === driveId);
    if (app) {
      this.selectedApplication.set(app);
    }
  }

  protected applyToDrive(driveId: string): void {
    const profileData = this.profile();
    if (!profileData || !profileData.resumePath) {
      alert('Please upload your resume in the "Profile & Resume" section before applying.');
      return;
    }

    this.studentService.applyToDrive(driveId).subscribe({
      next: () => {
        alert('Applied to drive successfully!');
        this.fetchDrivesAndApplications();
      },
      error: (err) => {
        alert(err.error?.message || 'Failed to submit application. Please try again.');
      }
    });
  }

  protected getCTCInLpa(ctcInRupees: number): string {
    if (!ctcInRupees) return '—';
    const lpa = ctcInRupees / 100000;
    return lpa.toFixed(1) + ' LPA';
  }

  protected scrollToDrives(): void {
    const el = document.getElementById('explore-drives-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  }

  // Stepper helper
  protected getTimelineSteps(app: Application): any[] {
    const steps = [];
    const hasAptitude = app.driveId?.hasAptitudeTest !== false; // Default to true if not explicitly false
    const hasGD = app.driveId?.hasGD !== false; // Default to true if not explicitly false

    // Map each status to a numeric progress level:
    // 0: Applied, Under Review
    // 1: Aptitude Scheduled
    // 2: Aptitude Completed
    // 3: GD Scheduled
    // 4: GD Completed
    // 5: Interview Scheduled
    // 6: Interview Completed
    // 7: Selected, Waitlisted, Offer Sent, Offer Accepted, Placed
    // -1: Rejected
    
    let currentLevel = 0;
    const status = app.status;

    if (status === 'Applied' || status === 'Under Review') currentLevel = 0;
    else if (status === 'Aptitude Scheduled') currentLevel = 1;
    else if (status === 'Aptitude Completed') currentLevel = 2;
    else if (status === 'GD Scheduled') currentLevel = 3;
    else if (status === 'GD Completed') currentLevel = 4;
    else if (status === 'Interview Scheduled') currentLevel = 5;
    else if (status === 'Interview Completed') currentLevel = 6;
    else if (['Selected', 'Placed', 'Offer Sent', 'Offer Accepted', 'Waitlisted'].includes(status)) currentLevel = 7;
    else if (status === 'Rejected') currentLevel = -1;

    // Step 1: Applied
    steps.push({
      label: 'Applied',
      date: app.createdAt ? new Date(app.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) : '',
      completed: true,
      current: currentLevel === 0
    });

    // Step 2: Aptitude Test (Conditional)
    if (hasAptitude) {
      steps.push({
        label: 'Aptitude Test',
        date: '',
        completed: currentLevel > 2,
        current: currentLevel === 1 || currentLevel === 2
      });
    }

    // Step 3: Group Discussion (Conditional)
    if (hasGD) {
      steps.push({
        label: 'Group Discussion',
        date: '',
        completed: currentLevel > 4,
        current: currentLevel === 3 || currentLevel === 4
      });
    }

    // Step 4: Technical Round
    steps.push({
      label: 'Technical Round',
      date: '',
      completed: currentLevel > 6,
      current: currentLevel === 5 || currentLevel === 6
    });

    // Step 5: Interview / Placement
    steps.push({
      label: 'Placement Selection',
      date: '',
      completed: currentLevel === 7,
      current: false
    });

    return steps;
  }

  // AI Fit Explanations
  protected formatMatchScore(score: number | null | undefined): string {
    if (score === null || score === undefined) return '0.0';
    const val = score <= 1.0 ? score * 100 : score;
    return val.toFixed(1);
  }

  protected getScoreColorClass(score: number | null | undefined): string {
    if (score === null || score === undefined) return 'score-gray';
    const percent = score <= 1.0 ? score * 100 : score;
    if (percent >= 80) return 'score-green';
    if (percent >= 60) return 'score-yellow';
    return 'score-red';
  }

  protected openXaiFeedback(app: any): void {
    if (!app) return;
    this.selectedXaiApp.set(app);
    this.isXaiModalOpen.set(true);
  }

  protected closeXaiModal(): void {
    this.selectedXaiApp.set(null);
    this.isXaiModalOpen.set(false);
  }

  protected openJdModal(drive: Drive): void {
    this.selectedDriveForJd.set(drive);
    this.isJdModalOpen.set(true);
  }

  protected closeJdModal(): void {
    this.selectedDriveForJd.set(null);
    this.isJdModalOpen.set(false);
  }
}
