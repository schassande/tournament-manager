export interface RefereeInfo {
  badge: number; // badge of the referee
  badgeSystem: RefereeBadgeSystem; // badge system of the referee coach
  upgrade?: { // Looking for upgrade of the referee
    badge: number; // badge of the referee. 0 means no upgrade
    badgeSystem: RefereeBadgeSystem; // badge system of the referee coach
  };
  category: RefereeCategory; // category of the referee
}
export interface RefereeCoachInfo {
  badge: number; // badge of the referee coach
  badgeSystem: RefereeCoachBadgeSystem; // badge system of the referee coach
  upgrade?: { // Looking for upgrade of the referee Coach
    badge: number; // badge of the referee  Coach
    badgeSystem: RefereeBadgeSystem; // badge system of the referee coach
  };
  fontColor: string;
  backgroundColor: string;
}

export type RefereeCategory =
  'J' // Junior
  | 'O' // Open
  | 'S' // Senior
  | 'M'; // Master


export type RefereeBadgeSystem = 4 | 5 | 6;
export type RefereeCoachBadgeSystem = 3 | 4 | 5 | 6;
