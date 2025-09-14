import { PersistentObject, WithId } from "./persistence";
import { AttendeeRole } from "./referee";

export interface GameAttendeeAllocation extends PersistentObject {
  tournamentId: string; // identifier of the tournament
  fragmentRefereeAllocationId?: string; // identifier of the fragment referee allocation
  gameId: string; // identifier of the game
  attendeeId: string; // identifier of the referee (Attendee.id)
  attendeeRole: AttendeeRole; // role of the attendee
  attendeePosition: number;
  half: number; // half of the game where the attendee is allocated
}

/**
 * A tournament referee allocation is a combination of fragment referee allocation.
 * A fragment can be reused accross several TournamentRefereeAllocation.
 * For a tournament, several TournamentRefereeAllocation can exist but one and 
 * only one can be the 'current' (see field @current)
 */
export interface TournamentRefereeAllocation extends PersistentObject {
  name: string; // Name of the allocation
  tournamentId: string; // unique identifier of the tournament
  current: boolean; // true if the tournament allocation is the current one
  fragmentRefereeAllocations: FragmentRefereeAllocationDesc[]; // list of the allocation fragment identifier
}

export interface FragmentRefereeAllocationDesc extends WithId {
  dayId: string;
  partDayId?: string;
}

export interface FragmentRefereeAllocation extends FragmentRefereeAllocationDesc, PersistentObject {
  name: string; // Name of the allocation
  tournamentId: string; // unique identifier of the tournament
  refereeAllocatorAttendeeIds: string[]; // list of the authors identifier of the referee allocation (Attendee.id)
  refereeCoachAllocatorAttendeeIds: string[]; // list of authors identifier of the author of the referee coach allocation (Attendee.id)
  visible: boolean; // true if the allocation is visible
}


export interface CommonRefereeAllocationStatistics {
  lastAttendeeAlloc: number // epoc number of the last attendee allocation on all games.
  gameIds: string[]; // list of game identifier where the refere is allocated.
  nbGamesOnBadField: number; // number of games on bad fields
  nbGamesOnVideo: number; // number of streamed games
  firstTimeSlotIdx: number; // first time slot of the game
  lastTimeSlotIdx: number; // first time slot of the game
  coaching: {
    nbCoachedGames: number; // number of games coached by a referee coach
    averageCoachingLevel: number; // Average level of the coaching
  };
  buddies: {
    buddyAttendeeId: string;
    nbGames: number; // number of games allocated to the buddy
    badge?: number;
  }[];
  buddiesBadgeAvg: number;
  teams: {
    teamId: string; // unique identifier of the team
    divisionId: string; // unique identifier of the division
    nbGames: number;
  }[];
  games: {
    gameId: string; // unique identifier of the game
    divisionId: string; // unique identifier of the division
    divisionShortName: string
    timeSlotId: string; // unique identifier of the timeslot
    refereeCoachAttendeeIds: string[]; // List of coach during the games
  }[]; // list of game ids allocated to the referee
}

/**
 * Statistics about a referee and its allocation over the tournament.
 * It can define a combination of fragement allocation statistics
 */
export interface TournamentRefereeAllocationStatistics extends PersistentObject {
  refereeAttendeeId: string; // identifier of the referee (Attendee.id)
  tournamentId: string; // identifier of the tournament
  tournamentRefereeAllocationId: string; // identifier of the Tournament referee allocation
  tournamentStatistics: CommonRefereeAllocationStatistics; // The overall statistics over the tournament
  fragmentsStatisticsIds: string[]; // identifier of the FragmentRefereeAllocationStatistics. The statistics about the referee for each allocation fragement
}

/**
 * Statistics about a referee and its allocation over only a fragment of the allocation
 */
export interface FragmentRefereeAllocationStatistics extends CommonRefereeAllocationStatistics, PersistentObject {
  refereeAttendeeId: string; // identifier of the referee (Attendee.id)
  dayId: string; // fragment definition: identifier of the day
  partDayId?: string; // fragment definition: identifier of the part of the day (Optional)
  tournamentId: string; // identifier of the tournament
  fragmentRefereeAllocationId: string; // identifier of the Fragement referee allocation
}
