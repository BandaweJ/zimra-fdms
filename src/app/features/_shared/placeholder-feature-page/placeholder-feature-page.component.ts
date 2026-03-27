import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'zimra-placeholder-feature-page',
  standalone: true,
  template: `
    <div class="mx-auto w-full max-w-5xl px-4 py-10">
      <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div class="mb-3 text-sm text-slate-500">ZIMRA FDMS</div>
        <h1 class="text-2xl font-semibold tracking-tight text-slate-900">
          {{ title() }}
        </h1>
        <p class="mt-3 text-slate-600">
          This is a placeholder screen for this feature. The full UI and API integration will be implemented next.
        </p>
      </div>
    </div>
  `,
})
export class PlaceholderFeaturePageComponent {
  private readonly route = inject(ActivatedRoute);

  protected readonly title = computed(() => {
    const data = (this.route.snapshot.data ?? {}) as Record<string, unknown>;
    const raw = data['title'];
    return typeof raw === 'string' ? raw : 'Coming soon';
  });
}

