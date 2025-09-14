import * as admin   from 'firebase-admin';
import * as express from "express";
import * as logger from "firebase-functions/logger";
import { 
  Attendee, 
  colGame, colGameAttendeeAllocation, colTournamentRefereeAllocation, colFragmentRefereeAllocation,
  colTournamentRefereeAllocationStatistics, colFragmentRefereeAllocationStatistics, colTournament, 
  Field, FragmentRefereeAllocation, FragmentRefereeAllocationStatistics,
  Game, GameAttendeeAllocation, 
  isReferee, 
  isRefereeCoach, 
  Tournament, TournamentRefereeAllocation, TournamentRefereeAllocationStatistics,
  CommonRefereeAllocationStatistics} from '@tournament-manager/persistent-data-model'
import { checkParameter } from './common-parameters';
import { byId, byIdRequired, create, dateToEpoch, deleteById, save } from './common-persistence';
import { DataCache } from './data-cache';



export let coachingsRouter = express.Router();

// POST /api/tournament/:tournamentId/allocation/:allocationId/referee-stats?gameId=XXX
coachingsRouter.get("/:id", async function getReferee(req: express.Request, res: express.Response) {
    // if (!tool.ensureApiKey(req, res)) return;
  const firestore: admin.firestore.Firestore = admin.firestore();
  const id = req.params.id;
  const elem = (await firestore.collection('coaching').doc(id).get()).data();
  res.status(200).send(elem);
});

/**
 * The allocation on a game has been changed. It required to compute the statistics of 
 * all current and previous attendes to the game.
 * @param fullAllocationId 
 * @param partAllocationId 
 * @param gameId 
 * @param removedAttendeeIds
 * @param firestore 
 */
async function computeRefereeStatisticsOnGame(
  tournamentAllocationId: string, 
  fragmentAllocationId: string, 
  gameId: string, 
  removedAttendeeIds: string[],
  firestore: admin.firestore.Firestore) {
  
  checkParameter(gameId, 'gameId');
  const game: Game = await byIdRequired(colGame, gameId, firestore);
  logger.debug('Game', JSON.stringify(game));
  
  const tournamentAllocation: TournamentRefereeAllocation = await byIdRequired(colTournamentRefereeAllocation, tournamentAllocationId, firestore)
  logger.debug('FullRefereeAllocation', JSON.stringify(tournamentAllocation));
  const fragmentAllocation: FragmentRefereeAllocation = await byIdRequired(colFragmentRefereeAllocation, tournamentAllocationId, firestore)
  logger.debug('FullRefereeAllocation', JSON.stringify(fragmentAllocation));
  if (tournamentAllocation.tournamentId !== game.tournamentId) {
    throw new Error('Game identifier and Tournament allocation identifier do not correspond to the same tournament!');
  }
  if (fragmentAllocation.tournamentId !== game.tournamentId) {
    throw new Error('Game identifier and Fragment allocation identifier do not correspond to the same tournament!');
  }
  const tournament: Tournament = await byIdRequired(colTournament, tournamentAllocation.tournamentId, firestore)

  const cache: DataCache = new DataCache(firestore);
  
  const attendedReferees: GameAttendeeAllocation[] = await getGameReferees(fragmentAllocation.id, gameId, firestore);
  
  const toRecomputeAttendeeIds = new Set((removedAttendeeIds ?  removedAttendeeIds : [])
    .concat(attendedReferees.map(a => a.attendeeId)));
  toRecomputeAttendeeIds.forEach(async attendeeId => {
    // compute statistics for the referee over the fragment
    const newFragementStats = await computeRefereeStatistic(tournament, fragmentAllocation, attendeeId, cache);
    // save this new statistics (maybe replace)
    await saveFragmentRefereeAllocationStatistics(newFragementStats, fragmentAllocationId,firestore);
    // link the fragment to the Tournament stats (create if required)
    await assignFragmentToTournamentRefereeAllocationStatistics(newFragementStats, tournamentAllocationId, firestore);
  });
}
/**
 * Save the stats about a referee
 * @param newFragementStats the new stats
 * @param fragmentAllocationId the identifier of the fragment allocation
 * @param firestore connection to the database
 */
