import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
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

  // Tab State
  protected activeTab = signal<'bank' | 'generate' | 'drafts'>('bank');

  // Main Question Bank State
  protected questions = signal<QuestionItem[]>([]);
  protected isLoading = signal<boolean>(true);
  protected isSaving = signal<boolean>(false);
  protected deletingId = signal<string | null>(null);

  // Filters
  protected selectedCategory = signal<string>('all');
  protected selectedDifficulty = signal<string>('all');
  protected searchTerm = signal<string>('');

  // Drafts State
  protected draftQuestions = signal<QuestionItem[]>([]);
  protected isLoadingDrafts = signal<boolean>(false);
  protected processingDraftId = signal<string | null>(null);
  protected isBulkProcessing = signal<boolean>(false);
  protected pendingDraftsCount = computed(() => this.draftQuestions().length);

  // AI Generator Form State
  protected genCount = signal<number>(5);
  protected genCategory = signal<'Quantitative' | 'Logical' | 'Verbal' | 'Technical'>('Quantitative');
  protected genDifficulty = signal<'Easy' | 'Medium' | 'Hard'>('Medium');
  protected isGenerating = signal<boolean>(false);
  protected generationError = signal<string | null>(null);
  protected generationSuccess = signal<string | null>(null);

  // Add/Edit Modal State
  protected isModalOpen = signal<boolean>(false);
  protected isEditing = signal<boolean>(false);
  protected editingQuestionId = signal<string | null>(null);
  protected addModalMode = signal<'manual' | 'pdf'>('manual');

  // PDF Upload & Extraction State
  protected selectedPdfFile = signal<File | null>(null);
  protected isParsingPdf = signal<boolean>(false);
  protected isImportingPdf = signal<boolean>(false);
  protected pdfParseError = signal<string | null>(null);
  protected pdfCategory = signal<'Mixed' | 'Quantitative' | 'Logical' | 'Verbal' | 'Technical'>('Mixed');
  protected pdfDifficulty = signal<'Easy' | 'Medium' | 'Hard'>('Medium');
  protected parsedQuestions = signal<
    Array<{
      selected: boolean;
      questionText: string;
      options: string[];
      correctOption: number;
      category: 'Quantitative' | 'Logical' | 'Verbal' | 'Technical';
      difficulty: 'Easy' | 'Medium' | 'Hard';
    }>
  >([]);

  protected selectedParsedCount = computed(
    () => this.parsedQuestions().filter((q) => q.selected).length
  );

  // Manual Form State
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

  // Filtered Questions computed signal for Main Bank
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
    this.loadDrafts();
  }

  protected switchTab(tab: 'bank' | 'generate' | 'drafts'): void {
    this.activeTab.set(tab);
    if (tab === 'bank') {
      this.loadQuestions();
    } else if (tab === 'drafts') {
      this.loadDrafts();
    } else if (tab === 'generate') {
      this.generationError.set(null);
      this.generationSuccess.set(null);
    }
  }

  // Question Bank Data Fetch
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

  // Draft Questions Data Fetch
  protected loadDrafts(): void {
    this.isLoadingDrafts.set(true);
    this.recruiterService.getDraftQuestions().subscribe({
      next: (res) => {
        this.isLoadingDrafts.set(false);
        const drafts = res.questions || res.data || [];
        this.draftQuestions.set(drafts);
      },
      error: (err) => {
        this.isLoadingDrafts.set(false);
        this.toastService.error(
          'Failed to Load Drafts',
          err.error?.message || 'Could not fetch draft questions'
        );
      },
    });
  }

  protected onFilterChange(): void {
    this.loadQuestions();
  }

  // AI Question Generation
  protected generateAIQuestions(): void {
    const count = Number(this.genCount());
    if (isNaN(count) || count < 1 || count > 50) {
      this.generationError.set('Please specify a question count between 1 and 50.');
      this.toastService.warning('Invalid Count', 'Question count must be between 1 and 50.');
      return;
    }

    this.isGenerating.set(true);
    this.generationError.set(null);
    this.generationSuccess.set(null);

    this.recruiterService
      .generateQuestions({
        count,
        category: this.genCategory(),
        difficulty: this.genDifficulty(),
      })
      .subscribe({
        next: (res) => {
          this.isGenerating.set(false);
          const generatedCount = res.count || res.questions?.length || count;
          this.generationSuccess.set(
            `Successfully generated ${generatedCount} questions! They have been saved as drafts for review.`
          );
          this.toastService.success(
            'AI Generation Complete',
            `Generated ${generatedCount} draft question(s). Review and approve them in the Drafts tab.`
          );
          this.loadDrafts();
        },
        error: (err) => {
          this.isGenerating.set(false);
          const errMsg =
            err.error?.message ||
            err.message ||
            'Gemini AI generation failed. Please check your network and Gemini API key configuration.';
          this.generationError.set(errMsg);
          this.toastService.error('AI Generation Failed', errMsg);
        },
      });
  }

  // Approve a single draft question
  protected approveDraft(id: string): void {
    if (!id) return;
    this.processingDraftId.set(id);

    this.recruiterService.approveDraftQuestion(id).subscribe({
      next: () => {
        this.processingDraftId.set(null);
        this.draftQuestions.set(this.draftQuestions().filter((q) => q._id !== id));
        this.toastService.success('Draft Approved', 'Question has moved to your Question Bank');
        // Refresh question bank in background
        this.loadQuestions();
      },
      error: (err) => {
        this.processingDraftId.set(null);
        this.toastService.error('Approval Failed', err.error?.message || 'Could not approve draft question');
      },
    });
  }

  // Reject a single draft question
  protected rejectDraft(id: string): void {
    if (!id) return;
    this.processingDraftId.set(id);

    this.recruiterService.rejectDraftQuestion(id).subscribe({
      next: () => {
        this.processingDraftId.set(null);
        this.draftQuestions.set(this.draftQuestions().filter((q) => q._id !== id));
        this.toastService.info('Draft Rejected', 'Question was rejected and removed from drafts');
      },
      error: (err) => {
        this.processingDraftId.set(null);
        this.toastService.error('Rejection Failed', err.error?.message || 'Could not reject draft question');
      },
    });
  }

  // Bulk Approve All Drafts
  protected approveAllDrafts(): void {
    const drafts = this.draftQuestions();
    if (drafts.length === 0) return;

    if (!confirm(`Are you sure you want to approve all ${drafts.length} draft question(s)? They will become available in the active question bank.`)) {
      return;
    }

    this.isBulkProcessing.set(true);
    const requests = drafts.map((d) =>
      this.recruiterService.approveDraftQuestion(d._id!).pipe(catchError((e) => of(null)))
    );

    forkJoin(requests).subscribe({
      next: () => {
        this.isBulkProcessing.set(false);
        this.toastService.success('Bulk Approval Complete', `Processed all pending draft questions.`);
        this.loadDrafts();
        this.loadQuestions();
      },
      error: () => {
        this.isBulkProcessing.set(false);
        this.toastService.error('Bulk Approval Failed', 'An error occurred during bulk approval.');
        this.loadDrafts();
      },
    });
  }

  // Bulk Reject All Drafts
  protected rejectAllDrafts(): void {
    const drafts = this.draftQuestions();
    if (drafts.length === 0) return;

    if (!confirm(`Are you sure you want to reject all ${drafts.length} draft question(s)? This will remove them permanently.`)) {
      return;
    }

    this.isBulkProcessing.set(true);
    const requests = drafts.map((d) =>
      this.recruiterService.rejectDraftQuestion(d._id!).pipe(catchError((e) => of(null)))
    );

    forkJoin(requests).subscribe({
      next: () => {
        this.isBulkProcessing.set(false);
        this.toastService.info('Bulk Rejection Complete', 'Draft questions were rejected.');
        this.loadDrafts();
      },
      error: () => {
        this.isBulkProcessing.set(false);
        this.toastService.error('Bulk Rejection Failed', 'An error occurred during bulk rejection.');
        this.loadDrafts();
      },
    });
  }

  // Manual & PDF Modal Openers
  protected openAddModal(): void {
    this.isEditing.set(false);
    this.editingQuestionId.set(null);
    this.addModalMode.set('manual');
    this.selectedPdfFile.set(null);
    this.parsedQuestions.set([]);
    this.pdfParseError.set(null);
    this.formData.set({
      questionText: '',
      options: ['', '', '', ''],
      correctOption: 0,
      category: 'Quantitative',
      difficulty: 'Medium',
    });
    this.isModalOpen.set(true);
  }

  protected setAddModalMode(mode: 'manual' | 'pdf'): void {
    this.addModalMode.set(mode);
    this.pdfParseError.set(null);
  }

  protected onPdfSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        this.toastService.warning('Invalid File', 'Please select a valid PDF document.');
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        this.toastService.warning('File Too Large', 'PDF file size must be less than 20MB.');
        return;
      }
      this.selectedPdfFile.set(file);
      this.pdfParseError.set(null);
    }
  }

  protected removeSelectedPdf(): void {
    this.selectedPdfFile.set(null);
    this.parsedQuestions.set([]);
    this.pdfParseError.set(null);
  }

  protected extractQuestionsFromPdf(): void {
    const file = this.selectedPdfFile();
    if (!file) {
      this.toastService.warning('No File', 'Please select a PDF document first.');
      return;
    }

    this.isParsingPdf.set(true);
    this.pdfParseError.set(null);

    this.recruiterService
      .parseQuestionsFromPdf(file, this.pdfCategory(), this.pdfDifficulty())
      .subscribe({
        next: (res) => {
          this.isParsingPdf.set(false);
          const rawList = res.questions || res.data || [];
          if (rawList.length === 0) {
            this.pdfParseError.set('No questions were detected in the uploaded PDF. Please verify your document structure.');
            this.toastService.warning('No Questions Found', 'Could not detect MCQ questions in the PDF.');
            return;
          }

          const formatted = rawList.map((q: any) => ({
            selected: true,
            questionText: q.questionText || '',
            options: Array.isArray(q.options) && q.options.length === 4 ? q.options : ['A', 'B', 'C', 'D'],
            correctOption: typeof q.correctOption === 'number' ? q.correctOption : 0,
            category: (q.category || this.pdfCategory()) as 'Quantitative' | 'Logical' | 'Verbal' | 'Technical',
            difficulty: (q.difficulty || this.pdfDifficulty()) as 'Easy' | 'Medium' | 'Hard',
          }));

          this.parsedQuestions.set(formatted);
          this.toastService.success('Extraction Complete', `Extracted ${formatted.length} question(s) from PDF.`);
        },
        error: (err) => {
          this.isParsingPdf.set(false);
          const msg = err.error?.message || err.message || 'Failed to parse questions from PDF.';
          this.pdfParseError.set(msg);
          this.toastService.error('PDF Parse Failed', msg);
        },
      });
  }

  protected toggleAllParsed(select: boolean): void {
    this.parsedQuestions.update((list) =>
      list.map((q) => ({ ...q, selected: select }))
    );
  }

  protected toggleParsedItem(index: number): void {
    this.parsedQuestions.update((list) => {
      const copy = [...list];
      if (copy[index]) {
        copy[index] = { ...copy[index], selected: !copy[index].selected };
      }
      return copy;
    });
  }

  protected removeParsedItem(index: number): void {
    this.parsedQuestions.update((list) => list.filter((_, i) => i !== index));
  }

  protected updateParsedOption(qIndex: number, optIndex: number, value: string): void {
    this.parsedQuestions.update((list) => {
      const copy = [...list];
      if (copy[qIndex]) {
        const opts = [...copy[qIndex].options];
        opts[optIndex] = value;
        copy[qIndex] = { ...copy[qIndex], options: opts };
      }
      return copy;
    });
  }

  protected setParsedCorrectOption(qIndex: number, optIndex: number): void {
    this.parsedQuestions.update((list) => {
      const copy = [...list];
      if (copy[qIndex]) {
        copy[qIndex] = { ...copy[qIndex], correctOption: optIndex };
      }
      return copy;
    });
  }

  protected importSelectedParsedQuestions(): void {
    const selected = this.parsedQuestions().filter((q) => q.selected);
    if (selected.length === 0) {
      this.toastService.warning('No Questions Selected', 'Please select at least one question to import.');
      return;
    }

    for (let i = 0; i < selected.length; i++) {
      const q = selected[i];
      if (!q.questionText.trim()) {
        this.toastService.warning('Validation Error', `Question #${i + 1} has an empty question statement.`);
        return;
      }
      for (let j = 0; j < 4; j++) {
        if (!q.options[j] || !q.options[j].trim()) {
          this.toastService.warning('Validation Error', `Question #${i + 1} is missing Option ${String.fromCharCode(65 + j)}.`);
          return;
        }
      }
    }

    this.isImportingPdf.set(true);
    this.recruiterService.bulkAddQuestions(selected).subscribe({
      next: (res) => {
        this.isImportingPdf.set(false);
        const count = res.count || selected.length;
        this.toastService.success('Questions Imported', `Successfully added ${count} question(s) to your Question Bank.`);
        this.closeModal();
        this.loadQuestions();
      },
      error: (err) => {
        this.isImportingPdf.set(false);
        this.toastService.error('Import Failed', err.error?.message || 'Failed to import questions to Question Bank.');
      },
    });
  }

  protected openEditModal(question: QuestionItem): void {
    this.isEditing.set(true);
    this.editingQuestionId.set(question._id || null);
    this.addModalMode.set('manual');
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
    if (this.isSaving() || this.isParsingPdf() || this.isImportingPdf()) return;
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
        next: () => {
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
        next: () => {
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
