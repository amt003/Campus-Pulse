import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { 
  TpoService, 
  CalendarSlot, 
  CalendarStudent, 
  GroupedScheduleDay, 
  CalendarSummaryResponse 
} from '../../../services/tpo.service';
import { ToastService } from '../../../services/toast.service';
import { SmoothScrollService } from '../../../services/smooth-scroll.service';

@Component({
  selector: 'app-tpo-calendar',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './calendar.component.html',
  styleUrl: './calendar.component.css'
})
export class TpoCalendarComponent implements OnInit, OnDestroy {
  private readonly tpoService = inject(TpoService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);
  private readonly smoothScrollService = inject(SmoothScrollService);

  protected isLoading = signal<boolean>(true);
  protected isRefreshing = signal<boolean>(false);

  // Filter signals
  protected startDate = signal<string>('');
  protected endDate = signal<string>('');
  protected activePreset = signal<'7d' | '30d' | 'thisMonth' | 'all' | 'custom'>('30d');
  protected selectedEventType = signal<string>('All');
  protected selectedCompany = signal<string>('All');
  protected searchQuery = signal<string>('');

  // Data signals
  protected groupedSchedules = signal<GroupedScheduleDay[]>([]);
  protected totalSchedules = signal<number>(0);
  protected totalStudentsScheduled = signal<number>(0);
  protected summary = signal<CalendarSummaryResponse['summary'] | null>(null);

  // Student Modal state
  protected isStudentModalOpen = signal<boolean>(false);
  protected selectedSlot = signal<CalendarSlot | null>(null);
  protected selectedSlotDate = signal<string>('');
  protected studentModalSearch = signal<string>('');

  // Dropdown options
  protected eventTypeOptions = [
    { label: 'All Event Types', value: 'All' },
    { label: 'Aptitude Test', value: 'Aptitude' },
    { label: 'Group Discussion', value: 'GD' },
    { label: 'Interview', value: 'Interview' },
  ];

  // Computed companies list from currently loaded schedules
  protected availableCompanies = computed(() => {
    const companies = new Set<string>();
    this.groupedSchedules().forEach(day => {
      day.slots.forEach(slot => {
        if (slot.companyName) companies.add(slot.companyName);
      });
    });
    return Array.from(companies).sort();
  });

  // Filtered schedules according to search query
  protected filteredGroupedSchedules = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const groups = this.groupedSchedules();

    if (!query) return groups;

