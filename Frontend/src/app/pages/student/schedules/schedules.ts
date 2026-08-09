import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StudentService } from '../../../services/student.service';

@Component({
  selector: 'app-student-schedules',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './schedules.html',
  styleUrl: './schedules.css'
})
export class StudentSchedulesComponent implements OnInit {
  private readonly studentService = inject(StudentService);

  protected upcomingEvents = signal<any[]>([]);
  protected pastEvents = signal<any[]>([]);
  protected isLoading = signal<boolean>(true);
  protected errorMessage = signal<string>('');

  ngOnInit(): void {
    this.loadSchedule();
  }

  protected loadSchedule(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.studentService.getSchedule().subscribe({
      next: (res) => {
        if (res && res.success && res.data) {
          this.upcomingEvents.set(res.data.upcoming || []);
          this.pastEvents.set(res.data.past || []);
        } else {
          this.upcomingEvents.set([]);
          this.pastEvents.set([]);
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load student schedule:', err);
        this.errorMessage.set(err.error?.message || 'Failed to fetch schedule events.');
        this.isLoading.set(false);
      }
    });
  }

  protected getEventColor(eventType: string): string {
    switch (eventType) {
      case 'Aptitude':
        return '#2980B9'; // Blue
      case 'GD':
        return '#F39C12'; // Orange
      case 'Interview':
        return '#27AE60'; // Green
      default:
        return '#8E44AD'; // Purple fallback
    }
  }

  protected isTodayOrPast(dateInput: string | Date | undefined): boolean {
    if (!dateInput) return false;
    const testDate = new Date(dateInput);
    testDate.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return testDate.getTime() <= today.getTime();
  }

  protected downloadICS(event: any): void {
    const title = `${event.eventType} Round - ${event.drive?.companyName || event.companyName || 'Company'} (${event.drive?.title || event.driveTitle || 'Drive'})`;
    const description = `Placement Schedule Event: ${event.eventType}\\nLocation: ${event.location || 'Online'}`;
    const location = event.location || 'Online';
    const startDate = new Date(event.date);

    const year = startDate.getFullYear();
    const month = String(startDate.getMonth() + 1).padStart(2, '0');
    const day = String(startDate.getDate()).padStart(2, '0');

    const dtStart = `${year}${month}${day}T090000Z`;
    const dtEnd = `${year}${month}${day}T100000Z`;

    const icsData = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//CampusPulse//Placement Schedule//EN',
      'BEGIN:VEVENT',
      `SUMMARY:${title}`,
      `DESCRIPTION:${description}`,
      `LOCATION:${location}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', `${event.eventType}_Schedule.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
