import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StudentService, Application } from '../../../services/student.service';

@Component({
  selector: 'app-student-applications',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './applications.html',
  styleUrl: './applications.css'
})
export class StudentApplicationsComponent implements OnInit {
  private readonly studentService = inject(StudentService);
  protected applications = signal<Application[]>([]);
  protected isLoading = signal<boolean>(true);

  // Master-Detail Navigation State
  protected selectedApp = signal<Application | null>(null);
  protected selectedSchedules = signal<any[]>([]);

  // XAI Modal States
  protected selectedXaiApp = signal<any | null>(null);
  protected isXaiModalOpen = signal<boolean>(false);
  protected Math = Math;

  protected isTodayOrPast(dateInput: string | Date | undefined): boolean {
    if (!dateInput) return false;
    const testDate = new Date(dateInput);
    testDate.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return testDate.getTime() <= today.getTime();
  }

  ngOnInit(): void {
    this.loadApplications();
  }

  protected loadApplications(): void {
    this.isLoading.set(true);
    this.studentService.getApplications().subscribe({
      next: (res) => {
        const apps = res.applications || [];
        this.applications.set(apps);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load applications:', err);
        this.isLoading.set(false);
      }
    });
  }

  protected selectApplication(app: Application): void {
    this.isLoading.set(true);
    this.studentService.getApplicationDetails(app._id).subscribe({
      next: (res) => {
        this.selectedApp.set(res.application);
        this.selectedSchedules.set(res.schedules || []);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load application details:', err);
        // Fallback to local copy
        this.selectedApp.set(app);
        this.selectedSchedules.set([]);
        this.isLoading.set(false);
      }
    });
  }

  protected clearSelection(): void {
    this.selectedApp.set(null);
    this.selectedSchedules.set([]);
  }

  protected getCTCInLpa(ctcInRupees: number): string {
    if (!ctcInRupees) return '—';
    const lpa = ctcInRupees / 100000;
    return lpa.toFixed(1) + ' LPA';
  }

  protected getScoreColorClass(score: number | null | undefined): string {
    if (score === null || score === undefined) return 'score-gray';
    const percent = score <= 1.0 ? score * 100 : score;
    if (percent >= 80) return 'score-green';
    if (percent >= 60) return 'score-yellow';
    return 'score-red';
  }

  protected formatMatchScore(score: number | null | undefined): string {
    if (score === null || score === undefined) return '0.0';
    const val = score <= 1.0 ? score * 100 : score;
    return val.toFixed(1);
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

  protected getTimelineSteps(app: Application): any[] {
    const steps = [];

    // Step 1: Applied
    steps.push({
      label: 'Applied',
      completed: true,
      current: app.status === 'Applied'
    });

    // Step 2: Aptitude
    if (app.driveId?.hasAptitudeTest) {
      const hasPassed = app.aptitude?.status === 'Passed' || app.aptitude?.status === 'Completed';
      steps.push({
        label: 'Aptitude',
        completed: hasPassed,
        current: app.status === 'Aptitude Scheduled'
      });
    }

    // Step 3: GD
    if (app.driveId?.hasGD) {
      const hasPassed = app.gd?.status === 'Shortlisted' || app.gd?.status === 'Completed';
      steps.push({
        label: 'GD',
        completed: hasPassed,
        current: app.status === 'GD Scheduled'
      });
    }

    // Step 4: Interview
    const hasPassedInterview = app.interview?.result === 'Selected';
    steps.push({
      label: 'Interview',
      completed: hasPassedInterview,
      current: app.status === 'Interview Scheduled' || app.status === 'Interview Completed'
    });

    // Step 5: Offer
    const isPlaced = app.status === 'Placed' || app.status === 'Selected' || app.offer?.status === 'Accepted';
    steps.push({
      label: 'Offer',
      completed: isPlaced,
      current: app.offer?.status === 'Sent'
    });

    return steps;
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

  protected downloadScheduleICS(s: any, drive?: any): void {
    const companyName = drive?.companyName || s.companyName || 'Campus Recruiter';
    const driveTitle = drive?.title || s.driveTitle || 'Placement Drive';
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

  protected addToGoogleCalendar(s: any, drive?: any): void {
    const companyName = drive?.companyName || s.companyName || 'Campus Recruiter';
    const driveTitle = drive?.title || s.driveTitle || 'Placement Drive';
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

  protected handleContactPlacement(): void {
    alert('Connecting to Campus Placement Officer via Chat... 💬');
  }
}
