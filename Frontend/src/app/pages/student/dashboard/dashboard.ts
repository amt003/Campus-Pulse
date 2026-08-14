import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { StudentService, StudentProfile, Drive, Application } from '../../../services/student.service';

import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-student-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
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
  protected isAlreadyPlaced = signal<boolean>(false);
  
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

  protected isScheduleCompleted(s: any, app: Application): boolean {
    if (!s) return false;
    if (s.status === 'Completed') return true;
    if (!app) return false;

    if (s.eventType === 'Aptitude') {
      if (app.aptitude?.status === 'Passed' || app.aptitude?.status === 'Failed' || (app.aptitude?.score !== null && app.aptitude?.score !== undefined)) {
        return true;
      }
      if (['Aptitude Completed', 'GD Scheduled', 'GD Completed', 'Interview Scheduled', 'Interview Completed', 'Selected', 'Placed', 'Offer Sent', 'Offer Accepted', 'Rejected'].includes(app.status)) {
        return true;
      }
    } else if (s.eventType === 'GD') {
      if (app.gd?.status === 'Shortlisted' || app.gd?.status === 'Rejected' || app.gd?.status === 'Completed' || (app.gd?.score !== null && app.gd?.score !== undefined)) {
        return true;
      }
      if (['GD Completed', 'Interview Scheduled', 'Interview Completed', 'Selected', 'Placed', 'Offer Sent', 'Offer Accepted', 'Rejected'].includes(app.status)) {
        return true;
      }
    } else if (s.eventType === 'Interview') {
      if (app.interview?.result === 'Selected' || app.interview?.result === 'Rejected' || app.interview?.result === 'Waitlisted' || app.interview?.status === 'Completed') {
        return true;
      }
      if (['Interview Completed', 'Selected', 'Placed', 'Offer Sent', 'Offer Accepted'].includes(app.status)) {
        return true;
      }
    }

    return false;
  }

  protected fetchDrivesAndApplications(): void {
    forkJoin({
      drives: this.studentService.getEligibleDrives().pipe(
        catchError(err => {
          if (err.status === 403) {
            this.isAlreadyPlaced.set(true);
          }
          return of({ drives: [], isForbidden: true });
        })
      ),
      apps: this.studentService.getApplications()
    }).subscribe({
      next: (result) => {
        this.allDrives.set(result.drives.drives || []);
        const apps = result.apps.applications || [];
        this.applications.set(apps);

        // Check if student has accepted an offer or has been marked Placed
        const hasPlacedApp = apps.some(app =>
          ['Placed', 'Offer Accepted'].includes(app.status) ||
          app.offer?.status === 'Accepted'
        );

        if (hasPlacedApp || (this.profile() as any)?.isPlaced) {
          this.isAlreadyPlaced.set(true);
          this.allDrives.set([]);
        }

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
              const today = new Date();
              today.setHours(0, 0, 0, 0);

              detailsList.forEach((details, index) => {
                const app = apps[index];
                const compName = details.application?.driveId?.companyName || (app.driveId as any)?.companyName || 'Placement Recruiter';
                const mapped = (details.schedules || []).map((s: any) => ({
                  ...s,
                  applicationId: app._id,
                  driveTitle: app.driveId?.title || 'Job Drive',
                  companyName: compName
                }));
                allSchedules = allSchedules.concat(mapped);
              });

              // Filter out finished / completed schedules or past date schedules for the Upcoming widget
              const activeUpcomingSchedules = allSchedules.filter((s: any) => {
                const schDate = new Date(s.date);
                schDate.setHours(0, 0, 0, 0);
                if (schDate.getTime() < today.getTime()) return false;

                const matchingApp = apps.find(a => a._id === s.applicationId);
                if (matchingApp && this.isScheduleCompleted(s, matchingApp)) return false;
                if (s.status === 'Completed' || s.status === 'Cancelled') return false;

                return true;
              });

              activeUpcomingSchedules.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
              this.schedules.set(activeUpcomingSchedules);
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

  protected isCardFlipped = signal<boolean>(false);

  protected selectActiveApplication(driveId: string): void {
    const app = this.applications().find(a => a.driveId?._id === driveId || (a.driveId as any) === driveId);
    if (app) {
      this.triggerCardFlip(app);
    }
  }

  protected onApplicationSelectChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const appId = target.value;
    const app = this.applications().find(a => a._id === appId);
    if (app) {
      this.triggerCardFlip(app);
    }
  }

  protected triggerCardFlip(app: any): void {
    this.isCardFlipped.set(true);
    setTimeout(() => {
      this.selectedApplication.set(app);
      this.isCardFlipped.set(false);
    }, 150);

    const el = document.getElementById('application-status-card');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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

  // Rich Real-time Stepper Journey helper
  protected getTimelineSteps(app: Application): any[] {
    if (!app) return [];

    const steps = [];
    const status = app.status;
    const hasAptitude = app.driveId?.hasAptitudeTest !== false;
    const hasGD = app.driveId?.hasGD !== false;

    // Step 1: Applied
    steps.push({
      key: 'applied',
      label: 'Applied',
      date: app.createdAt ? new Date(app.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) : '',
      completed: true,
      current: status === 'Applied' || status === 'Under Review',
      statusText: 'Application Received & Under Review'
    });

    // Step 2: Aptitude Test (if applicable)
    if (hasAptitude) {
      const isPassed = app.aptitude?.status === 'Passed' || app.aptitude?.status === 'Completed';
      const isFailed = app.aptitude?.status === 'Failed' || (status === 'Rejected' && app.aptitude?.status === 'Failed');
      const isScheduled = status === 'Aptitude Scheduled';
      const isCompleted = isPassed || ['Aptitude Completed', 'GD Scheduled', 'GD Completed', 'Interview Scheduled', 'Interview Completed', 'Selected', 'Placed', 'Offer Sent', 'Offer Accepted'].includes(status);

      let statusText = 'Pending Schedule';
      if (isCompleted || isPassed) {
        statusText = app.aptitude?.score !== null && app.aptitude?.score !== undefined 
          ? `Score: ${app.aptitude.score} pts (Passed Cutoff)` 
          : 'Aptitude Test Passed ✓';
      } else if (isFailed) {
        statusText = app.aptitude?.score !== null && app.aptitude?.score !== undefined 
          ? `Score: ${app.aptitude.score} pts (Below Cutoff)` 
          : 'Did Not Clear Aptitude';
      } else if (isScheduled) {
        statusText = 'Aptitude Round Scheduled';
      }

      steps.push({
        key: 'aptitude',
        label: 'Aptitude Test',
        date: app.aptitude?.markedAt ? new Date(app.aptitude.markedAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) : '',
        completed: isCompleted,
        current: isScheduled,
        rejected: isFailed,
        statusText,
        score: app.aptitude?.score,
        feedback: app.aptitude?.feedback
      });
    }

    // Step 3: Group Discussion (if applicable)
    if (hasGD) {
      const isPassed = app.gd?.status === 'Shortlisted' || app.gd?.status === 'Completed';
      const isFailed = app.gd?.status === 'Rejected';
      const isScheduled = status === 'GD Scheduled';
      const isCompleted = isPassed || ['GD Completed', 'Interview Scheduled', 'Interview Completed', 'Selected', 'Placed', 'Offer Sent', 'Offer Accepted'].includes(status);

      let statusText = 'Pending Schedule';
      if (isCompleted || isPassed) {
        statusText = app.gd?.score !== null && app.gd?.score !== undefined 
          ? `Score: ${app.gd.score} pts (Shortlisted)` 
          : 'GD Round Shortlisted ✓';
      } else if (isFailed) {
        statusText = 'Not Shortlisted in GD';
      } else if (isScheduled) {
        statusText = 'Group Discussion Scheduled';
      }

      steps.push({
        key: 'gd',
        label: 'Group Discussion',
        date: app.gd?.markedAt ? new Date(app.gd.markedAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) : '',
        completed: isCompleted,
        current: isScheduled,
        rejected: isFailed,
        statusText,
        score: app.gd?.score,
        feedback: app.gd?.feedback
      });
    }

    // Step 4: Technical & HR Interview
    const isInterviewPassed = app.interview?.result === 'Selected' || ['Selected', 'Placed', 'Offer Sent', 'Offer Accepted'].includes(status);
    const isInterviewFailed = app.interview?.result === 'Rejected' || (status === 'Rejected' && app.interview?.result === 'Rejected');
    const isInterviewScheduled = status === 'Interview Scheduled';
    const isInterviewCompleted = isInterviewPassed || status === 'Interview Completed';

    let intStatusText = 'Pending Schedule';
    if (isInterviewPassed) {
      intStatusText = 'Selected in Interview Round 🎉';
    } else if (isInterviewFailed) {
      intStatusText = 'Not Selected in Interview';
    } else if (isInterviewScheduled) {
      intStatusText = 'Interview Round Scheduled';
    } else if (status === 'Interview Completed') {
      intStatusText = 'Interview Completed — Awaiting Result';
    }

    steps.push({
      key: 'interview',
      label: 'Technical & HR Interview',
      date: app.interview?.markedAt ? new Date(app.interview.markedAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) : '',
      completed: isInterviewCompleted,
      current: isInterviewScheduled || status === 'Interview Completed',
      rejected: isInterviewFailed,
      statusText: intStatusText,
      score: app.interview?.score,
      feedback: app.interview?.feedback
    });

    // Step 5: Offer & Placement Selection
    const isPlaced = status === 'Placed' || status === 'Selected' || app.offer?.status === 'Accepted';
    const isOfferSent = status === 'Offer Sent' || app.offer?.status === 'Sent' || app.offer?.status === 'Viewed';

    let offerStatusText = 'Awaiting Final Results';
    if (isPlaced) {
      offerStatusText = 'Placed 🎉 (Offer Accepted)';
    } else if (isOfferSent) {
      offerStatusText = 'Official Offer Letter Sent! ✉️';
    } else if (app.offer?.status === 'Declined') {
      offerStatusText = 'Offer Declined';
    }

    steps.push({
      key: 'offer',
      label: 'Offer & Placement',
      date: app.offer?.acceptedAt ? new Date(app.offer.acceptedAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) : '',
      completed: isPlaced,
      current: isOfferSent,
      statusText: offerStatusText
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
