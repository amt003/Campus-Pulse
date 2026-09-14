import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastContainerComponent } from './components/toast/toast-container.component';
import { InstallPromptComponent } from './components/install-prompt/install-prompt.component';
import { SmoothScrollService } from './services/smooth-scroll.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastContainerComponent, InstallPromptComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  private readonly smoothScroll = inject(SmoothScrollService);
  protected readonly title = signal('Frontend');

  ngOnInit(): void {
    this.smoothScroll.init();
  }
}
