import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  OnChanges,
  SimpleChanges,
  OnDestroy,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-module-loader',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './module-loader.component.html',
  styleUrl: './module-loader.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ModuleLoaderComponent implements OnChanges, OnDestroy {
  @Input() loading: boolean = false;
  @Input() label: string = 'Loading…';
  @Input() error: string | null = null;
  @Output() retry = new EventEmitter<void>();

  // Display states
  protected readonly isSkeletonVisible = signal<boolean>(false);
  protected readonly isTimedOut = signal<boolean>(false);

  // Timing constants
  private readonly SHOW_DELAY_MS = 300;
  private readonly MIN_DISPLAY_MS = 500;
  private readonly TIMEOUT_MS = 10000;

  private showTimer: any = null;
  private timeoutTimer: any = null;
  private minDisplayTimer: any = null;
  private shownTimestamp: number = 0;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['loading']) {
      if (this.loading) {
        this.handleLoadingStart();
      } else {
        this.handleLoadingEnd();
      }
    }

    if (changes['error'] && this.error) {
      this.clearAllTimers();
      this.isSkeletonVisible.set(true);
    }
  }

  ngOnDestroy(): void {
    this.clearAllTimers();
  }

  private handleLoadingStart(): void {
    this.clearAllTimers();
    this.isTimedOut.set(false);

    // Show delay: Only show if loading exceeds 300 ms
    this.showTimer = setTimeout(() => {
      this.shownTimestamp = Date.now();
      this.isSkeletonVisible.set(true);

      // Start 10-second timeout
      this.timeoutTimer = setTimeout(() => {
        if (this.loading && !this.error) {
          this.isTimedOut.set(true);
        }
      }, this.TIMEOUT_MS);
    }, this.SHOW_DELAY_MS);
  }

  private handleLoadingEnd(): void {
    if (this.showTimer) {
      clearTimeout(this.showTimer);
      this.showTimer = null;
    }

    if (!this.isSkeletonVisible()) {
      return;
    }

    // Loader is visible: guarantee minimum 500 ms display time
    const elapsed = Date.now() - this.shownTimestamp;
    const remainingTime = Math.max(0, this.MIN_DISPLAY_MS - elapsed);

    this.minDisplayTimer = setTimeout(() => {
      this.isSkeletonVisible.set(false);
      this.isTimedOut.set(false);
      this.clearAllTimers();
    }, remainingTime);
  }

  protected onRetryClick(): void {
    this.isTimedOut.set(false);
    this.retry.emit();
  }

  private clearAllTimers(): void {
    if (this.showTimer) {
      clearTimeout(this.showTimer);
      this.showTimer = null;
    }
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
    if (this.minDisplayTimer) {
      clearTimeout(this.minDisplayTimer);
      this.minDisplayTimer = null;
    }
  }
}