async function saveFragmentRefereeAllocationStatistics(
  newFragementStats: FragmentRefereeAllocationStatistics, 
  fragmentAllocationId: string,
  firestore: admin.firestore.Firestore) {
  const oldFragementStats = await getFragementRefereeAllocationStatistics(newFragementStats.refereeAttendeeId, fragmentAllocationId, firestore)
  if (oldFragementStats) {
    // keep the same identifier
    newFragementStats.id = oldFragementStats.id;
    // Replace the old object with the new one
    logger.debug('Modify the FragmentRefereeAllocationStatistics for the referee:', newFragementStats.refereeAttendeeId);
    save(colFragmentRefereeAllocationStatistics, newFragementStats, firestore);
  } else {
    logger.debug('Create a new FragmentRefereeAllocationStatistics for the referee:', newFragementStats.refereeAttendeeId);
    create(colFragmentRefereeAllocationStatistics, newFragementStats, firestore);
  }
}

/**
 * Assign the fragment referee stats (FragmentRefereeAllocationStatistics) to the tournament 
 * referee stats (TournamentRefereeAllocationStatistics). If the TournamentRefereeAllocationStatistics does exist
 * it is created. 
 * @param newFragementStats the new stats
 * @param tournamentAllocationId the identifier of the tournament allocation
 * @param firestore connection to the database
 */
async function assignFragmentToTournamentRefereeAllocationStatistics(
  newFragementStats: FragmentRefereeAllocationStatistics,
  tournamentAllocationId: string,
  firestore: admin.firestore.Firestore) {
  let tStats = await getTournamentRefereeAllocationStatistics(
    newFragementStats.refereeAttendeeId, tournamentAllocationId, firestore)
  const createObject:boolean = !tStats;
  if (tStats) {
    const otherIds = tStats.fragmentsStatisticsIds.filter(fsId => fsId !== newFragementStats.id);
    const allFragStats: FragmentRefereeAllocationStatistics[] = await Promise.all(
        otherIds.map(async fsId => await byId<FragmentRefereeAllocationStatistics>(colFragmentRefereeAllocationStatistics, fsId, firestore))
      ).then(fss => fss.filter(fs => fs) as FragmentRefereeAllocationStatistics[]);
    allFragStats.push(newFragementStats);
    computeTournamentRefereeAllocationStatistics(tStats, allFragStats);
  } else {
    tStats = {
      id: '',
      lastChange: 0,
      fragmentsStatisticsIds: [],
      tournamentId: newFragementStats.tournamentId,
      refereeAttendeeId: newFragementStats.refereeAttendeeId,
      tournamentRefereeAllocationId: tournamentAllocationId,
      tournamentStatistics: {...newFragementStats}
    }
  }

  // Link the fragment stats to the tournament stats
  if (tStats.fragmentsStatisticsIds.findIndex(id => id === newFragementStats.id) < 0) {
    tStats.fragmentsStatisticsIds.push(newFragementStats.id);
  }

  // Save the tournament stats
  if (createObject) {
    logger.debug('Create a new TournamentRefereeAllocationStatistics for the referee:', tStats.refereeAttendeeId);
    create(colTournamentRefereeAllocationStatistics, tStats, firestore);
  } else {
    logger.debug('Modify the TournamentRefereeAllocationStatistics for the referee:', tStats.refereeAttendeeId);
    save(colTournamentRefereeAllocationStatistics, tStats, firestore);
  }
}
/**
 * Compute the tournament stats based on a list of Fragment stats
 * @param tournamentStats the tournament stats to recompute
 * @param fragStats the list of fragment stats
 * @returns 
 */
