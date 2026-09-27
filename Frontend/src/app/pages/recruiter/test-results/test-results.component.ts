import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { RecruiterService } from '../../../services/recruiter.service';
import { ToastService } from '../../../services/toast.service';

export interface CandidateAttempt {
  _id: string;
  studentId?: {
    _id: string;
    userId?: {
      _id: string;
      name: string;
      email: string;
      rollNumber?: string;
    } | null;
  } | null;
  score: number;
  totalQuestions: number;
  percentage: number;
  result: 'Pass' | 'Fail' | string;
  violationCount: number;
  flagged: boolean;
  autoSubmitted: boolean;
  submittedAt: string | Date;
}

export interface QuestionAccuracyStat {
  questionId: string;
  questionText: string;
  options: string[];
  category: string;
  difficulty: string;
  correctOption: number;
  correctAnswerText: string;
  totalAttempts: number;
  correctAttempts: number;
  accuracyPercentage: number;
}

@Component({
  selector: 'app-recruiter-test-results',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './test-results.component.html',
  styleUrl: './test-results.component.css',
})
export class RecruiterTestResultsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly recruiterService = inject(RecruiterService);
  private readonly toastService = inject(ToastService);

  protected testId = signal<string>('');
  protected testTitle = signal<string>('Assessment Results');
  protected passingScore = signal<number>(60);
  protected attempts = signal<CandidateAttempt[]>([]);
  protected questionStats = signal<QuestionAccuracyStat[]>([]);
  protected isLoading = signal<boolean>(true);
  protected errorMessage = signal<string>('');

  // Filtering & Tab state
  protected activeTab = signal<'candidates' | 'questions'>('candidates');
  protected searchQuery = signal<string>('');
  protected resultFilter = signal<'ALL' | 'Pass' | 'Fail' | 'Flagged'>('ALL');

  // Filtered Candidates
  protected filteredAttempts = computed(() => {
    let list = this.attempts();
    const query = this.searchQuery().trim().toLowerCase();
    const filter = this.resultFilter();

    if (query) {
      list = list.filter((a) => {
        const u = a.studentId?.userId;
        return (
          u?.name?.toLowerCase().includes(query) ||
          u?.email?.toLowerCase().includes(query) ||
          (u?.rollNumber && u.rollNumber.toLowerCase().includes(query))
        );
      });
    }

    if (filter === 'Pass') {
      list = list.filter((a) => a.result === 'Pass');
    } else if (filter === 'Fail') {
      list = list.filter((a) => a.result === 'Fail');
    } else if (filter === 'Flagged') {
      list = list.filter((a) => a.flagged || a.violationCount > 0);
    }

    return list;
  });

  // Summary Metrics
  protected totalAttemptsCount = computed(() => this.attempts().length);
  protected passedCount = computed(() => this.attempts().filter((a) => a.result === 'Pass').length);
  protected failedCount = computed(() => this.attempts().filter((a) => a.result === 'Fail').length);
  protected flaggedCount = computed(() => this.attempts().filter((a) => a.flagged).length);
  protected passRate = computed(() => {
    const total = this.totalAttemptsCount();
    return total > 0 ? Math.round((this.passedCount() / total) * 100) : 0;
  });
  protected avgScore = computed(() => {
    const total = this.totalAttemptsCount();
    if (total === 0) return 0;
    const sum = this.attempts().reduce((acc, curr) => acc + (curr.percentage || 0), 0);
    return Math.round((sum / total) * 10) / 10;
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('testId');
    if (!id) {
      this.errorMessage.set('Missing or invalid test identifier.');
      this.isLoading.set(false);
      return;
    }
    this.testId.set(id);
    this.loadResults(id);
  }

  protected loadResults(testId: string): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.recruiterService.getTestResults(testId).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        if (res && res.success) {
          this.testTitle.set(res.title || 'Aptitude Test Results');
          this.passingScore.set(res.passingScore ?? 60);
          this.attempts.set(res.attempts || res.data?.attempts || []);
          this.questionStats.set(res.questionStats || res.data?.questionStats || []);
        } else {
          this.errorMessage.set(res?.message || 'Failed to retrieve assessment results.');
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(
          err.error?.message || 'Failed to load test results. Please ensure you own this test.'
        );
      },
    });
  }

  // Difficulty calibration tag calculation
  protected getDifficultyTag(accuracy: number): { label: string; class: string } {
    if (accuracy >= 80) {
      return { label: 'Too Easy', class: 'tag-easy' };
    }
    if (accuracy <= 30) {
      return { label: 'Too Hard', class: 'tag-hard' };
    }
    return { label: 'Balanced', class: 'tag-balanced' };
  }

  // Option Letter Helper
  protected getOptionLetter(idx: number): string {
    return ['A', 'B', 'C', 'D'][idx] || `Option ${idx + 1}`;
  }

  // Export as CSV
  protected exportAsCSV(): void {
    const list = this.attempts();
    if (list.length === 0) {
      this.toastService.warning('Export Notice', 'No candidate attempts available to export.');
      return;
    }

    const headers = [
      'Candidate Name',
      'Roll Number',
      'Email',
      'Score',
      'Total Questions',
      'Percentage (%)',
      'Result',
      'Passing Cutoff (%)',
      'Violations Count',
      'Flagged',
      'Auto-Submitted',
      'Submission Timestamp',
    ];

    const rows = list.map((a) => {
      const u = a.studentId?.userId;
      return [
        `"${u?.name || 'N/A'}"`,
        `"${u?.rollNumber || 'N/A'}"`,
        `"${u?.email || 'N/A'}"`,
        a.score ?? 0,
        a.totalQuestions ?? 0,
        `${a.percentage ?? 0}%`,
        a.result || 'Pending',
        `${this.passingScore()}%`,
        a.violationCount ?? 0,
        a.flagged ? 'YES' : 'NO',
        a.autoSubmitted ? 'YES' : 'NO',
        `"${a.submittedAt ? new Date(a.submittedAt).toISOString() : 'N/A'}"`,
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const cleanTitle = this.testTitle().replace(/[^a-zA-Z0-9_-]/g, '_');
    link.setAttribute('href', url);
    link.setAttribute('download', `Results_${cleanTitle}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    this.toastService.success('Export Completed', 'Candidate results exported successfully as CSV.');
  }
}
