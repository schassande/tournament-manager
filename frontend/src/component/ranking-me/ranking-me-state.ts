import { Attendee } from '@tournament-manager/persistent-data-model';

/** Inserts/moves at a dense final index, or removes when index is null; never mutates persisted inputs. */
export function moveRankedReferee(
  order: readonly string[],
  selected: readonly string[],
  id: string,
  index: number | null,
): string[] {
  if (!selected.includes(id)) return [...order];
  const next = order.filter((item) => item !== id);
  if (index !== null) next.splice(Math.max(0, Math.min(index, next.length)), 0, id);
  return next;
}

/** Orders unranked referees by descending level, then first name, surname and stable ID. */
export function compareUnrankedReferees(a: Attendee, b: Attendee): number {
  return (
    (b.referee?.badge ?? 0) - (a.referee?.badge ?? 0) ||
    (a.person?.firstName ?? '').localeCompare(b.person?.firstName ?? '') ||
    (a.person?.lastName ?? '').localeCompare(b.person?.lastName ?? '') ||
    a.id.localeCompare(b.id)
  );
}

/** Uses the common level/category/upgrade identity, retaining CLOSED missing-referee placeholders. */
export function rankingRefereeLabel(attendee: Attendee): string {
  if (!attendee.person) return 'Deleted referee';
  const info = attendee.referee;
  const prefix = info
    ? `L${info.badge}${info.category === 'O' ? '' : (info.category ?? '')}${(info.upgrade?.badge ?? 0) > 0 ? '*' : ''} `
    : '';
  return `${prefix}${attendee.person.firstName} ${attendee.person.lastName.toUpperCase()}`.trim();
}
