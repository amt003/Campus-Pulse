import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { RecruiterService } from '../../../services/recruiter.service';
import { ToastService } from '../../../services/toast.service';

export interface QuestionBankItem {
  _id: string;
  questionText: string;
  options: string[];
  correctOption: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  category: 'Quantitative' | 'Logical' | 'Verbal' | 'Technical';
  source: 'manual' | 'ai_generated' | 'curated';
  status: string;
  timesUsed?: number;
}

export interface DriveOption {
  _id: string;
  title: string;
  status: string;
  hasAptitudeTest?: boolean;
}

@Component({
  selector: 'app-create-test',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './create-test.component.html',
  styleUrl: './create-test.component.css',
})
export class RecruiterCreateTestComponent implements OnInit {
  private readonly recruiterService = inject(RecruiterService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);

  // Stepper State (1, 2, 3)
  protected currentStep = signal<number>(1);
  protected isSubmitting = signal<boolean>(false);
  protected submissionError = signal<string | null>(null);

  // Drives data for Step 1
  protected drives = signal<DriveOption[]>([]);
  protected isLoadingDrives = signal<boolean>(false);

  // Step 1 Form Signals: Basic Info
  protected selectedDriveId = signal<string>('');
  protected testTitle = signal<string>('');
  protected durationMinutes = signal<number>(60);
  protected passingScore = signal<number>(70);
  protected scheduledDate = signal<string>('');
  protected scheduledTime = signal<string>('10:00');
  protected scheduledTimeSlot = computed(() => {
    const time = this.scheduledTime();
    if (!time) return '10:00 AM - 11:00 AM';
    const [hoursStr, minutesStr] = time.split(':');
    let hours = parseInt(hoursStr, 10);
    const minutes = minutesStr || '00';
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours % 12 || 12;
    const endHour = (hours + Math.ceil(this.durationMinutes() / 60)) % 12 || 12;
    const endAmpm = hours + Math.ceil(this.durationMinutes() / 60) >= 12 ? 'PM' : 'AM';
    return `${displayHour}:${minutes} ${ampm} - ${endHour}:${minutes} ${endAmpm}`;
  });

  // Step 2 Form Signals: Question Selection Mode
  protected generationMode = signal<'manual' | 'ai' | 'curated' | 'mixed'>('manual');
  protected allApprovedQuestions = signal<QuestionBankItem[]>([]);
  protected isLoadingQuestions = signal<boolean>(false);
  protected questionSearchTerm = signal<string>('');
  protected questionCategoryFilter = signal<string>('all');
  protected questionDifficultyFilter = signal<string>('all');

  // Selected Question IDs (Map or Set of question IDs)
  protected selectedQuestionIds = signal<string[]>([]);

  // Curated Mode category counts
  protected curatedCounts = signal<{
    quantitative: number;
    logical: number;
    verbal: number;
    technical: number;
  }>({
    quantitative: 5,
    logical: 5,
    verbal: 5,
    technical: 5,
  });
  protected isFetchingCurated = signal<boolean>(false);

  // Step 3 Form Signals: Configuration
  protected shuffleQuestions = signal<boolean>(true);
  protected shuffleOptions = signal<boolean>(true);
  protected antiCheatEnabled = signal<boolean>(true);
  protected maxViolations = signal<number>(3);

  // Computed helper for Step 2 question listing filtered by current mode
  protected filteredModeQuestions = computed(() => {
    let list = this.allApprovedQuestions();
    const mode = this.generationMode();

    if (mode === 'manual') {
      list = list.filter((q) => q.source === 'manual');
    } else if (mode === 'ai') {
      list = list.filter((q) => q.source === 'ai_generated');
    } else if (mode === 'curated') {
      list = list.filter((q) => q.source === 'curated');
    }

    const search = this.questionSearchTerm().toLowerCase().trim();
    if (search) {
      list = list.filter(
        (q) =>
          q.questionText.toLowerCase().includes(search) ||
          q.category.toLowerCase().includes(search)
      );
    }

    const cat = this.questionCategoryFilter();
    if (cat !== 'all') {
      list = list.filter((q) => q.category === cat);
    }

    const diff = this.questionDifficultyFilter();
    if (diff !== 'all') {
      list = list.filter((q) => q.difficulty === diff);
    }

    return list;
  });

  // Selected questions items details
  protected selectedQuestionsDetails = computed(() => {
    const ids = new Set(this.selectedQuestionIds());
    return this.allApprovedQuestions().filter((q) => ids.has(q._id));
  });

