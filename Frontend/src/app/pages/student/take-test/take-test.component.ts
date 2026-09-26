import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { StudentService } from '../../../services/student.service';
import { ToastService } from '../../../services/toast.service';

export interface TestQuestion {
  _id: string;
  questionText: string;
  category: string;
  difficulty: string;
  options: string[];
}

@Component({
  selector: 'app-take-test',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './take-test.component.html',
  styleUrl: './take-test.component.css',
})
export class StudentTakeTestComponent implements OnInit, OnDestroy {
  private readonly studentService = inject(StudentService);
  private readonly toastService = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  // Core Test Signals
  protected testId = signal<string>('');
  protected attemptId = signal<string>('');
  protected testTitle = signal<string>('Aptitude Assessment');
  protected questions = signal<TestQuestion[]>([]);
  protected currentIndex = signal<number>(0);
  protected answers = signal<(number | null)[]>([]);
  protected markedForReview = signal<boolean[]>([]);

  // Timer & Sync Signals
  protected timeRemainingSeconds = signal<number>(0);
  protected serverDeadlineMs = signal<number>(0);
  protected serverClockSkewMs = signal<number>(0);
  private timerInterval: any = null;
  private autoSaveInterval: any = null;

  // Anti-Cheat Signals
  protected antiCheatEnabled = signal<boolean>(true);
  protected violationCount = signal<number>(0);
  protected maxViolations = signal<number>(3);
  protected isFullscreenActive = signal<boolean>(false);
  protected showWarningDialog = signal<boolean>(false);
  protected warningMessage = signal<string>('');
  private lastViolationTime = 0;

  // UI State Signals
  protected isLoading = signal<boolean>(true);
  protected isSubmitting = signal<boolean>(false);
  protected isSaving = signal<boolean>(false);
  protected lastSavedTime = signal<Date | null>(null);
  protected showSubmitConfirmModal = signal<boolean>(false);

  // Formatted Timer String (HH:MM:SS or MM:SS)
  protected formattedTimer = computed(() => {
    const total = this.timeRemainingSeconds();
    if (total <= 0) return '00:00';
    const hrs = Math.floor(total / 3600);
    const mins = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    if (hrs > 0) {
      return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
  });

  // Current Question
  protected currentQuestion = computed(() => {
    const list = this.questions();
    const idx = this.currentIndex();
    return list[idx] || null;
  });

  // Summary Metrics
  protected answeredCount = computed(() => {
    return this.answers().filter((a) => a !== null && a !== undefined).length;
  });

  protected markedCount = computed(() => {
    return this.markedForReview().filter(Boolean).length;
  });

  protected unansweredCount = computed(() => {
    return this.questions().length - this.answeredCount();
  });

  // Anti-Cheat Listeners bound to component instance
  private onFullscreenChange = () => {
    if (!document.fullscreenElement) {
      this.isFullscreenActive.set(false);
      this.handleAntiCheatViolation(
        'fullscreen_exit',
        'Fullscreen mode exited. Please return to fullscreen immediately.'
      );
    } else {
      this.isFullscreenActive.set(true);
    }
  };

  private onVisibilityChange = () => {
    if (document.hidden) {
      this.handleAntiCheatViolation(
        'tab_switch',
        'Tab switch or background window detected. Stay on the assessment window.'
      );
    }
  };

  private onWindowBlur = () => {
    this.handleAntiCheatViolation(
      'window_blur',
      'Window focus lost. Please do not navigate away during the test.'
    );
  };

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('testId');
    if (!id) {
      this.toastService.error('Error', 'Invalid or missing test identifier');
      this.router.navigate(['/student/dashboard']);
      return;
    }
    this.testId.set(id);
    this.initializeTest(id);
  }

  ngOnDestroy(): void {
    this.teardownListenersAndTimers();
  }

  // Teardown helper
  private teardownListenersAndTimers(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }

    document.removeEventListener('fullscreenchange', this.onFullscreenChange);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    window.removeEventListener('blur', this.onWindowBlur);

    // Exit full-screen safely if active
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }

  // Request Fullscreen
  protected enterFullscreen(): void {
    try {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().then(() => {
          this.isFullscreenActive.set(true);
        }).catch((err) => {
          console.warn('[TakeTest] Fullscreen request rejected or blocked by browser:', err);
        });
      } else {
        this.isFullscreenActive.set(true);
      }
    } catch (e) {
      console.warn('[TakeTest] Fullscreen error:', e);
    }
  }

  // Initialize test and setup listeners
  private initializeTest(testId: string): void {
    this.isLoading.set(true);

    this.studentService.startTest(testId).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.attemptId.set(res.attemptId);
        this.antiCheatEnabled.set(Boolean(res.antiCheatEnabled));
        this.maxViolations.set(res.maxViolations || 3);
        this.violationCount.set(res.violationCount || 0);

        const loadedQuestions: TestQuestion[] = res.questions || [];
        this.questions.set(loadedQuestions);

        // Populate saved answers or empty array
        const initialAnswers: (number | null)[] =
          res.savedAnswers && res.savedAnswers.length === loadedQuestions.length
            ? res.savedAnswers
            : new Array(loadedQuestions.length).fill(null);
        this.answers.set(initialAnswers);
        this.markedForReview.set(new Array(loadedQuestions.length).fill(false));

        // Sync with server-provided deadline (not local clock)
        const deadlineDate = new Date(res.deadline).getTime();
        const serverDate = res.serverTime ? new Date(res.serverTime).getTime() : Date.now();
        const skew = Date.now() - serverDate;
        this.serverDeadlineMs.set(deadlineDate);
        this.serverClockSkewMs.set(skew);

        this.updateRemainingSeconds();

        // Enforce full-screen on user entry
        this.enterFullscreen();

        // Register anti-cheat listeners if enabled
        if (this.antiCheatEnabled()) {
          document.addEventListener('fullscreenchange', this.onFullscreenChange);
          document.addEventListener('visibilitychange', this.onVisibilityChange);
          window.addEventListener('blur', this.onWindowBlur);
        }

        // Setup timer ticker (every 1 second)
        this.timerInterval = setInterval(() => {
          this.updateRemainingSeconds();
        }, 1000);

        // Setup debounced auto-save (every 30 seconds)
        this.autoSaveInterval = setInterval(() => {
          this.triggerAutoSave();
        }, 30000);
      },
      error: (err) => {
        this.isLoading.set(false);
        const errMsg = err.error?.message || 'Failed to start test attempt';
        this.toastService.error('Assessment Error', errMsg);
        this.router.navigate(['/student/dashboard']);
      },
    });
  }

  // Update remaining seconds relative to server deadline
  private updateRemainingSeconds(): void {
    const deadline = this.serverDeadlineMs();
    if (!deadline) return;

    const syncedNow = Date.now() - this.serverClockSkewMs();
    const remainingMs = deadline - syncedNow;
    const remainingSec = Math.max(0, Math.floor(remainingMs / 1000));
    this.timeRemainingSeconds.set(remainingSec);

    if (remainingSec <= 0) {
      this.handleTimeExpiry();
    }
  }

  // Auto-submit on time expiry
  private handleTimeExpiry(): void {
    if (this.isSubmitting()) return;
    this.toastService.warning('Time Expired', 'Test time has ended. Submitting your answers now.');
    this.submitAssessment(true);
  }

  // Handle anti-cheat violation
  private handleAntiCheatViolation(eventType: string, message: string): void {
    if (!this.antiCheatEnabled() || this.isSubmitting() || this.isLoading()) return;

    const now = Date.now();
    // Throttle duplicate events within 1.5 seconds (e.g. blur followed immediately by visibilitychange)
    if (now - this.lastViolationTime < 1500) {
      return;
    }
    this.lastViolationTime = now;

    const attId = this.attemptId();
    if (!attId) return;

    this.studentService.logViolation(attId, eventType, message).subscribe({
      next: (res) => {
        const vCount = res.violationCount ?? (this.violationCount() + 1);
        this.violationCount.set(vCount);

        if (res.autoSubmitted) {
          this.isSubmitting.set(true);
          this.teardownListenersAndTimers();
          this.toastService.error(
            'Test Disqualified',
            `Max violations (${this.maxViolations()}) reached. Your test was automatically submitted.`
          );
          this.router.navigate(['/student/dashboard']);
          return;
        }

        // Show warning notification
        const max = this.maxViolations();
        this.toastService.warning(
          `Warning ${vCount} of ${max}`,
          `Please stay on the test window. Re-entering fullscreen mode.`
        );

        this.warningMessage.set(message);
        this.showWarningDialog.set(true);

        // Attempt to restore fullscreen
        this.enterFullscreen();
      },
      error: (err) => {
        console.error('[TakeTest] Failed to log violation:', err);
      },
    });
  }

  // Dismiss warning dialog
  protected dismissWarningDialog(): void {
    this.showWarningDialog.set(false);
    this.enterFullscreen();
  }

  // Question navigation
  protected goToQuestion(index: number): void {
    if (index >= 0 && index < this.questions().length) {
      this.currentIndex.set(index);
    }
  }

  protected nextQuestion(): void {
    if (this.currentIndex() < this.questions().length - 1) {
      this.currentIndex.set(this.currentIndex() + 1);
    }
  }

  protected previousQuestion(): void {
    if (this.currentIndex() > 0) {
      this.currentIndex.set(this.currentIndex() - 1);
    }
  }

  // Select an option
  protected selectOption(optionIndex: number): void {
    const currentAnswers = [...this.answers()];
    const qIdx = this.currentIndex();
    currentAnswers[qIdx] = optionIndex;
    this.answers.set(currentAnswers);
  }

  // Clear answer
  protected clearAnswer(): void {
    const currentAnswers = [...this.answers()];
    currentAnswers[this.currentIndex()] = null;
    this.answers.set(currentAnswers);
  }

  // Toggle Mark for Review
  protected toggleMarkForReview(): void {
    const flags = [...this.markedForReview()];
    const qIdx = this.currentIndex();
    flags[qIdx] = !flags[qIdx];
    this.markedForReview.set(flags);
  }

  // Debounced auto-save (called every 30 seconds)
  protected triggerAutoSave(): void {
    if (this.isSubmitting() || !this.attemptId()) return;

    this.isSaving.set(true);
    this.studentService.saveAnswers(this.attemptId(), this.answers()).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.lastSavedTime.set(new Date());
      },
      error: (err) => {
        this.isSaving.set(false);
        console.warn('[TakeTest] Auto-save background sync error:', err);
      },
    });
  }

  // Open confirmation modal
  protected promptSubmit(): void {
    this.showSubmitConfirmModal.set(true);
  }

  protected closeSubmitConfirmModal(): void {
    this.showSubmitConfirmModal.set(false);
  }

  // Submit test (Final)
  protected submitAssessment(isAuto = false): void {
    if (this.isSubmitting()) return;

    this.isSubmitting.set(true);
    this.showSubmitConfirmModal.set(false);
    this.teardownListenersAndTimers();

    const attId = this.attemptId();
    this.studentService.submitTest(attId, this.answers(), isAuto).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        this.toastService.success(
          'Assessment Submitted!',
          `Score: ${res.score}/${res.totalQuestions} (${res.percentage}%) - Result: ${res.result}`
        );
        this.router.navigate(['/student/dashboard']);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.toastService.error('Submission Notice', err.error?.message || 'Assessment submitted');
        this.router.navigate(['/student/dashboard']);
      },
    });
  }
}
