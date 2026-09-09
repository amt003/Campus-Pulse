import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-tpo-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './tpo-sidebar.component.html',
  styleUrl: './tpo-sidebar.component.css',
})
export class TpoSidebarComponent {
  isCollapsed = input<boolean>(false);
  pendingCount = input<number>(0);
  pendingDriveCount = input<number>(0);
}
