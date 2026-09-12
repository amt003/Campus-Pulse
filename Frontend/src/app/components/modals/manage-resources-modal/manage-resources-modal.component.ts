import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RecruiterService } from '../../../services/recruiter.service';
import { ToastService } from '../../../services/toast.service';
import { SmoothScrollService } from '../../../services/smooth-scroll.service';

export interface AttachmentItem {
  _id?: string;
  gridFileId?: string;
  fileName: string;
  fileSize: number;
  fileType?: string;
  uploadedAt: string;
}

@Component({
  selector: 'app-manage-resources-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './manage-resources-modal.component.html',
  styleUrl: './manage-resources-modal.component.css'
})
export class ManageResourcesModalComponent implements OnInit, OnDestroy {
  private readonly recruiterService = inject(RecruiterService);
  private readonly toastService = inject(ToastService);
  private readonly smoothScrollService = inject(SmoothScrollService);

  @Input({ required: true }) driveId!: string;
  @Input({ required: true }) driveTitle!: string;
  @Output() onClose = new EventEmitter<void>();

  protected attachments = signal<AttachmentItem[]>([]);
  protected isLoading = signal<boolean>(false);
  protected isUploading = signal<boolean>(false);

  // Inline delete confirmation — holds the fileId pending deletion
  protected pendingDeleteId = signal<string | null>(null);

  protected selectedFile: File | null = null;
  protected dragOver = signal<boolean>(false);

  ngOnInit(): void {
    this.smoothScrollService.freezeBackgroundScroll();
    this.fetchAttachments();
  }

  ngOnDestroy(): void {
    this.smoothScrollService.unfreezeBackgroundScroll();
  }

  protected fetchAttachments(): void {
    this.isLoading.set(true);
    this.recruiterService.getDriveAttachments(this.driveId).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        if (res && res.success) {
          this.attachments.set(res.attachments || []);
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        this.toastService.error('Failed to load resources', 'Try refreshing the page');
      }
    });
  }

  protected onFileSelected(event: any): void {
    const file = event.target.files?.[0];
    if (file) {
      this.validateAndSetFile(file);
    }
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(true);
  }

  protected onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.validateAndSetFile(file);
    }
  }

  private validateAndSetFile(file: File): void {
    const allowedExtensions = ['.pdf', '.docx', '.txt', '.pptx'];
    const fileName = file.name.toLowerCase();
    const isAllowed = allowedExtensions.some(ext => fileName.endsWith(ext));

    if (!isAllowed) {
      this.toastService.error(
        'File type not supported',
        'Only PDF, DOCX, TXT and PPTX files are allowed'
      );
      this.selectedFile = null;
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      this.toastService.error(
        'File too large',
        'Maximum allowed size is 20 MB'
      );
      this.selectedFile = null;
      return;
    }

    this.selectedFile = file;
  }

  protected uploadFile(): void {
    if (!this.selectedFile) return;

    this.isUploading.set(true);

    this.recruiterService.uploadDriveAttachment(this.driveId, this.selectedFile).subscribe({
      next: (res) => {
        this.isUploading.set(false);
        this.selectedFile = null;
        this.toastService.success('Resource uploaded', this.driveTitle);
        this.fetchAttachments();
      },
      error: (err) => {
        this.isUploading.set(false);
        this.toastService.error(
          'Upload failed',
          err.error?.message || 'Try again with a smaller file'
        );
      }
    });
  }

  protected requestDelete(fileId: string): void {
    this.pendingDeleteId.set(fileId);
  }

  protected cancelDelete(): void {
    this.pendingDeleteId.set(null);
  }

  protected confirmDelete(): void {
    const fileId = this.pendingDeleteId();
    if (!fileId) return;
    this.pendingDeleteId.set(null);

    this.recruiterService.deleteDriveAttachment(this.driveId, fileId).subscribe({
      next: (res) => {
        this.toastService.success('Resource removed', this.driveTitle);
        this.fetchAttachments();
      },
      error: (err) => {
        this.toastService.error(
          'Delete failed',
          err.error?.message || 'Try again'
        );
      }
    });
  }

  protected downloadAttachment(fileId: string): void {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
    const downloadUrl = `http://localhost:5000/api/recruiter/drive/attachment/download/${fileId}?token=${token}`;
    window.open(downloadUrl, '_blank');
  }

  protected formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = 1;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
}
