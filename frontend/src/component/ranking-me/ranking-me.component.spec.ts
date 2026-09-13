import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import {
  Attendee,
  createTournamentRefereeRanking,
  prepareIndividualRanking,
} from '@tournament-manager/persistent-data-model';
import { moveRankedReferee } from './ranking-me-state';
import { RankingMeComponent } from './ranking-me.component';

describe('Coach ranking interactions', () => {
  const parent = {
    ...createTournamentRefereeRanking('t', 'coach', 'Finals'),
    id: 'ranking',
    status: 'INDIVIDUAL_RANKING' as const,
    nbRefereesToRank: 2,
    selectedRefereeAttendeeIds: ['a', 'b', 'c'],
  };
  const referees = [
    {
      id: 'a',
      person: { firstName: 'Alex', lastName: 'Zulu' },
      referee: { badge: 2, category: 'S', upgrade: { badge: 3 } },
    },
    { id: 'b', person: { firstName: 'Alex', lastName: 'Alpha' }, referee: { badge: 2, category: 'O' } },
    { id: 'c', person: { firstName: 'Zoe', lastName: 'Alpha' }, referee: { badge: 3, category: 'S' } },
  ] as Attendee[];

  /** Renders the real list, action buttons and lock toggle without creating a vote. */
  function setup() {
    TestBed.configureTestingModule({ imports: [RankingMeComponent], providers: [provideNoopAnimations()] });
    const fixture = TestBed.createComponent(RankingMeComponent);
    fixture.componentRef.setInput('ranking', parent);
    fixture.componentRef.setInput('referees', referees);
    fixture.componentRef.setInput('coachId', 'coach');
    fixture.componentRef.setInput('coachName', 'Coach');
    fixture.componentRef.setInput('authorized', true);
    fixture.detectChanges();
    return fixture;
  }

  it('sorts unranked referees and provides N+1 positions, identity format and target separator', () => {
    const fixture = setup();
    expect(fixture.componentInstance.available().map((item) => item.id)).toEqual(['c', 'b', 'a']);
    expect(fixture.componentInstance.slots()).toEqual([0, 1, 2]);
    expect(fixture.nativeElement.textContent).toContain('L2S* Alex ZULU');
    expect(fixture.nativeElement.textContent).toContain('L2 Alex ALPHA');
    expect(fixture.nativeElement.querySelector('[role="separator"]')).not.toBeNull();
  });

  it('shows only the explanation in CONFIGURE and restores editing in the individual phase', () => {
    const fixture = setup();
    fixture.componentRef.setInput('ranking', { ...parent, status: 'CONFIGURE' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.ranking-lists')).toBeNull();
    expect(fixture.nativeElement.querySelector('#coach-ranking-lock')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Individual vote');
    fixture.componentRef.setInput('ranking', parent);
    fixture.detectChanges();
    const add = fixture.nativeElement.querySelector('button[aria-label="Add L3S Zoe ALPHA"]') as HTMLButtonElement;
    const row = fixture.nativeElement.querySelector('[aria-label="Unranked referees"] .referee-row') as HTMLElement;
    expect(add.disabled).toBeFalse();
    expect(row.draggable).toBeTrue();
  });

  it('sizes the lists to long names without wrapping when horizontal space is available', () => {
    const fixture = setup();
    const host = fixture.nativeElement as HTMLElement;
    host.style.display = 'block';
    host.style.width = '1600px';
    fixture.componentRef.setInput('referees', [
      {
        ...referees[0],
        person: {
          firstName: 'Alexandre Guillaume',
          lastName: 'Chassande de la Longue Montagne',
        },
      } as Attendee,
    ]);
    fixture.detectChanges();
    const names = Array.from(host.querySelectorAll<HTMLElement>('.identity'));
    const name = names.find((item) => item.textContent?.includes('Alexandre'))!;
    const range = document.createRange();
    range.selectNodeContents(name);
    expect(range.getClientRects().length).toBe(1);
    expect(name.getBoundingClientRect().width).toBeGreaterThanOrEqual(range.getBoundingClientRect().width);
    expect(name.closest('section')!.getBoundingClientRect().width).toBeGreaterThan(200);
  });

  it('uses real accessible Add buttons and retains persisted data until the page commits', () => {
    const fixture = setup();
    const emit = spyOn(fixture.componentInstance.changes, 'emit');
    (fixture.nativeElement.querySelector('button[aria-label="Add L3S Zoe ALPHA"]') as HTMLButtonElement).click();
    expect(emit).toHaveBeenCalledOnceWith({ rankedRefereeAttendeeIds: ['c'] });
    expect(fixture.componentInstance.order()).toEqual([]);
  });

  it('partitions selected referees through insert, move, trailing drop and removal', () => {
    let order: string[] = [];
    for (const [id, position] of [
      ['a', 9],
      ['b', 0],
      ['c', 1],
      ['a', 0],
      ['c', null],
    ] as const) {
      order = moveRankedReferee(order, parent.selectedRefereeAttendeeIds, id, position);
      expect(new Set(order).size).toBe(order.length);
      expect(order.every((item) => parent.selectedRefereeAttendeeIds.includes(item))).toBeTrue();
    }
    expect(order).toEqual(['a', 'b']);
    expect(moveRankedReferee(order, parent.selectedRefereeAttendeeIds, 'outside', 0)).toEqual(order);
  });

  it('drops into a trailing slot, cancels without saving, and removes only on an actual outside drop', () => {
    const fixture = setup();
    const component = fixture.componentInstance;
    fixture.componentRef.setInput(
      'individual',
      prepareIndividualRanking(parent, null, 'coach', 'coach', { rankedRefereeAttendeeIds: ['a'] }).individual,
    );
    fixture.detectChanges();
    const emit = spyOn(component.changes, 'emit');
    component.startDrag(new DragEvent('dragstart'), 'a');
    component.cancelDrag();
    expect(emit).not.toHaveBeenCalled();
    component.startDrag(new DragEvent('dragstart'), 'b');
    component.dropRanked(new DragEvent('drop'), 10);
    expect(emit).toHaveBeenCalledWith({ rankedRefereeAttendeeIds: ['a', 'b'] });
    component.startDrag(new DragEvent('dragstart'), 'a');
    component.dropOutside(new DragEvent('drop'));
    expect(emit).toHaveBeenCalledWith({ rankedRefereeAttendeeIds: [] });
  });

  it('hides row actions while locked and restores them when unlocked', () => {
    const fixture = setup();
    const individual = prepareIndividualRanking(parent, null, 'coach', 'coach', {
      rankedRefereeAttendeeIds: ['a'],
    }).individual;
    for (const locked of [false, true, false]) {
      fixture.componentRef.setInput('individual', { ...individual, locked });
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('.pi-arrow-right').length).toBe(locked ? 0 : 2);
      expect(fixture.nativeElement.querySelectorAll('.drag-handle').length).toBe(locked ? 0 : 1);
      expect(fixture.nativeElement.querySelectorAll('.identity').length).toBe(3);
    }
  });

  it('locks an empty vote using the actual toggle and blocks reordering while locked', () => {
    const fixture = setup();
    const component = fixture.componentInstance;
    const emit = spyOn(component.changes, 'emit');
    (fixture.nativeElement.querySelector('#coach-ranking-lock') as HTMLInputElement).click();
    expect(emit).toHaveBeenCalledWith({ locked: true });
    fixture.detectChanges();
    expect((fixture.nativeElement.querySelector('#coach-ranking-lock') as HTMLInputElement).checked).toBeFalse();
    fixture.componentRef.setInput(
      'individual',
      prepareIndividualRanking(parent, null, 'coach', 'coach', { locked: true }).individual,
    );
    fixture.detectChanges();
    emit.calls.reset();
    component.move('a', 0);
    expect(emit).not.toHaveBeenCalled();
    (fixture.nativeElement.querySelector('#coach-ranking-lock') as HTMLInputElement).click();
    expect(emit).toHaveBeenCalledWith({ locked: false });
  });

  it('routes native drag/drop and keyboard shortcuts on the bars icon through the same dense transformation', () => {
    const fixture = setup();
    const component = fixture.componentInstance;
    fixture.componentRef.setInput(
      'individual',
      prepareIndividualRanking(parent, null, 'coach', 'coach', { rankedRefereeAttendeeIds: ['a', 'b'] }).individual,
    );
    fixture.detectChanges();
    const emit = spyOn(component.changes, 'emit');
    const source = fixture.nativeElement.querySelector('[aria-label="Unranked referees"] .referee-row') as HTMLElement;
    const rankedRows = fixture.nativeElement.querySelectorAll(
      '[aria-label="Coach ranked referees"] .referee-row',
    ) as NodeListOf<HTMLElement>;
    const transfer = new DataTransfer();
    const preview = spyOn(transfer, 'setDragImage');
    const bounds = source.getBoundingClientRect();
    source.dispatchEvent(
      new DragEvent('dragstart', {
        bubbles: true,
        dataTransfer: transfer,
        clientX: bounds.left + 10,
        clientY: bounds.top + 10,
      }),
    );
    expect(preview.calls.mostRecent().args[0] instanceof HTMLCanvasElement).toBeTrue();
    const dragImage = document.querySelector('.referee-drag-preview') as HTMLElement;
    expect(dragImage).not.toBe(source);
    expect(dragImage.parentElement).toBe(document.body);
    expect(dragImage.textContent).toBe(source.textContent);
    expect(dragImage.getBoundingClientRect().width).toBeCloseTo(source.getBoundingClientRect().width, 0);
    expect(getComputedStyle(dragImage).position).toBe('fixed');
    expect(getComputedStyle(dragImage).backgroundColor).toBe('rgb(255, 255, 255)');
    expect(getComputedStyle(dragImage).opacity).toBe('1');
    expect(getComputedStyle(dragImage).pointerEvents).toBe('none');
    expect(dragImage.inert).toBeTrue();
    rankedRows[1].dispatchEvent(
      new DragEvent('dragover', {
        bubbles: true,
        cancelable: true,
        clientX: 300,
        clientY: 200,
      }),
    );
    expect(dragImage.style.transform).toBe('translate(290px, 190px)');
    fixture.detectChanges();
    expect(getComputedStyle(rankedRows[1]).marginTop).toBe('30px');
    expect(getComputedStyle(source).opacity).toBe('0');
    expect(source.getBoundingClientRect().height).toBe(bounds.height);
    expect(getComputedStyle(dragImage).opacity).toBe('1');
    rankedRows[1].dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(dragImage.isConnected).toBeFalse();
    expect(getComputedStyle(source).opacity).toBe('1');
    expect(rankedRows[1].classList.contains('drop-gap')).toBeFalse();
    expect(emit).toHaveBeenCalledOnceWith({ rankedRefereeAttendeeIds: ['a', 'c', 'b'] });
    emit.calls.reset();
    rankedRows[0].dispatchEvent(new DragEvent('dragstart', { bubbles: true }));
    fixture.detectChanges();
    expect(getComputedStyle(rankedRows[0]).opacity).toBe('0');
    rankedRows[0].dispatchEvent(new DragEvent('dragend', { bubbles: true }));
    fixture.detectChanges();
    expect(getComputedStyle(rankedRows[0]).opacity).toBe('1');
    expect(emit).not.toHaveBeenCalled();
    const handles = fixture.nativeElement.querySelectorAll('.drag-handle') as NodeListOf<HTMLElement>;
    expect(handles.length).toBe(2);
    expect(fixture.nativeElement.querySelector('[aria-label="Coach ranked referees"] button')).toBeNull();
    expect(handles[0].querySelector('.pi-equals')).not.toBeNull();
    handles[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(emit).toHaveBeenCalledWith({ rankedRefereeAttendeeIds: ['b', 'a'] });
    handles[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    expect(emit).toHaveBeenCalledWith({ rankedRefereeAttendeeIds: ['a'] });
  });

  for (const ending of ['cancel', 'outside', 'context', 'destroy']) {
    it(`cleans up the opaque drag preview on ${ending}`, () => {
      const fixture = setup();
      const source = fixture.nativeElement.querySelector('.referee-row') as HTMLElement;
      source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: new DataTransfer() }));
      const preview = document.querySelector('.referee-drag-preview') as HTMLElement;
      expect(preview).not.toBeNull();
      document.dispatchEvent(new DragEvent('dragleave'));
      expect(preview.style.visibility).toBe('hidden');
      document.dispatchEvent(new DragEvent('dragover'));
      expect(preview.style.visibility).toBe('visible');

      if (ending === 'cancel') source.dispatchEvent(new DragEvent('dragend', { bubbles: true }));
      if (ending === 'outside') document.dispatchEvent(new DragEvent('drop', { cancelable: true }));
      if (ending === 'context') {
        fixture.componentRef.setInput('busy', true);
        fixture.detectChanges();
      }
      if (ending === 'destroy') fixture.destroy();
      expect(preview.isConnected).toBeFalse();
      expect(fixture.componentInstance.dragging()).toBeNull();
    });
  }

  it('renders CLOSED placeholders without editing or creating records and prioritizes the empty selection', () => {
    const fixture = setup();
    fixture.componentRef.setInput('ranking', { ...parent, status: 'CLOSED' });
    fixture.componentRef.setInput('referees', []);
    fixture.componentRef.setInput(
      'individual',
      prepareIndividualRanking(parent, null, 'coach', 'coach', { rankedRefereeAttendeeIds: ['a'] }).individual,
    );
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Deleted referee');
    expect(fixture.componentInstance.canReorder()).toBeFalse();
    fixture.componentRef.setInput('ranking', { ...parent, selectedRefereeAttendeeIds: [] });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent.trim()).toBe('Configure referees first');
  });

  it('disables every mutation when the actor cannot edit the selected coach, while keeping the vote visible', () => {
    const fixture = setup();
    fixture.componentRef.setInput(
      'individual',
      prepareIndividualRanking(parent, null, 'coach', 'coach', { rankedRefereeAttendeeIds: ['a'] }).individual,
    );
    fixture.componentRef.setInput('authorized', false);
    fixture.detectChanges();
    const emit = spyOn(fixture.componentInstance.changes, 'emit');
    expect(fixture.nativeElement.textContent).toContain('requires both coaches to be selected');
    expect(fixture.nativeElement.textContent).toContain('Coach ranking (1 / 2)');
    expect((fixture.nativeElement.querySelector('#coach-ranking-lock') as HTMLInputElement).disabled).toBeTrue();
    expect(
      (fixture.nativeElement.querySelector('button[aria-label^="Add "]') as HTMLButtonElement).disabled,
    ).toBeTrue();
    fixture.componentInstance.move('a', null);
    fixture.componentInstance.toggleLock(true);
    expect(emit).not.toHaveBeenCalled();
  });

  it('cancels a drag when switching between coaches without records and shows an empty-target explanation', () => {
    const fixture = setup();
    fixture.componentInstance.startDrag(new DragEvent('dragstart'), 'a');
    fixture.componentRef.setInput('coachId', 'other');
    fixture.detectChanges();
    expect(fixture.componentInstance.dragging()).toBeNull();
    fixture.componentRef.setInput('coachId', '');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent.trim()).toBe('Configure coaches first');
    expect(fixture.nativeElement.querySelector('.ranking-lists')).toBeNull();
  });
});
