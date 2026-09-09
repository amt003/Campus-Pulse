import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TpoService, SeasonConfig } from '../../../services/tpo.service';
import { ToastService } from '../../../services/toast.service';

@Component({
  selector: 'app-tpo-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
})
export class TpoSettingsComponent implements OnInit {
  private readonly tpoService = inject(TpoService);
  private readonly toastService = inject(ToastService);

  // Form Signals
  protected seasonStart = signal<string>('');
  protected seasonEnd = signal<string>('');

  // Status Signals
  protected isLoading = signal<boolean>(true);
  protected isSaving = signal<boolean>(false);
  protected isRefreshing = signal<boolean>(false);
  protected configData = signal<SeasonConfig | null>(null);
  protected errorMessage = signal<string | null>(null);
  protected successMessage = signal<string | null>(null);

  // Computed validation state for live feedback
  protected hasDatesConfigured = computed(() => {
    return Boolean(this.seasonStart().trim() && this.seasonEnd().trim());
  });

  protected isDateOrderValid = computed(() => {
    if (!this.seasonStart() || !this.seasonEnd()) return true;
    return new Date(this.seasonStart()) <= new Date(this.seasonEnd());
  });

  protected liveValidationMessage = computed(() => {
    const start = this.seasonStart().trim();
    const end = this.seasonEnd().trim();

    if (!start && !end) {
      return { status: 'incomplete', type: 'warning', text: 'Select both Season Start Date and Season End Date to set the placement window.' };
    }
    if (!start) {
      return { status: 'missing-start', type: 'error', text: 'Season Start Date is required.' };
    }
    if (!end) {
      return { status: 'missing-end', type: 'error', text: 'Season End Date is required.' };
    }

    const startDate = new Date(start);
    const endDate = new Date(end);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return { status: 'invalid-format', type: 'error', text: 'Invalid date format selected.' };
    }

    if (startDate > endDate) {
      return { status: 'invalid-range', type: 'error', text: 'Season Start Date cannot be after Season End Date.' };
    }

    const duration = this.durationDays();
    if (duration !== null) {
      if (duration < 180) {
        return { status: 'duration-too-short', type: 'error', text: `Season duration must be at least 6 months (minimum 180 days). Current duration is only ${duration} days.` };
      }
      if (duration > 366) {
        return { status: 'duration-too-long', type: 'error', text: `Season duration cannot exceed 1 year (maximum 365 days). Current duration is ${duration} days.` };
      }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (endDate < today) {
      return { status: 'past-end', type: 'warning', text: 'Warning: The selected Season End Date is in the past.' };
    }

    return {
      status: 'valid',
      type: 'success',
      text: `✓ Date range is valid (${duration} days). Drives and events will be constrained to this window.`
    };
  });

  protected durationDays = computed(() => {
    if (!this.seasonStart() || !this.seasonEnd()) return null;
    const start = new Date(this.seasonStart());
    const end = new Date(this.seasonEnd());
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return null;
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  });

  protected isSeasonActiveNow = computed(() => {
    if (!this.seasonStart() || !this.seasonEnd()) return false;
    const now = new Date();
    const start = new Date(this.seasonStart());
    const end = new Date(this.seasonEnd());
    // Normalize to start and end of day
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return now >= start && now <= end;
  });

  ngOnInit(): void {
    this.fetchSeasonConfiguration();
  }

  protected fetchSeasonConfiguration(isInitial = true): void {
    if (isInitial) this.isLoading.set(true);
    this.isRefreshing.set(true);
    this.errorMessage.set(null);

    this.tpoService.getSeasonConfig().subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.isRefreshing.set(false);
        if (res && res.data) {
          this.configData.set(res.data);
          this.populateDates(res.data);
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        this.isRefreshing.set(false);
        const errText = err?.error?.message || 'Failed to fetch season configuration';
        this.errorMessage.set(errText);
        this.toastService.error('Error', errText);
      },
    });
  }

  private populateDates(config: SeasonConfig): void {
    if (config.seasonStart) {
      this.seasonStart.set(this.formatDateForInput(config.seasonStart));
    }
    if (config.seasonEnd) {
      this.seasonEnd.set(this.formatDateForInput(config.seasonEnd));
    }
  }

  private formatDateForInput(dateVal: string | Date): string {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  protected isDurationValid = computed(() => {
    const duration = this.durationDays();
    if (duration === null) return false;
    return duration >= 180 && duration <= 366;
  });

  protected setPreset(presetType: 'fall' | 'spring' | 'fullYear'): void {
    const currentYear = new Date().getFullYear();
    if (presetType === 'fall') {
      this.seasonStart.set(`${currentYear}-08-01`);
      this.seasonEnd.set(`${currentYear + 1}-01-31`); // 6 months
    } else if (presetType === 'spring') {
      this.seasonStart.set(`${currentYear}-01-01`);
      this.seasonEnd.set(`${currentYear}-06-30`); // 6 months
    } else if (presetType === 'fullYear') {
      this.seasonStart.set(`${currentYear}-08-01`);
      this.seasonEnd.set(`${currentYear + 1}-07-31`); // 12 months
    }
    this.errorMessage.set(null);
    this.successMessage.set(null);
  }

  protected clearDates(): void {
    this.seasonStart.set('');
    this.seasonEnd.set('');
    this.errorMessage.set(null);
    this.successMessage.set(null);
  }

  protected saveConfiguration(): void {
    const start = this.seasonStart().trim();
    const end = this.seasonEnd().trim();

    if (!start || !end) {
      this.errorMessage.set('Both Season Start Date and Season End Date must be selected.');
      this.toastService.warning('Validation Warning', 'Please select both start and end dates.');
      return;
    }

    const startDate = new Date(start);
    const endDate = new Date(end);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      this.errorMessage.set('Invalid date selected. Please select valid dates.');
      this.toastService.error('Validation Error', 'Invalid date format selected.');
      return;
    }

    if (startDate > endDate) {
      this.errorMessage.set('Season Start Date cannot be after Season End Date.');
      this.toastService.error('Validation Error', 'Start date must be before or equal to end date.');
      return;
    }

    const duration = this.durationDays();
    if (duration !== null && (duration < 180 || duration > 366)) {
      const errMsg = duration < 180
        ? 'Season duration must be at least 6 months (minimum 180 days).'
        : 'Season duration cannot exceed 1 year (maximum 365 days).';
      this.errorMessage.set(errMsg);
      this.toastService.error('Validation Error', errMsg);
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.tpoService.updateSeasonConfig({ seasonStart: start, seasonEnd: end }).subscribe({
      next: (res) => {
        this.isSaving.set(false);
        this.configData.set(res.data);
        const msg = res.message || 'Placement season configuration saved successfully!';
        this.successMessage.set(msg);
        this.toastService.success('Configuration Saved 💾', msg);
      },
      error: (err) => {
        this.isSaving.set(false);
        const errText = err?.error?.message || 'Failed to save configuration. Please try again.';
        this.errorMessage.set(errText);
        this.toastService.error('Save Failed', errText);
      },
    });
  }
}
