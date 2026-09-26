import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { RecruiterService } from '../../../services/recruiter.service';
import { ToastService } from '../../../services/toast.service';

export interface QuestionItem {
  _id?: string;
  questionText: string;
  options: string[];
  correctOption: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  category: 'Quantitative' | 'Logical' | 'Verbal' | 'Technical';
  source?: string;
  status?: string;
  timesUsed?: number;
  createdAt?: string;
}

@Component({
  selector: 'app-question-bank',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './question-bank.component.html',
  styleUrl: './question-bank.component.css',
})
export class RecruiterQuestionBankComponent implements OnInit {
  private readonly recruiterService = inject(RecruiterService);
  private readonly toastService = inject(ToastService);

  protected questions = signal<QuestionItem[]>([]);
  protected isLoading = signal<boolean>(true);
  protected isSaving = signal<boolean>(false);
  protected deletingId = signal<string | null>(null);

  // Filters
  protected selectedCategory = signal<string>('all');
  protected selectedDifficulty = signal<string>('all');
  protected searchTerm = signal<string>('');

  // Modal State
  protected isModalOpen = signal<boolean>(false);
  protected isEditing = signal<boolean>(false);
  protected editingQuestionId = signal<string | null>(null);

  // Form State
  protected formData = signal<{
    questionText: string;
    options: string[];
    correctOption: number;
    category: 'Quantitative' | 'Logical' | 'Verbal' | 'Technical';
    difficulty: 'Easy' | 'Medium' | 'Hard';
  }>({
    questionText: '',
    options: ['', '', '', ''],
    correctOption: 0,
    category: 'Quantitative',
    difficulty: 'Medium',
  });

  // Filtered Questions computed signal
  protected filteredQuestions = computed(() => {
    let list = this.questions();
    const search = this.searchTerm().toLowerCase().trim();

    if (search) {
      list = list.filter(
        (q) =>
          q.questionText.toLowerCase().includes(search) ||
          q.category.toLowerCase().includes(search) ||
          q.difficulty.toLowerCase().includes(search)
      );
    }

    return list;
  });

  ngOnInit(): void {
    this.loadQuestions();
  }

  protected loadQuestions(): void {
    this.isLoading.set(true);
    const filter: { category?: string; difficulty?: string } = {};

    if (this.selectedCategory() !== 'all') {
      filter.category = this.selectedCategory();
    }
    if (this.selectedDifficulty() !== 'all') {
      filter.difficulty = this.selectedDifficulty();
    }

    this.recruiterService.getQuestions(filter).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        const fetched = res.questions || res.data || [];
        this.questions.set(fetched);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.toastService.error(
          'Failed to Load Questions',
          err.error?.message || 'Could not fetch question bank'
        );
      },
    });
  }

  protected onFilterChange(): void {
    this.loadQuestions();
  }

  protected openAddModal(): void {
    this.isEditing.set(false);
    this.editingQuestionId.set(null);
    this.formData.set({
      questionText: '',
      options: ['', '', '', ''],
      correctOption: 0,
      category: 'Quantitative',
      difficulty: 'Medium',
    });
    this.isModalOpen.set(true);
  }

  protected openEditModal(question: QuestionItem): void {
    this.isEditing.set(true);
    this.editingQuestionId.set(question._id || null);
    this.formData.set({
      questionText: question.questionText,
      options: [...question.options],
      correctOption: question.correctOption,
      category: question.category,
      difficulty: question.difficulty,
    });
    this.isModalOpen.set(true);
  }

  protected closeModal(): void {
    if (this.isSaving()) return;
    this.isModalOpen.set(false);
  }

  protected updateOptionText(index: number, value: string): void {
    const current = this.formData();
    const updatedOptions = [...current.options];
    updatedOptions[index] = value;
    this.formData.set({ ...current, options: updatedOptions });
  }

  protected setCorrectOption(index: number): void {
    const current = this.formData();
    this.formData.set({ ...current, correctOption: index });
  }

  protected saveQuestion(): void {
    const data = this.formData();

    if (!data.questionText.trim()) {
      this.toastService.warning('Validation Error', 'Question statement is required');
      return;
    }

    for (let i = 0; i < 4; i++) {
      if (!data.options[i] || !data.options[i].trim()) {
        this.toastService.warning('Validation Error', `Please provide text for Option ${String.fromCharCode(65 + i)}`);
        return;
      }
    }

    this.isSaving.set(true);

    if (this.isEditing() && this.editingQuestionId()) {
      this.recruiterService.updateQuestion(this.editingQuestionId()!, data).subscribe({
        next: (res) => {
          this.isSaving.set(false);
          this.isModalOpen.set(false);
          this.toastService.success('Question Updated', 'Question was updated successfully');
          this.loadQuestions();
        },
        error: (err) => {
          this.isSaving.set(false);
          this.toastService.error('Update Failed', err.error?.message || 'Could not update question');
        },
      });
    } else {
      this.recruiterService.addQuestion(data).subscribe({
        next: (res) => {
          this.isSaving.set(false);
          this.isModalOpen.set(false);
          this.toastService.success('Question Added', 'New question added to your bank');
          this.loadQuestions();
        },
        error: (err) => {
          this.isSaving.set(false);
          this.toastService.error('Creation Failed', err.error?.message || 'Could not save question');
        },
      });
    }
  }

  protected deleteQuestion(id: string): void {
    if (!confirm('Are you sure you want to delete this question? This action cannot be undone.')) {
      return;
    }

    this.deletingId.set(id);
    this.recruiterService.deleteQuestion(id).subscribe({
      next: () => {
        this.deletingId.set(null);
        this.toastService.success('Deleted', 'Question removed from question bank');
        this.questions.set(this.questions().filter((q) => q._id !== id));
      },
      error: (err) => {
        this.deletingId.set(null);
        this.toastService.error('Delete Failed', err.error?.message || 'Could not delete question');
      },
    });
  }
}
