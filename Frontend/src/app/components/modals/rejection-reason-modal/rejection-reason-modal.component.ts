import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SmoothScrollService } from '../../../services/smooth-scroll.service';

@Component({
  selector: 'app-rejection-reason-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './rejection-reason-modal.component.html',
  styleUrl: './rejection-reason-modal.component.css'
})
export class RejectionReasonModalComponent implements OnInit, OnDestroy {
  private readonly smoothScrollService = inject(SmoothScrollService);

  @Input({ required: true }) drive: any;
  @Output() onClose = new EventEmitter<void>();

  ngOnInit(): void {
    this.smoothScrollService.freezeBackgroundScroll();
  }

  ngOnDestroy(): void {
    this.smoothScrollService.unfreezeBackgroundScroll();
  }

  protected getCTCInLpa(ctcInRupees?: number): string {
    if (!ctcInRupees) return '—';
    const lpa = ctcInRupees / 100000;
    return lpa.toFixed(1) + ' LPA';
  }

  protected get rejectionReason(): string {
    if (!this.drive) return 'No feedback available.';
    return (
      this.drive.tpoFeedback ||
      this.drive.rejectionReason ||
      'No specific rejection reason or remarks were recorded by the TPO.'
    );
  }
}