  // Category breakdown of selected questions
  protected selectedCategoryBreakdown = computed(() => {
    const items = this.selectedQuestionsDetails();
    const breakdown: Record<string, number> = {
      Quantitative: 0,
      Logical: 0,
      Verbal: 0,
      Technical: 0,
    };
    for (const q of items) {
      if (breakdown[q.category] !== undefined) {
        breakdown[q.category]++;
      }
    }
    return breakdown;
  });

  // Selected Drive details computed
  protected selectedDrive = computed(() => {
    return this.drives().find((d) => d._id === this.selectedDriveId()) || null;
  });

  ngOnInit(): void {
    // Set default scheduled date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    this.scheduledDate.set(tomorrow.toISOString().split('T')[0]);

    this.loadDrives();
    this.loadAllQuestions();
  }

  // Fetch drives
  protected loadDrives(): void {
    this.isLoadingDrives.set(true);
    this.recruiterService.getDrives().subscribe({
      next: (res) => {
        this.isLoadingDrives.set(false);
        const driveList: DriveOption[] = res.drives || res.data || [];
        this.drives.set(driveList);
        if (driveList.length > 0 && !this.selectedDriveId()) {
          this.selectedDriveId.set(driveList[0]._id);
          this.testTitle.set(`${driveList[0].title} - Aptitude Assessment`);
        }
      },
      error: (err) => {
        this.isLoadingDrives.set(false);
        this.toastService.error('Error', err.error?.message || 'Failed to load drives');
      },
    });
  }

  // Fetch all approved questions from Question Bank
  protected loadAllQuestions(): void {
    this.isLoadingQuestions.set(true);
    this.recruiterService.getQuestions().subscribe({
      next: (res) => {
        this.isLoadingQuestions.set(false);
        const questions: QuestionBankItem[] = res.questions || res.data || [];
        this.allApprovedQuestions.set(questions);
      },
      error: (err) => {
        this.isLoadingQuestions.set(false);
        this.toastService.error('Error', err.error?.message || 'Failed to load questions from Question Bank');
      },
    });
  }

  // Handle drive selection change
  protected onDriveChange(driveId: string): void {
    this.selectedDriveId.set(driveId);
    const drive = this.drives().find((d) => d._id === driveId);
    if (drive) {
      this.testTitle.set(`${drive.title} - Aptitude Assessment`);
    }
  }

  // Change generation mode
  protected setGenerationMode(mode: 'manual' | 'ai' | 'curated' | 'mixed'): void {
    this.generationMode.set(mode);
    // If switching to curated, sample automatically if empty
    if (mode === 'curated' && this.selectedQuestionIds().length === 0) {
      this.fetchFromCuratedBank();
    }
  }

  // Toggle individual question selection
  protected toggleQuestionSelection(id: string): void {
    const current = [...this.selectedQuestionIds()];
    const index = current.indexOf(id);
    if (index > -1) {
      current.splice(index, 1);
    } else {
      current.push(id);
    }
    this.selectedQuestionIds.set(current);
  }

  // Select all visible questions in current mode
  protected selectAllVisible(): void {
    const visibleIds = this.filteredModeQuestions().map((q) => q._id);
    const combined = Array.from(new Set([...this.selectedQuestionIds(), ...visibleIds]));
    this.selectedQuestionIds.set(combined);
  }

  // Deselect all
  protected clearAllSelected(): void {
    this.selectedQuestionIds.set([]);
  }

  // Curated Mode: Fetch random curated questions from pre-seeded bank
  protected fetchFromCuratedBank(): void {
    this.isFetchingCurated.set(true);
    const counts = this.curatedCounts();

    this.recruiterService.generateFromBank(counts).subscribe({
      next: (res) => {
        this.isFetchingCurated.set(false);
        const sampled: QuestionBankItem[] = res.questions || res.data || [];
        
        // Merge fetched curated questions with all questions if needed
        const existingMap = new Map(this.allApprovedQuestions().map((q) => [q._id, q]));
        for (const q of sampled) {
          existingMap.set(q._id, q);
        }
        this.allApprovedQuestions.set(Array.from(existingMap.values()));

        // Set selected IDs
        this.selectedQuestionIds.set(sampled.map((q) => q._id));
        this.toastService.success(
          'Curated Questions Sampled',
          `Loaded ${sampled.length} verified questions across requested categories`
        );
      },
      error: (err) => {
        this.isFetchingCurated.set(false);
        this.toastService.error('Curated Sampling Failed', err.error?.message || 'Could not fetch from curated bank');
      },
    });
  }