    return groups
      .map(day => {
        const matchingSlots = day.slots.filter(slot => 
          slot.companyName.toLowerCase().includes(query) ||
          slot.driveTitle.toLowerCase().includes(query) ||
          slot.location.toLowerCase().includes(query) ||
          slot.eventType.toLowerCase().includes(query) ||
          slot.timeSlot.toLowerCase().includes(query)
        );
        return {
          ...day,
          slots: matchingSlots
        };
      })
      .filter(day => day.slots.length > 0);
  });

  // Filtered students inside the roster modal
  protected filteredModalStudents = computed(() => {
    const slot = this.selectedSlot();
    if (!slot || !slot.students) return [];

    const search = this.studentModalSearch().toLowerCase().trim();
    if (!search) return slot.students;

    return slot.students.filter(s => 
      s.name.toLowerCase().includes(search) ||
      s.rollNumber.toLowerCase().includes(search) ||
      s.branch.toLowerCase().includes(search) ||
      s.email.toLowerCase().includes(search)
    );
  });

  ngOnInit(): void {
    // Default: Next 30 days
    this.initDefaultDates();
    this.fetchData();
  }

  ngOnDestroy(): void {
    this.smoothScrollService.unfreezeBackgroundScroll(true);
  }

  private initDefaultDates(): void {
    const today = new Date();
    const end = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    this.startDate.set(today.toISOString().split('T')[0]);
    this.endDate.set(end.toISOString().split('T')[0]);
  }

  protected fetchData(isInitial = true): void {
    if (isInitial) this.isLoading.set(true);
    this.isRefreshing.set(true);

    const sDate = this.startDate();
    const eDate = this.endDate();
    const evType = this.selectedEventType();
    const comp = this.selectedCompany();

    forkJoin({
      schedules: this.tpoService.getAllSchedules(sDate, eDate, evType, comp),
      summary: this.tpoService.getCalendarSummary()
    }).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.isRefreshing.set(false);
        if (res.schedules && res.schedules.data) {
          this.groupedSchedules.set(res.schedules.data.groupedSchedules || []);
          this.totalSchedules.set(res.schedules.data.totalSchedules || 0);
          this.totalStudentsScheduled.set(res.schedules.data.totalStudentsScheduled || 0);
        }
        if (res.summary && res.summary.summary) {
          this.summary.set(res.summary.summary);
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        this.isRefreshing.set(false);
        this.toastService.error('Failed to load Master Calendar', err.error?.message || 'Try again later');
      }
    });
  }

  protected onFilterChange(): void {
    this.fetchData(false);
  }

  protected onDateInputChange(): void {
    this.activePreset.set('custom');
    this.fetchData(false);
  }

  protected setPreset(preset: '7d' | '30d' | 'thisMonth' | 'all'): void {
    this.activePreset.set(preset);
    const today = new Date();
    if (preset === '7d') {
      const end = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
      this.startDate.set(today.toISOString().split('T')[0]);
      this.endDate.set(end.toISOString().split('T')[0]);
    } else if (preset === '30d') {
      const end = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
      this.startDate.set(today.toISOString().split('T')[0]);
      this.endDate.set(end.toISOString().split('T')[0]);
    } else if (preset === 'thisMonth') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      this.startDate.set(start.toISOString().split('T')[0]);
      this.endDate.set(end.toISOString().split('T')[0]);
    } else if (preset === 'all') {
      this.startDate.set('');
      this.endDate.set('');
    }
    this.fetchData(false);
  }

  protected resetFilters(): void {
    this.selectedEventType.set('All');
    this.selectedCompany.set('All');
    this.searchQuery.set('');
    this.activePreset.set('30d');
    this.initDefaultDates();
    this.fetchData(false);
  }

  // Student Roster Modal Handlers
  protected openStudentModal(slot: CalendarSlot, dateStr: string): void {
    this.selectedSlot.set(slot);
    this.selectedSlotDate.set(dateStr);
    this.studentModalSearch.set('');
    this.isStudentModalOpen.set(true);
    this.smoothScrollService.freezeBackgroundScroll();
  }

  protected closeStudentModal(): void {
    if (this.isStudentModalOpen()) {
      this.isStudentModalOpen.set(false);
      this.selectedSlot.set(null);
      this.studentModalSearch.set('');
      this.smoothScrollService.unfreezeBackgroundScroll();
    }
  }

  protected getRoundBadgeClass(eventType: string): string {
    const type = (eventType || '').toLowerCase();
    if (type.includes('apt')) return 'badge-aptitude';
    if (type.includes('gd') || type.includes('group')) return 'badge-gd';
    if (type.includes('inter')) return 'badge-interview';
    return 'badge-default';
  }

  protected getRoundTypeLabel(eventType: string): string {
    const type = (eventType || '').toLowerCase();
    if (type.includes('apt')) return 'Aptitude Test';
    if (type.includes('gd') || type.includes('group')) return 'Group Discussion (GD)';
    if (type.includes('inter')) return 'Personal Interview';
    return eventType || 'Scheduled Round';
  }

  // CSV Export Feature
  protected exportCSV(): void {
    const groups = this.filteredGroupedSchedules();
    if (!groups || groups.length === 0) {
      this.toastService.error('Export Error', 'No schedules available in current filtered view.');
      return;
    }

    const headers = [
      'Date',
      'Day of Week',
      'Time Slot',
      'Company Name',
      'Drive Title',
      'Round Type',
      'Location / Venue',
      'Total Students Scheduled'
    ];

    const rows: string[][] = [];

    groups.forEach(day => {
      day.slots.forEach(slot => {
        rows.push([
          `"${day.date}"`,
          `"${day.dayOfWeek}"`,
          `"${slot.timeSlot}"`,
          `"${slot.companyName}"`,
          `"${slot.driveTitle}"`,
          `"${slot.eventType}"`,
          `"${slot.location}"`,
          String(slot.studentCount)
        ]);
      });
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const dateStamp = new Date().toISOString().split('T')[0];
    link.setAttribute('href', url);
    link.setAttribute('download', `Master_Calendar_Schedules_${dateStamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    this.toastService.success('CSV Exported', `Exported ${rows.length} schedule slots.`);
  }
}
