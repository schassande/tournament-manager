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
    badgeSystem: RefereeCoachBadgeSystem; // badge system of the referee coach
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

export interface RefereeBadgeColor {
  /** Badge system */
  badgeSystem: number;
  /** Badge level */
  badge: number;
  /** Background color */
  background: string;
  /** Font color */
  font: string;
}
/** Badge colors depending on the badge system */
export const RefereeBadgeColors: RefereeBadgeColor[] = [
  { badgeSystem: 4, badge: 1, background: 'green',  font: 'white' },
  { badgeSystem: 4, badge: 2, background: 'blue',   font: 'white' },
  { badgeSystem: 4, badge: 3, background: 'red',    font: 'white' },
  { badgeSystem: 4, badge: 4, background: 'black',  font: 'white' },

  { badgeSystem: 5, badge: 1, background: '#254192',   font: 'white' },
  { badgeSystem: 5, badge: 2, background: '#0394A5',  font: 'white' },
  { badgeSystem: 5, badge: 3, background: 'yellow', font: 'black' },
  { badgeSystem: 5, badge: 4, background: 'red',    font: 'white' },
  { badgeSystem: 5, badge: 5, background: 'black',  font: 'white' },

  { badgeSystem: 6, badge: 1, background: 'orange', font: 'white' },
  { badgeSystem: 6, badge: 2, background: 'violet', font: 'white' },
  { badgeSystem: 6, badge: 3, background: 'green',  font: 'white' },
  { badgeSystem: 6, badge: 4, background: 'blue',   font: 'white' },
  { badgeSystem: 6, badge: 5, background: 'red',    font: 'white' },
  { badgeSystem: 6, badge: 6, background: 'black',  font: 'white' }
];