async function computeTournamentRefereeAllocationStatistics(
  tournamentStats: TournamentRefereeAllocationStatistics,
  fragStats: FragmentRefereeAllocationStatistics[]
  ): Promise<TournamentRefereeAllocationStatistics> {
    const tStats = tournamentStats.tournamentStatistics;

  // Initialise tournament stats
  tStats.buddies = [];
  tStats.buddiesBadgeAvg = 0;
  tStats.teams = [];
  tStats.coaching.averageCoachingLevel = 0;
  tStats.coaching.nbCoachedGames = 0;
  tStats.firstTimeSlotIdx = 1000;
  tStats.lastTimeSlotIdx = 0;
  tStats.gameIds = [];
  tStats.games = [];
  tStats.nbGamesOnBadField = 0;
  tStats.nbGamesOnVideo = 0;
  tStats.lastAttendeeAlloc = 0;
  tournamentStats.fragmentsStatisticsIds = [];

  // iterate over Fragments to combine each fragment stats to the tournament stats
  fragStats.forEach((fs: FragmentRefereeAllocationStatistics) => {
    fs.buddies.forEach(buddy => {
      const idx = tStats.buddies.findIndex(b => buddy.buddyAttendeeId === b.buddyAttendeeId);
      if (idx < 0) {
        tStats.buddies.push({...buddy});
      } else {
        tStats.buddies[idx].nbGames += buddy.nbGames;
      }
    });
    fs.teams.forEach(team => {
      const idx = tStats.teams.findIndex(t => team.teamId === t.teamId);
      if (idx < 0) {
        tStats.teams.push({...team});
      } else {
        tStats.teams[idx].nbGames += team.nbGames;
      }
    });
    if ((tStats.coaching.nbCoachedGames + fs.coaching.nbCoachedGames) > 0) {
      tStats.coaching.averageCoachingLevel = 
        ((tStats.coaching.averageCoachingLevel * tStats.coaching.nbCoachedGames)
        + (fs.coaching.averageCoachingLevel * fs.coaching.nbCoachedGames)) 
        / (tStats.coaching.nbCoachedGames + fs.coaching.nbCoachedGames);
      tStats.coaching.nbCoachedGames += fs.coaching.nbCoachedGames;
    }
    
    tStats.firstTimeSlotIdx = Math.min(tStats.firstTimeSlotIdx, fs.firstTimeSlotIdx);
    tStats.lastTimeSlotIdx = Math.max(tStats.lastTimeSlotIdx, fs.lastTimeSlotIdx);

    tStats.gameIds = tStats.gameIds.concat(fs.gameIds);
    tStats.games = tStats.games.concat(fs.games);
    tStats.nbGamesOnBadField += fs.nbGamesOnBadField;
    tStats.nbGamesOnVideo += fs.nbGamesOnVideo;

    tStats.lastAttendeeAlloc = Math.max(tStats.lastAttendeeAlloc, fs.lastAttendeeAlloc);

    tournamentStats.fragmentsStatisticsIds.push(fs.id);
  });
  computebuddiesBadgeAvg(tStats);

  return tournamentStats;
}

/**
 * Create the referee statistics (RefereeAllocationStatisticsPartDay) for a referee over a 
 * PartRefereeAllocation in a tournament.
 * Algo: It search all games in the allocation where the referee is allocated. Then for each game 
 * it builds the satistics about this referee.
 * 
 * @param tournament is the tournament
 * @param partAllocation is PartRefereeAllocation 
 * @param attendeeId is the identifier of the referee (Attendee.id)
 * @param cache is a data cache used to limit database accesses.
 * @returns A complete statistic (RefereeAllocationStatisticsPartDay) of a referee over a PartRefereeAllocation in a tournament.
 */
