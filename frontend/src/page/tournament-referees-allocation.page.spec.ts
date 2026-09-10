import { FragmentRefereeAllocationService } from '../service/fragment-referee-allocation.service';

describe('tournament referee allocation page', () => {
  it('computes the rounded allocated-games percentage', () => {
    expect(FragmentRefereeAllocationService.computeAllocatedGamesPercentage(3, 2)).toBe(67);
  });

  it('does not compute a percentage without the remaining-games statistic', () => {
    expect(FragmentRefereeAllocationService.computeAllocatedGamesPercentage(3, undefined)).toBeUndefined();
  });

  it('does not compute a percentage for an empty fragment', () => {
    expect(FragmentRefereeAllocationService.computeAllocatedGamesPercentage(0, 0)).toBeUndefined();
  });
});
