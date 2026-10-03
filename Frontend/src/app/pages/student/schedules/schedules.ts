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

  protected currentlyEvents = signal<any[]>([]);
  protected upcomingEvents = signal<any[]>([]);
  protected finishedEvents = signal<any[]>([]);
  
  protected isLoading = signal<boolean>(true);
  protected errorMessage = signal<string>('');
  protected isPlaced = signal<boolean>(false);
  protected placedCompany = signal<string>('');
  protected placedDriveTitle = signal<string>('');

  ngOnInit(): void {
    this.loadSchedule();
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

  protected loadSchedule(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.studentService.getSchedule().subscribe({
      next: (res) => {
        if (res && res.success) {
          if (res.isPlaced) {
            this.isPlaced.set(true);
            this.placedCompany.set(res.placedCompany || '');
            this.placedDriveTitle.set(res.placedDriveTitle || '');
          }

          if (res.data) {
            const data = res.data;
            const now = new Date();
            
            if (data.currently || data.finished) {
              const rawCurr = data.currently || [];
              const validCurr: any[] = [];
              const extraFinished: any[] = [];

              rawCurr.forEach((evt: any) => {
                const { end } = this.parseScheduleDates(evt.date, evt.timeSlot);
                if (now > end && evt.status !== 'Active') {
                  evt.status = evt.status === 'Completed' ? 'Completed' : 'Missed';
                  extraFinished.push(evt);
                } else {
                  validCurr.push(evt);
                }
              });

              this.currentlyEvents.set(validCurr);
              this.upcomingEvents.set(data.upcoming || []);
              this.finishedEvents.set([...(data.finished || data.past || []), ...extraFinished]);
            } else {
              // Client-side categorization fallback
              const allUpcoming = data.upcoming || [];
              const allPast = data.past || [];
              
              const curr: any[] = [];
              const up: any[] = [];
              const pastList: any[] = [...allPast];

              allUpcoming.forEach((evt: any) => {
                const { start, end } = this.parseScheduleDates(evt.date, evt.timeSlot);
                if (now > end) {
                  evt.status = evt.status === 'Completed' ? 'Completed' : 'Missed';
                  pastList.push(evt);
                } else if (now >= start && now <= end) {
                  curr.push(evt);
                } else {
                  up.push(evt);
                }
              });

              this.currentlyEvents.set(curr);
              this.upcomingEvents.set(up);
              this.finishedEvents.set(pastList);
            }
          }
        } else {
          this.currentlyEvents.set([]);
          this.upcomingEvents.set([]);
          this.finishedEvents.set([]);
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
