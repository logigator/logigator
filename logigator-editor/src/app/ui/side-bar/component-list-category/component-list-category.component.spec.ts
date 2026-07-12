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
});

describe('ComponentListCategoryComponent language reactivity', () => {
  it('re-renders a tile label when the active language changes', async () => {
    // The label is produced by a template method (`text()` -> the translation
    // service) rather than the *transloco directive. Under zoneless change
    // detection this only stays live because the service's translate() reads a
    // signal that fires after the new language bundle loads, and that read is
    // tracked even though it happens inside a method invoked from the template.
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
    // No forced detectChanges: the label only updates if the language change
    // actually marks the view dirty, which is the property under test. The
    // auto-detecting zoneless fixture refreshes on `whenStable()` iff the signal
    // read inside the template-invoked `text()` was tracked.
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('UND-Gatter');
    expect(fixture.nativeElement.textContent).not.toContain('AND Gate');
  });
});