  // Step navigation validations
  protected goToStep(step: number): void {
    if (step === 2) {
      if (!this.validateStep1()) return;
    } else if (step === 3) {
      if (!this.validateStep1()) {
        this.currentStep.set(1);
        return;
      }
      if (!this.validateStep2()) return;
    }
    this.currentStep.set(step);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected validateStep1(): boolean {
    if (!this.selectedDriveId()) {
      this.toastService.warning('Validation', 'Please select a job drive');
      return false;
    }
    if (!this.testTitle().trim()) {
      this.toastService.warning('Validation', 'Please provide a test title');
      return false;
    }
    if (this.durationMinutes() < 1) {
      this.toastService.warning('Validation', 'Duration must be at least 1 minute');
      return false;
    }
    if (this.passingScore() < 0 || this.passingScore() > 100) {
      this.toastService.warning('Validation', 'Passing score must be between 0% and 100%');
      return false;
    }
    if (!this.scheduledDate()) {
      this.toastService.warning('Validation', 'Please select a scheduled date');
      return false;
    }
    return true;
  }

  protected validateStep2(): boolean {
    if (this.selectedQuestionIds().length === 0) {
      this.toastService.warning(
        'Question Selection Required',
        'Please select at least 1 question for this test'
      );
      return false;
    }
    return true;
  }

  // Build payload
  private buildPayload(): any {
    return {
      driveId: this.selectedDriveId(),
      title: this.testTitle().trim(),
      durationMinutes: Number(this.durationMinutes()),
      questionIds: this.selectedQuestionIds(),
      passingScore: Number(this.passingScore()),
      scheduledDate: this.scheduledDate(),
      timeSlot: this.scheduledTimeSlot(),
      generationMode: this.generationMode(),
      shuffleQuestions: this.shuffleQuestions(),
      shuffleOptions: this.shuffleOptions(),
      antiCheatEnabled: this.antiCheatEnabled(),
      maxViolations: Number(this.maxViolations()),
    };
  }

  // Action: Save as Draft
  protected saveAsDraft(): void {
    if (!this.validateStep1() || !this.validateStep2()) return;

    this.isSubmitting.set(true);
    this.submissionError.set(null);
    const payload = this.buildPayload();

    this.recruiterService.createTest(payload).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        this.toastService.success(
          'Test Saved as Draft',
          `"${this.testTitle()}" has been saved as a Draft`
        );
        this.router.navigate(['/recruiter/dashboard']);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        const errMsg = err.error?.message || 'Failed to save test as Draft';
        this.submissionError.set(errMsg);
        this.toastService.error('Creation Failed', errMsg);
      },
    });
  }

  // Action: Publish Test (create then publish)
  protected publishTest(): void {
    if (!this.validateStep1() || !this.validateStep2()) return;

    if (
      !confirm(
        `Are you sure you want to publish "${this.testTitle()}"? This will activate the test, schedule shortlisted candidates, and create calendar entries.`
      )
    ) {
      return;
    }

    this.isSubmitting.set(true);
    this.submissionError.set(null);
    const payload = this.buildPayload();

    // 1. Create Test in Draft status
    this.recruiterService.createTest(payload).subscribe({
      next: (createRes) => {
        const testId = createRes.test?._id || createRes.data?._id;
        if (!testId) {
          this.isSubmitting.set(false);
          this.toastService.error('Error', 'Test created but missing ID');
          return;
        }

        // 2. Publish Test
        this.recruiterService
          .publishTest(testId, {
            scheduledDate: this.scheduledDate(),
            timeSlot: this.scheduledTimeSlot(),
          })
          .subscribe({
            next: (pubRes) => {
              this.isSubmitting.set(false);
              const schedCount = pubRes.scheduledCount ?? pubRes.schedulesCreated ?? 0;
              this.toastService.success(
                'Test Published Successfully!',
                `Test is now Active. Scheduled for ${schedCount} eligible student(s).`
              );
              this.router.navigate(['/recruiter/dashboard']);
            },
            error: (pubErr) => {
              this.isSubmitting.set(false);
              const errMsg =
                pubErr.error?.message ||
                'Test was created as Draft, but publishing failed.';
              this.submissionError.set(errMsg);
              this.toastService.warning('Publishing Notice', errMsg);
              this.router.navigate(['/recruiter/dashboard']);
            },
          });
      },
      error: (err) => {
        this.isSubmitting.set(false);
        const errMsg = err.error?.message || 'Failed to create test';
        this.submissionError.set(errMsg);
        this.toastService.error('Creation Failed', errMsg);
      },
    });
  }
}
