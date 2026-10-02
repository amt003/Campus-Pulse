import {
  Component,
  Input,
  signal,
  OnChanges,
  SimpleChanges,
  OnDestroy,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-button-spinner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './button-spinner.component.html',
  styleUrl: './button-spinner.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ButtonSpinnerComponent implements OnChanges, OnDestroy {
  @Input() loading: boolean = false;
  @Input() text?: string;
  @Input() loadingText?: string;

  protected readonly isSpinnerActive = signal<boolean>(false);

  private readonly SHOW_DELAY_MS = 300;
  private readonly MIN_DISPLAY_MS = 500;

  private showTimer: any = null;
  private minDisplayTimer: any = null;
  private shownTimestamp: number = 0;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['loading']) {
      if (this.loading) {
        this.handleStart();
      } else {
        this.handleEnd();
      }
    }
  }

  ngOnDestroy(): void {
    this.clearTimers();
  }

  private handleStart(): void {
    this.clearTimers();

    // Show delay: Only show if loading exceeds 300 ms
    this.showTimer = setTimeout(() => {
      this.shownTimestamp = Date.now();
      this.isSpinnerActive.set(true);
    }, this.SHOW_DELAY_MS);
  }

  private handleEnd(): void {
    if (this.showTimer) {
      clearTimeout(this.showTimer);
      this.showTimer = null;
    }

    if (!this.isSpinnerActive()) {
      return;
    }

    // Enforce 500 ms minimum display time
    const elapsed = Date.now() - this.shownTimestamp;
    const remainingTime = Math.max(0, this.MIN_DISPLAY_MS - elapsed);

    this.minDisplayTimer = setTimeout(() => {
      this.isSpinnerActive.set(false);
      this.clearTimers();
    }, remainingTime);
  }

  private clearTimers(): void {
    if (this.showTimer) {
      clearTimeout(this.showTimer);
      this.showTimer = null;
    }
    if (this.minDisplayTimer) {
      clearTimeout(this.minDisplayTimer);
      this.minDisplayTimer = null;
    }
  }
}