async function computeRefereeStatistic(
  tournament: Tournament, 
  fragmentAllocation: FragmentRefereeAllocation, 
  attendeeId: string, 
  cache: DataCache): Promise<FragmentRefereeAllocationStatistics> {
  // Step 1: Load all gameIds of the referee
  const gameIds: string[] = await getAttendeeGameIds(fragmentAllocation.id, attendeeId, cache.firestore);

  const refStats: FragmentRefereeAllocationStatistics =  {
    id: '',
    lastChange: dateToEpoch(new Date()),
    refereeAttendeeId: attendeeId,
    tournamentId: tournament.id,
    lastAttendeeAlloc: 0,
    dayId: fragmentAllocation.dayId,
    partDayId: fragmentAllocation.partDayId,
    fragmentRefereeAllocationId: fragmentAllocation.id,
    gameIds: [],
    nbGamesOnBadField: 0,
    nbGamesOnVideo: 0,
    firstTimeSlotIdx: 1000,
    lastTimeSlotIdx: -1,
    coaching: {
      nbCoachedGames: 0,
      averageCoachingLevel: -1
    },
    buddiesBadgeAvg: 0,
    buddies: [], // { buddyAttendeeId: string; nbGames: number; badge: number;}
    teams: [], //{ teamId: string; divisionId: string; nbGames: number; }
    games: [] // { gameId: string; divisionId: string; divisionShortName: string; timeSlotId: string; refereeCoachAttendeeIds: string[];}
  }

  // Step 2: Load all referees and coach of all games and adjust statistics
  gameIds.forEach(async gameId => {
    completeRefereStatsWithGame(attendeeId, refStats, tournament, gameId, fragmentAllocation, cache);
  });

  // Step 3: Compute the buddies average level over all games.
  computebuddiesBadgeAvg(refStats);

  // End: return the stats
  return refStats;
}

function computebuddiesBadgeAvg(stats: CommonRefereeAllocationStatistics) {
  const buddiesLevelData = [0,0];
  stats.buddies.forEach(bs => {
    if (bs.badge !== undefined){
      buddiesLevelData[0] += bs.badge;
      buddiesLevelData[1]++;
    }
  });
  stats.buddiesBadgeAvg = buddiesLevelData[1] === 0 ? 0 : buddiesLevelData[0] / buddiesLevelData[1]; 
}
/**
 * Complete the referee statistics with information about a game. 
 * This game is linked to a PartRefereeAllocation and a tournament.
 * @param attendeeId is the identifier of the attendee (referee)
 * @param refStats is the current statistic of the referee for the RefereeAllocationStatisticsPartDay
 * @param tournament is the tournament of the game
 * @param gameId is the identifier of the game.
 * @param partAllocation is the PartRefereeAllocation
 * @param cache is the data cache used to limit the query on the database.
 */
