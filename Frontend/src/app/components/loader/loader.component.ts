import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-loader',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './loader.component.html',
  styleUrl: './loader.component.css',
})
export class LoaderComponent {
  /**
   * The name or description of what is being loaded.
   * e.g., 'Dashboard', 'Placement Drives', 'profile details'
   * Will render as: "Loading <message>..."
   */
  @Input() message: string = '';

  /**
   * Optional secondary descriptive message below the main loading text.
   * e.g., 'Synchronizing with proctoring engine...'
   */
  @Input() submessage: string = '';

  /**
   * Size of the loader symbol: 'sm' | 'md' | 'lg'
   * Default: 'md'
   */
  @Input() size: 'sm' | 'md' | 'lg' = 'md';

  /**
   * Layout style:
   * - 'inline': Centered container inside the page flow (default)
   * - 'card': Embedded inside a frosted glass card
   * - 'overlay': Absolute-positioned over parent element
   * - 'fullscreen': Fixed viewport-wide modal overlay
   */
  @Input() layout: 'inline' | 'card' | 'overlay' | 'fullscreen' = 'inline';

  /**
   * Minimum height of the container in px or CSS string (e.g., '280px', '400px').
   */
  @Input() minHeight?: string;

  /**
   * Normalizes the message string so that if the caller passes
   * "Loading Dashboard..." or just "Dashboard", it always formats consistently.
   */
  get formattedMessage(): string {
    if (!this.message || !this.message.trim()) {
      return 'data';
    }
    let text = this.message.trim();
    if (text.toLowerCase().startsWith('loading ')) {
      text = text.substring(8).trim();
    }
    // Strip trailing ellipsis if already present
    text = text.replace(/(\.{2,3}|…)$/, '').trim();
    return text;
  }
}
