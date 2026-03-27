import { Component, inject } from '@angular/core';
import { ThemeService } from '../../../core/services/theme.service';
import { ToastService } from '../../../core/services/toast.service';
import { ButtonComponent } from './button.component';

@Component({
  selector: 'zimra-theme-toggle',
  standalone: true,
  imports: [ButtonComponent],
  template: `
    <zimra-button
      [variant]="'secondary'"
      (buttonClick)="onToggle()"
    >
      <span class="flex items-center gap-2">
        <span>{{ label }}</span>
      </span>
    </zimra-button>
  `,
})
export class ThemeToggleComponent {
  private readonly theme = inject(ThemeService);
  private readonly toast = inject(ToastService);

  get label(): string {
    return this.theme.isDark() ? 'Light mode' : 'Dark mode';
  }

  onToggle(): void {
    const nextMode = this.theme.isDark() ? 'Light' : 'Dark';
    this.theme.toggle();
    this.toast.push(`Switched to ${nextMode} mode`, 'info', 2200);
  }
}

