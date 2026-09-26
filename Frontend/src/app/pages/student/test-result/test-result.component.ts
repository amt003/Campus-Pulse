import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { StudentService } from '../../../services/student.service';

export interface SectionBreakdown {
  category: string;
  total: number;
  correct: number;
  percentage: number;
}

export interface StudentTestResultData {
  testTitle: string;
  driveTitle?: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  result: 'Pass' | 'Fail' | string;
  passingScore: number;
  submittedAt: string | Date;
  autoSubmitted: boolean;
  violationCount: number;
  sectionWiseBreakdown: SectionBreakdown[];
}

@Component({
  selector: 'app-student-test-result',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './test-result.component.html',
  styleUrl: './test-result.component.css',
})
export class StudentTestResultComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly studentService = inject(StudentService);

  protected attemptId = signal<string>('');
  protected resultData = signal<StudentTestResultData | null>(null);
  protected isLoading = signal<boolean>(true);
  protected errorMessage = signal<string>('');

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('attemptId');
    if (!id) {
      this.errorMessage.set('Invalid attempt identifier.');
      this.isLoading.set(false);
      return;
    }
    this.attemptId.set(id);
    this.loadResult(id);
  }

  protected loadResult(attemptId: string): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.studentService.getMyResult(attemptId).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        if (res && res.success) {
          this.resultData.set({
            testTitle: res.testTitle || 'Aptitude Assessment',
            driveTitle: res.driveTitle || undefined,
            score: res.score ?? 0,
            totalQuestions: res.totalQuestions ?? 0,
            percentage: res.percentage ?? 0,
            result: res.result || 'Pending',
            passingScore: res.passingScore ?? 60,
            submittedAt: res.submittedAt || new Date(),
            autoSubmitted: Boolean(res.autoSubmitted),
            violationCount: res.violationCount ?? 0,
            sectionWiseBreakdown: res.sectionWiseBreakdown || [],
          });
        } else {
          this.errorMessage.set(res?.message || 'Failed to retrieve assessment score.');
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(
          err.error?.message || 'Unable to load test results. Please check your network connection.'
        );
      },
    });
  }

  protected getCategoryIcon(cat: string): string {
    switch (cat?.toLowerCase()) {
      case 'quantitative':
        return 'calculate';
      case 'logical':
        return 'psychology';
      case 'verbal':
        return 'spellcheck';
      case 'technical':
        return 'code';
      default:
        return 'category';
    }
  }

  protected getAccuracyColorClass(percentage: number): string {
    if (percentage >= 75) return 'high-accuracy';
    if (percentage >= 50) return 'mid-accuracy';
    return 'low-accuracy';
  }
}
