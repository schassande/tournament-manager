import * as admin from 'firebase-admin';
import { Router, Request, Response } from 'express';
import {
  Attendee,
  FragmentRefereeAllocation,
  Tournament,
  TournamentRefereeAllocation,
} from './persistent-data-model';

export interface TournamentHomeResponse {
  tournament: Pick<Tournament, 'id' | 'name' | 'description' | 'startDate' | 'endDate' | 'venue' | 'city' | 'countryId' | 'timeZone' | 'allowPlayerReferees' | 'enablesModules'> & {
    days: Tournament['days'];
    fields: Tournament['fields'];
    divisions: Tournament['divisions'];
  };
  refereeCount: number;
  fullTimeRefereeCount: number;
  playerRefereeCount: number;
  playerRefereePercentage: number;
  pyramid: Array<{ level: number; male: { total: number; upgrade: number }; female: { total: number; upgrade: number } }>;
  gameCount: number;
  nbGamesAllocated: number;
  nbGamesToAllocate: number;
}

const pyramidRows = [
  { level: 0, maxOffset: 0 },
  { level: 1, maxOffset: 1 },
  { level: 2, maxOffset: 2 },
  { level: 3, maxOffset: 3 },
  { level: 4, maxOffset: 4 },
];

/** Returns the public, anonymized aggregate for a tournament home page. */
export async function getTournamentHome(tournamentId: string, firestore: admin.firestore.Firestore): Promise<TournamentHomeResponse | undefined> {
  const tournamentSnapshot = await firestore.collection('tournament').doc(tournamentId).get();
  if (!tournamentSnapshot.exists) return undefined;
  const tournament = tournamentSnapshot.data() as Tournament;
  const [attendeesSnapshot, gamesSnapshot, currentAllocationSnapshot] = await Promise.all([
    firestore.collection('attendee').where('tournamentId', '==', tournamentId).get(),
    firestore.collection('game').where('tournamentId', '==', tournamentId).get(),
    firestore.collection('tournament-referee-allocation')
      .where('tournamentId', '==', tournamentId).where('current', '==', true).limit(1).get(),
  ]);
  const attendees = attendeesSnapshot.docs.map(snapshot => snapshot.data() as Attendee);
  const referees = attendees.filter(attendee => attendee.isReferee === true);
  const playerReferees = referees.filter(attendee => Boolean(attendee.player?.teamId));
  const pyramid = pyramidRows.map(row => ({
    level: row.level,
    male: pyramidGenderCount(referees, row.maxOffset, 'M'),
    female: pyramidGenderCount(referees, row.maxOffset, 'F'),
  }));
  const counters = await readAllocationCounters(currentAllocationSnapshot, firestore);
  return {
    tournament: {
      id: tournamentId,
      name: tournament.name,
      description: tournament.description,
      startDate: tournament.startDate,
      endDate: tournament.endDate,
      venue: tournament.venue,
      city: tournament.city,
      countryId: tournament.countryId,
      timeZone: tournament.timeZone,
      allowPlayerReferees: tournament.allowPlayerReferees,
      enablesModules: tournament.enablesModules,
      days: (tournament.days ?? []).map(day => ({
        id: day.id,
        date: day.date,
        parts: day.parts.map(part => ({
          id: part.id,
          dayId: part.dayId,
          name: part.name,
          timeslots: part.timeslots.map(timeslot => ({ id: timeslot.id, start: timeslot.start, end: timeslot.end })),
        })),
      })) as Tournament['days'],
      fields: (tournament.fields ?? []).map(field => ({ id: field.id, name: field.name, quality: field.quality, video: field.video, orderView: field.orderView })),
      divisions: (tournament.divisions ?? []).map(division => ({
        id: division.id,
        name: division.name,
        shortName: division.shortName,
        backgroundColor: division.backgroundColor,
        fontColor: division.fontColor,
        teams: division.teams.map(team => ({ id: team.id, name: team.name, shortName: team.shortName, divisionName: team.divisionName })),
      })),
    },
    refereeCount: referees.length,
    fullTimeRefereeCount: referees.length - playerReferees.length,
    playerRefereeCount: playerReferees.length,
    playerRefereePercentage: referees.length === 0 ? 0 : playerReferees.length / referees.length * 100,
    pyramid,
    gameCount: gamesSnapshot.size,
    nbGamesAllocated: counters.nbGamesAllocated,
    nbGamesToAllocate: counters.nbGamesToAllocate,
  };
}

function pyramidGenderCount(referees: Attendee[], offset: number, gender: 'M' | 'F'): { total: number; upgrade: number } {
  const selected = referees.filter(referee => {
    const badge = referee.referee?.badge ?? 0;
    const system = referee.referee?.badgeSystem ?? 6;
    const normalizedGender = referee.person?.gender === 'F' ? 'F' : 'M';
    const distance = system - badge;
    const isPlayerReferee = Boolean(referee.player?.teamId);
    return normalizedGender === gender && (isPlayerReferee ? offset === 4 : (offset < 4 ? distance === offset : distance >= 4));
  });
  return {
    total: selected.length,
    upgrade: selected.filter(referee => Boolean(referee.referee?.upgrade && referee.referee.upgrade.badge !== 0)).length,
  };
}

async function readAllocationCounters(
  snapshot: admin.firestore.QuerySnapshot,
  firestore: admin.firestore.Firestore,
): Promise<{ nbGamesAllocated: number; nbGamesToAllocate: number }> {
  if (snapshot.empty) return { nbGamesAllocated: 0, nbGamesToAllocate: 0 };
  const allocation = snapshot.docs[0].data() as TournamentRefereeAllocation;
  const fragments = await Promise.all(allocation.fragmentRefereeAllocations.map(async descriptor => {
    const fragmentSnapshot = await firestore.collection('fragment-referee-allocation').doc(descriptor.id).get();
    return fragmentSnapshot.data() as FragmentRefereeAllocation | undefined;
  }));
  return fragments.reduce((total, fragment) => ({
    nbGamesAllocated: total.nbGamesAllocated + (fragment?.nbGamesAllocated ?? 0),
    nbGamesToAllocate: total.nbGamesToAllocate + (fragment?.nbGamesToAllocate ?? 0),
  }), { nbGamesAllocated: 0, nbGamesToAllocate: 0 });
}

/** Express router exposing the public tournament-home aggregate. */
export const tournamentHomeRouter = Router();
tournamentHomeRouter.get('/', async (request: Request, response: Response) => {
  const tournamentId = typeof request.query.tournamentId === 'string' ? request.query.tournamentId : '';
  if (!tournamentId) {
    response.status(400).json({ error: 'tournamentId is required' });
    return;
  }
  const result = await getTournamentHome(tournamentId, admin.firestore());
  if (!result) {
    response.status(404).json({ error: 'Tournament not found' });
    return;
  }
  response.json(result);
});
