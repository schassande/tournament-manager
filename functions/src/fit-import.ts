import express from 'express';
import * as logger from 'firebase-functions/logger';

const FIT_API_BASE = 'https://www.internationaltouch.org/api/v1';

interface FitReference {
  title: string;
  slug: string;
  url?: string;
}

interface FitCompetition extends FitReference {
  seasons?: FitReference[];
}

interface FitSeason extends FitReference {
  divisions?: FitReference[];
}

interface FitTeam {
  id: number;
  title?: string;
  slug?: string;
  club?: {
    title?: string;
    short_title?: string;
    slug?: string;
    abbreviation?: string;
  } | null;
}

interface FitMatch {
  id: number;
  round?: string;
  date?: string;
  time?: string;
  datetime?: string;
  is_bye?: boolean;
  is_washout?: boolean;
  home_team?: number | null;
  away_team?: number | null;
  play_at?: { title?: string; timezone?: string } | null;
}

interface FitStage {
  matches?: FitMatch[];
  url?: string;
}

interface FitDivision extends FitReference {
  teams?: FitTeam[];
  stages?: FitStage[];
}

interface FitDownloadResponse {
  season: FitSeason;
  divisions: FitDivision[];
  excludedByes: number;
}

class FitApiError extends Error {
  public constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

/** Retrieves and validates a JSON document from the public FIT API. */
export async function fetchFitJson<T>(url: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
  } catch {
    throw new FitApiError(502, 'FIT API could not be reached.');
  }
  if (!response.ok) {
    throw new FitApiError(
      502,
      `FIT API returned HTTP ${response.status} for ${new URL(url).pathname}.`,
    );
  }
  try {
    return (await response.json()) as T;
  } catch {
    throw new FitApiError(502, 'FIT API returned invalid JSON.');
  }
}

/** Builds an API URL from a FIT path or follows a FIT URL returned by the API. */
function fitUrl(pathOrUrl: string): string {
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    const upstreamUrl = new URL(pathOrUrl);
    if (upstreamUrl.hostname !== 'www.internationaltouch.org') {
      throw new FitApiError(502, 'FIT API returned an unsupported URL.');
    }
    if (!upstreamUrl.searchParams.has('format')) {
      upstreamUrl.searchParams.set('format', 'json');
    }
    return upstreamUrl.toString();
  }
  const apiPath = pathOrUrl.replace(/^\/api\/v1(?=\/)/, '');
  const path = apiPath.startsWith('/') ? apiPath : `/${apiPath}`;
  return `${FIT_API_BASE}${path}${path.includes('?') ? '&' : '?'}format=json`;
}

/** Validates a path parameter before using it in an upstream URL. */
function requiredSlug(value: unknown, name: string): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(value)) {
    throw new FitApiError(
      400,
      `${name} is required and must be a valid FIT slug.`,
    );
  }
  return value;
}

/** Loads a division and any stage resources referenced by that division. */
export async function loadFitDivision(
  reference: FitReference,
  competitionSlug: string,
  seasonSlug: string,
): Promise<FitDivision> {
  const fallback = `/competitions/${encodeURIComponent(competitionSlug)}/seasons/${encodeURIComponent(seasonSlug)}/divisions/${encodeURIComponent(reference.slug)}/`;
  const divisionUrl = fitUrl(reference.url ?? fallback);
  const division = await fetchFitJson<FitDivision>(divisionUrl);
  const stages = await Promise.all(
    (division.stages ?? []).map((stage) =>
      stage.url
        ? fetchFitJson<FitStage>(fitUrl(stage.url)).catch((error: unknown) => {
            if (error instanceof FitApiError) {
              throw new FitApiError(
                error.statusCode,
                `${error.message} while loading stage of ${divisionUrl}.`,
              );
            }
            throw error;
          })
        : stage,
    ),
  );
  return { ...division, stages };
}

/** Handles GET /api/fitImport/competitions. */
export async function fitImportCompetitions(
  _request: express.Request,
  response: express.Response,
): Promise<void> {
  const competitions = await fetchFitJson<FitCompetition[]>(
    fitUrl('/competitions/'),
  );
  if (!Array.isArray(competitions))
    throw new FitApiError(502, 'FIT competitions response is invalid.');
  response.json(
    competitions.map(({ title, slug, url }) => ({ title, slug, url })),
  );
}

/** Handles GET /api/fitImport/competitions/:competitionSlug/seasons. */
export async function fitImportSeasons(
  request: express.Request,
  response: express.Response,
): Promise<void> {
  const competitionSlug = requiredSlug(
    request.params['competitionSlug'],
    'competitionSlug',
  );
  const competition = await fetchFitJson<FitCompetition>(
    fitUrl(`/competitions/${encodeURIComponent(competitionSlug)}/`),
  );
  if (!Array.isArray(competition.seasons))
    throw new FitApiError(502, 'FIT seasons response is invalid.');
  response.json(competition.seasons);
}

/** Handles the complete FIT download required to build the frontend FITData object. */
export async function downloadFitData(
  request: express.Request,
  response: express.Response,
): Promise<void> {
  const competitionSlug = requiredSlug(
    request.query['competitionSlug'],
    'competitionSlug',
  );
  const seasonSlug = requiredSlug(request.query['season'], 'season');
  const season = await fetchFitJson<FitSeason>(
    fitUrl(
      `/competitions/${encodeURIComponent(competitionSlug)}/seasons/${encodeURIComponent(seasonSlug)}/`,
    ),
  );
  if (!Array.isArray(season.divisions))
    throw new FitApiError(502, 'FIT divisions response is invalid.');
  const loadedDivisions = await Promise.all(
    season.divisions.map((division) =>
      loadFitDivision(division, competitionSlug, seasonSlug),
    ),
  );
  const excludedByes = loadedDivisions.reduce(
    (count, division) =>
      count +
      (division.stages ?? []).reduce(
        (stageCount, stage) =>
          stageCount +
          (stage.matches ?? []).filter((match) => match.is_bye === true).length,
        0,
      ),
    0,
  );
  const divisions = loadedDivisions.map((division) => ({
    ...division,
    stages: (division.stages ?? []).map((stage) => ({
      ...stage,
      matches: (stage.matches ?? []).filter((match) => match.is_bye !== true),
    })),
  }));
  response.json({
    season,
    divisions,
    excludedByes,
  } satisfies FitDownloadResponse);
}

/** Converts backend and upstream errors into the documented JSON error contract. */
function handleError(error: unknown, response: express.Response): void {
  const fitError =
    error instanceof FitApiError
      ? error
      : new FitApiError(500, 'Unable to load FIT data.');
  if (!(error instanceof FitApiError))
    logger.error('FIT import request failed', error);
  response.status(fitError.statusCode).json({ error: fitError.message });
}

/** Express router exposing the browser-safe FIT proxy endpoints. */
export const fitImportRouter = express.Router();
fitImportRouter.get('/competitions', (request, response) => {
  fitImportCompetitions(request, response).catch((error) =>
    handleError(error, response),
  );
});
fitImportRouter.get(
  '/competitions/:competitionSlug/seasons',
  (request, response) => {
    fitImportSeasons(request, response).catch((error) =>
      handleError(error, response),
    );
  },
);
fitImportRouter.get('/download', (request, response) => {
  downloadFitData(request, response).catch((error) =>
    handleError(error, response),
  );
});
