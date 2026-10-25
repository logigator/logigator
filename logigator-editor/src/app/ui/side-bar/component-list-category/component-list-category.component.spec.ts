import { beforeEach, describe, expect, it } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import {
  Translation,
  TRANSLOCO_LOADER,
  TranslocoLoader,
  TranslocoService
} from '@jsverse/transloco';

import { ComponentListCategoryComponent } from './component-list-category.component';
import { configureTestBed } from '../../../../testing/configure-test-bed';
import { MobileUiService } from '../../../layout/mobile-ui.service';
import { WorkModeService } from '../../../work-mode/work-mode.service';
import { WorkMode } from '../../../work-mode/work-mode.enum';
import { andComponentConfig } from '../../../components/component-types/and/and.config';
import { ComponentProviderService } from '../../../components/component-provider.service';

/** Loader with distinct values for the AND-gate name key per language. */
class TwoLangLoader implements TranslocoLoader {
  getTranslation(lang: string): Promise<Translation> {
    const tables: Record<string, Translation> = {
      en: { components: { def: { AND: { name: 'AND Gate' } } } },
      de: { components: { def: { AND: { name: 'UND-Gatter' } } } }
    };
    return Promise.resolve(tables[lang] ?? {});
  }
}

describe('ComponentListCategoryComponent', () => {
  let component: ComponentListCategoryComponent;
  let fixture: ComponentFixture<ComponentListCategoryComponent>;

  beforeEach(async () => {
    configureTestBed([], [ComponentListCategoryComponent]);

    fixture = TestBed.createComponent(ComponentListCategoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('arms placement and closes the open mobile sheet on selection', () => {
    const mobileUi = TestBed.inject(MobileUiService);
    const workMode = TestBed.inject(WorkModeService);
    mobileUi.open('palette');

    // Selection only arms placement; the circuit is fetched later, at place-time.
    component.selectComponent(andComponentConfig);

    expect(workMode.mode()).toBe(WorkMode.COMPONENT_PLACEMENT);
    expect(workMode.selectedComponentType()).toBe(andComponentConfig.type);
    expect(mobileUi.activeSheet()).toBeNull();
  });

  // A shape declaring neither path, or an empty one, replaces the symbol text
  // with nothing and leaves a blank tile no type check catches.
  it('draws geometry for every shape a config declares', () => {
    const shaped = TestBed.inject(ComponentProviderService)
      .allComponents()
      .filter((config) => config.symbolShape !== undefined);
    expect(shaped.length).toBeGreaterThan(0);

    for (const config of shaped) {
      const shapedFixture = TestBed.createComponent(
        ComponentListCategoryComponent
      );
      shapedFixture.componentRef.setInput('components', [config]);
      shapedFixture.detectChanges();

      const paths: SVGPathElement[] = Array.from(
        shapedFixture.nativeElement.querySelectorAll('svg path')
      );
      expect(
        paths.filter((path) => (path.getAttribute('d') ?? '').length > 0),
        `${config.symbol} renders a blank tile`
      ).not.toHaveLength(0);
    }
  });
});

describe('ComponentListCategoryComponent language reactivity', () => {
  it('re-renders a tile label when the active language changes', async () => {
    // The label comes from a template method rather than the *appTranslate
    // directive. Under zoneless change detection it stays live only because
    // translate() reads a post-load signal, and that read is tracked even
    // inside a method the template invokes.
    configureTestBed(
      [{ provide: TRANSLOCO_LOADER, useClass: TwoLangLoader }],
      [ComponentListCategoryComponent]
    );
    const transloco = TestBed.inject(TranslocoService);
    await firstValueFrom(transloco.load('en'));
    transloco.setActiveLang('en');

    const fixture = TestBed.createComponent(ComponentListCategoryComponent);
    fixture.componentRef.setInput('components', [andComponentConfig]);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('AND Gate');

    transloco.setActiveLang('de');
    await firstValueFrom(transloco.load('de'));
    // No forced detectChanges: whether the language change marks the view
    // dirty is the property under test. The zoneless fixture refreshes on
    // `whenStable()` only if that signal read was tracked.
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('UND-Gatter');
    expect(fixture.nativeElement.textContent).not.toContain('AND Gate');
  });
});