async function completeRefereStatsWithGame(
  attendeeId: string, 
  refStats: FragmentRefereeAllocationStatistics, 
  tournament: Tournament,
  gameId: string,
  partAllocation: FragmentRefereeAllocation,
  cache: DataCache
  ) {
  const game: Game = await byIdRequired(colGame, gameId, cache.firestore);
  const attendees: GameAttendeeAllocation[] = await getGameAttendees(partAllocation.id, gameId, cache.firestore);
  const refereeCoaches: Attendee[] = await Promise.all(attendees
    .filter(ar => isRefereeCoach(ar.attendeeRole))
    .map(a => cache.getRefereeCoach(a.attendeeId)));
  const referees: Attendee[] = await Promise.all(attendees
    .filter(ar => isReferee(ar.attendeeRole))
    .map(a => cache.getReferee(a.attendeeId)));
  const division = tournament.divisions.find(d => d.id === game.divisionId)!;
  const teamIds = [game.homeTeamId, game.awayTeamId];

  refStats.lastAttendeeAlloc = Math.max(
    refStats.lastAttendeeAlloc, 
    attendees.map(a => a.lastChange).reduce((a,b) => Math.max(a,b)));

  // field info
  const field: Field = tournament.fields.find(field => field.id === game.fieldId)!;
  if (field.quality < 2) refStats.nbGamesOnBadField++;
  if (field.video) refStats.nbGamesOnVideo++;

  // game info
  refStats.gameIds.push(game.id);
  refStats.games.push({
    gameId: game.id, 
    divisionId: division.id,
    divisionShortName: division.shortName,
    timeSlotId: game.timeslotId,
    refereeCoachAttendeeIds: refereeCoaches.map((rc: Attendee) => rc.id)
  });
  const gameTimeSlotIdx = computeGameTimeSlotIdx(game, tournament);
  refStats.firstTimeSlotIdx = Math.min(gameTimeSlotIdx, refStats.firstTimeSlotIdx);
  refStats.lastTimeSlotIdx = Math.max(gameTimeSlotIdx, refStats.lastTimeSlotIdx);


  // coaching
  if (refereeCoaches.length > 0) {
    const avg =  average(refereeCoaches.map((rc: Attendee) => rc.refereeCoach!.badge))
    if (refStats.coaching.nbCoachedGames === 0) {
      refStats.coaching.averageCoachingLevel = avg;
    } else {
      refStats.coaching.averageCoachingLevel = 
        (refStats.coaching.averageCoachingLevel * refStats.coaching.nbCoachedGames + avg) 
        / (refStats.coaching.nbCoachedGames+1);
    }
    refStats.coaching.nbCoachedGames++
  }

  // buddies
  referees.forEach((r:Attendee) => {
    const buddyAttendeeId = r.id;
    if (buddyAttendeeId !== attendeeId) { // exclude current referee as buddy
      let buddyStat = refStats.buddies.find(b => b.buddyAttendeeId == buddyAttendeeId);
      if (buddyStat) {
        buddyStat.nbGames++;
      } else {
        buddyStat = { buddyAttendeeId, nbGames: 1};
        if (r.referee) {
          buddyStat.badge = r.referee.badge;
        }
        refStats.buddies.push(buddyStat);
      }
    }
  });

  // teams
  teamIds.forEach(teamId => {
    let teamStat = refStats.teams.find(t => t.teamId === teamId);
    if (teamStat) {
      teamStat.nbGames++;
    } else {
      refStats.teams.push({teamId, divisionId: division.id, nbGames: 1});
    }
  });
}
function average(numbers: number[]): number {
  return numbers.length > 0 ? numbers.reduce((a,b) => a+b) / numbers.length : 0;
}

function computeGameTimeSlotIdx(game: Game, tournament: Tournament): number {
  const dayIdx = tournament.days.findIndex(d => d.id === game.dayId);
  const day = tournament.days[dayIdx];
  const partIdx = day.parts.findIndex(p => p.id === game.partDayId);
  const part = day.parts[partIdx];
  return part.timeslots.findIndex(ts => ts.id === game.timeslotId);
}

/**
 * Fetch all the Attendees of the game in a given PartRefereeAllocation
 * @param partAllocationId identifier of a PartRefereeAllocation
 * @param gameId is a game idenfier
 * @param firestore is the database connection
 * @returns an array of GameAttendeeAllocation. All attendees of the game.
 */
async function getGameAttendees(
  partAllocationId: string,
  gameId: string,
  firestore: admin.firestore.Firestore): Promise<GameAttendeeAllocation[]> {
  let query:admin.firestore.Query<admin.firestore.DocumentData> = firestore.collection(colGameAttendeeAllocation)
    .where('refereeAllocationId', '==', partAllocationId)
    .where('gameId', '==', gameId);
  return (await query.get()).docs.filter(e => e.exists).map(e => e.data() as GameAttendeeAllocation);
}
/**
 * Fetch all Referee Attendees (full time referees, player referees ...) 
 * @param partAllocationId identifier of a PartRefereeAllocation
 * @param gameId is a game idenfier
 * @param firestore is the database connection
 * @returns an array of GameAttendeeAllocation. All referees of the game.
 */
