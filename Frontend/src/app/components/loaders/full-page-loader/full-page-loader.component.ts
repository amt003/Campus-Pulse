import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoadingService } from '../../../services/loading.service';

@Component({
  selector: 'app-full-page-loader',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './full-page-loader.component.html',
  styleUrl: './full-page-loader.component.css'
})
export class FullPageLoaderComponent {
  protected readonly loadingService = inject(LoadingService);

  onRetry(): void {
    this.loadingService.retry();
  }
}
