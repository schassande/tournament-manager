import { ModulesNames } from '@tournament-manager/persistent-data-model';

/** Describes a module displayed in tournament configuration workflows. */
export interface TournamentFeatureOption {
  module: ModulesNames;
  name: string;
  description: string;
}

/** Lists the modules that can be enabled for a tournament. */
export const TOURNAMENT_FEATURES: TournamentFeatureOption[] = [
  { module: 'RANKING', name: 'Ranking', description: 'Ranking of the top N referees by Referee Coaches.' },
  { module: 'UPGRADE', name: 'Upgrade', description: 'Determination of referee upgrades for referees seeking the next badge.' },
  { module: 'SCORECARD', name: 'Scorecard', description: 'Printable pre-filled score sheets for games and referees.' },
  { module: 'DRAW_DESIGNER', name: 'Draw Designer', description: 'Construction of the sporting formula and allocation of games.' },
  { module: 'ONLINE_WATER_CARRIER', name: 'Online Water Carrier', description: 'Referees can self-allocate to games as Water Carriers.' },
  { module: 'PRINTED_WATER_CARRIER', name: 'Printed Water Carrier', description: 'Print a schedule for manually assigning Water Carriers.' },
  { module: 'AUTOMATIC_ALLOCATION', name: 'Auto allocation', description: 'Configurable allocation of referees and Referee Coaches to games.' },
  { module: 'FIT_IMPORT', name: 'FIT Import', description: 'Import games from an international competition organized by FIT.' },
];