async function getGameReferees(
  partAllocationId: string,
  gameId: string, 
  firestore: admin.firestore.Firestore): Promise<GameAttendeeAllocation[]> {
  const attendees = await getGameAttendees(partAllocationId, gameId, firestore);
  return attendees.filter(ar => isReferee(ar.attendeeRole));
}

/**
 * Fetch all Referee coaches Attendees (full time, partial ...) 
 * @param partAllocationId identifier of a PartRefereeAllocation
 * @param gameId is a game idenfier
 * @param firestore is the database connection
 * @returns an array of GameAttendeeAllocation. All referee coaches of the game.
 */
async function getAttendeeGameIds(
  allocationId: string, 
  attendeeId: string, 
  firestore: admin.firestore.Firestore): Promise<string[]> {
  let query:admin.firestore.Query<admin.firestore.DocumentData> = firestore.collection(colGameAttendeeAllocation)
    .where('refereeAllocationId', '==', allocationId)
    .where('attendeeId', '==', attendeeId);
  return (await query.get()).docs.filter(e => e.exists).map(e => e.data() as GameAttendeeAllocation).map(ar => ar.gameId);
}

async function getFragementRefereeAllocationStatistics(
  attendeeId: string, 
  fragmentRefereeAllocationId: string,
  firestore: admin.firestore.Firestore): Promise<FragmentRefereeAllocationStatistics|undefined> {
  let query:admin.firestore.Query<admin.firestore.DocumentData> = firestore.collection(colFragmentRefereeAllocationStatistics)
    .where('refereeAttendeeId', '==', attendeeId)
    .where('fragmentRefereeAllocationId', '==', fragmentRefereeAllocationId);
  const list = (await query.get()).docs.filter(e => e.exists).map(e => e.data() as FragmentRefereeAllocationStatistics);
  if (!list || list.length === 0) {
    return undefined;
  } else if (list.length === 1) {
    return list[0];
  } else {
    logger.error(list.length +' FragmentRefereeAllocationStatistics instance for a referee in an allocation, return the more recent object.');
    const moreRecent = list.reduce((a1,a2) => a1.lastAttendeeAlloc > a2.lastAttendeeAlloc ? a1 : a2);
    list.forEach(async a => {
      if (a.id !== moreRecent.id) {
        logger.error('Deleting duplicat FragmentRefereeAllocationStatistics instance for a referee in an allocation: identifier='+a.id);
        await deleteById(colFragmentRefereeAllocationStatistics, a.id, firestore);
      }
    });
    return moreRecent;
  }

}

async function getTournamentRefereeAllocationStatistics(
  attendeeId: string, 
  tournamentRefereeAllocationId: string,
  firestore: admin.firestore.Firestore): Promise<TournamentRefereeAllocationStatistics|undefined> {
  let query:admin.firestore.Query<admin.firestore.DocumentData> = firestore.collection(colTournamentRefereeAllocationStatistics)
    .where('refereeAttendeeId', '==', attendeeId)
    .where('tournamentRefereeAllocationId', '==', tournamentRefereeAllocationId);
  const list = (await query.get()).docs.filter(e => e.exists).map(e => e.data() as TournamentRefereeAllocationStatistics);
  if (!list || list.length === 0) {
    return undefined;
  } else if (list.length === 1) {
    return list[0];
  } else {
    logger.error(list.length +' TournamentRefereeAllocationStatistics instance for a referee in an allocation, return the more recent object.');
    const moreRecent = list.reduce((a1,a2) => a1.lastChange > a2.lastChange ? a1 : a2);
    list.forEach(async a => {
      if (a.id !== moreRecent.id) {
        logger.error('Deleting duplicat TournamentRefereeAllocationStatistics instance for a referee in an allocation: identifier='+a.id);
        await deleteById(colTournamentRefereeAllocationStatistics, a.id, firestore);
      }
    });
    return moreRecent;
  }

}