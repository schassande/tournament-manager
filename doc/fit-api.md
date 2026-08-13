# FIT Public API

## Purpose and scope

This document describes the public HTTP API of the Federation of International Touch (FIT) website, observed on 13 August 2026. It provides read-only data about competitions, seasons, divisions, teams, stages and matches.

Base URL: `https://www.internationaltouch.org/api/v1`

The examples below use `european-youth-touch-championships`, season `2024`, division `mixed-15`. Available values may change; therefore, clients should follow URLs and slugs returned by the API instead of hard-coding them.

## Common HTTP call

- Method: `GET`.
- Recommended header: `Accept: application/json`.
- Query parameter: `format=json`.
- Response: UTF-8 JSON.
- Numeric fields are returned as numbers, except for some standings statistics (`difference`, `percentage`, `points`), which were observed as decimal strings.
- Observed responses contain neither a `results` envelope nor pagination information.
- Clients must handle HTTP errors and JSON error responses; an unknown slug must not be treated as an empty collection.

In the URLs below, segments in braces are slugs or identifiers and should be URL-encoded when necessary.

## Level 1 — competition collection

### URL

```text
GET /competitions/?format=json
```

Full URL: <https://www.internationaltouch.org/api/v1/competitions/?format=json>

### Parameters

| Parameter | Required | Description |
|---|---:|---|
| `format` | recommended | Set to `json` to request a JSON response. |

### Response format

The response is an array of competitions:

```json
[
  {
    "title": "European Youth Touch Championships",
    "slug": "european-youth-touch-championships",
    "url": "https://www.internationaltouch.org/api/v1/competitions/european-youth-touch-championships/?format=json"
  }
]
```

Each item contains:

- `title` (`string`): displayed competition name.
- `slug` (`string`): identifier used in subsequent URLs.
- `url` (`string`): canonical URL of the competition resource.

## Level 2 — competition details and seasons

### URL

```text
GET /competitions/{competitionSlug}/?format=json
```

Example: <https://www.internationaltouch.org/api/v1/competitions/european-youth-touch-championships/?format=json>

### Parameters

| Parameter | Required | Description |
|---|---:|---|
| `competitionSlug` | yes | `slug` returned by level 1. |
| `format` | recommended | Set to `json`. |

### Response format

```json
{
  "title": "European Youth Touch Championships",
  "slug": "european-youth-touch-championships",
  "url": ".../competitions/european-youth-touch-championships/?format=json",
  "seasons": [
    {
      "title": "2024",
      "slug": "2024",
      "url": ".../seasons/2024/?format=json"
    }
  ]
}
```

`seasons` is an array of seasons. Each season has `title`, `slug` and `url` (`string`). The title is for display; the slug is used in the level 3 URL.

## Level 3 — season details and divisions

### URL

```text
GET /competitions/{competitionSlug}/seasons/{seasonSlug}/?format=json
```

Example: <https://www.internationaltouch.org/api/v1/competitions/european-youth-touch-championships/seasons/2024/?format=json>

### Parameters

| Parameter | Required | Description |
|---|---:|---|
| `competitionSlug` | yes | Competition slug. |
| `seasonSlug` | yes | Season slug returned by level 2, for example `2024`. |
| `format` | recommended | Set to `json`. |

### Response format

```json
{
  "title": "2024",
  "slug": "2024",
  "url": ".../seasons/2024/?format=json",
  "divisions": [
    {
      "title": "Mixed 15",
      "slug": "mixed-15",
      "url": ".../divisions/mixed-15/?format=json"
    }
  ],
  "referees": []
}
```

- `title`, `slug`, `url`: season identity.
- `divisions`: array of division references (`title`, `slug`, `url`).
- `referees`: season-level referee data; it was empty in the observed example, but clients must not assume it is always empty.

## Level 4 — division details

### URL

```text
GET /competitions/{competitionSlug}/seasons/{seasonSlug}/divisions/{divisionSlug}/?format=json
```

Example: <https://www.internationaltouch.org/api/v1/competitions/european-youth-touch-championships/seasons/2024/divisions/mixed-15/?format=json>

### Parameters

| Parameter | Required | Description |
|---|---:|---|
| `competitionSlug` | yes | Competition slug. |
| `seasonSlug` | yes | Season slug. |
| `divisionSlug` | yes | Division slug returned by level 3. |
| `format` | recommended | Set to `json`. |

### Response format

```json
{
  "title": "Mixed 15",
  "slug": "mixed-15",
  "url": ".../divisions/mixed-15/?format=json",
  "teams": [],
  "stages": []
}
```

### `teams`

Array of teams in the division:

```json
{
  "id": 1439,
  "title": "Belgium",
  "slug": "belgium",
  "club": {
    "title": "Belgium",
    "short_title": "Touch Belgium",
    "slug": "belgium",
    "abbreviation": "BEL",
    "status": "active",
    "url": "https://www.internationaltouch.org/api/v1/clubs/belgium/?format=json",
    "facebook": "...",
    "twitter": "@touchbelgium",
    "youtube": "",
    "website": "http://www.touch-belgium.be/"
  }
}
```

`id` is the numeric identifier referenced by `home_team` and `away_team` in matches. Social and website fields may be empty strings. Clients should treat `club` as potentially null or incomplete.

### `stages`

Array of stages. Each stage contains:

- `title`, `slug`, `url` (`string`);
- `matches`: array of matches;
- `ladder_summary`: stage standings/statistics;
- `pools`: array of pools, sometimes empty.

## Level 5 — stages and matches

A stage is normally included in the division response. Its hypermedia URL can also be called directly:

```text
GET /competitions/{competitionSlug}/seasons/{seasonSlug}/divisions/{divisionSlug}/stages/{stageSlug}/?format=json
```

Example: <https://www.internationaltouch.org/api/v1/competitions/european-youth-touch-championships/seasons/2024/divisions/mixed-15/stages/round-robin/?format=json>

The observed structure is the same substructure: `title`, `slug`, `url`, `matches`, `ladder_summary`, `pools`.

### Match format

```json
{
  "id": 9081,
  "uuid": "d82d72e2-4f4c-4c23-800b-571ba3b1ddaf",
  "round": "Round 1",
  "date": "2024-08-16",
  "time": "09:20:00",
  "datetime": "2024-08-16T07:20:00Z",
  "is_bye": false,
  "is_washout": false,
  "home_team": 1442,
  "home_team_score": 14,
  "away_team": 1443,
  "away_team_score": 6,
  "stage_group": null,
  "referees": [],
  "videos": ["https://youtu.be/..."],
  "play_at": {
    "id": 281,
    "title": "Field 1",
    "abbreviation": "F1",
    "timezone": "Europe/Paris"
  }
}
```

| Field | Type / value | Description |
|---|---|---|
| `id` | `number` | Stable match identifier used by the importer. |
| `uuid` | `string` | Match UUID. The historical code also uses `uuid` to identify byes. |
| `round` | `string` | Round label (`Round 1`, `Gold Medal`, etc.). |
| `date` | `YYYY-MM-DD` | Displayed local match date. |
| `time` | `HH:mm:ss` | Displayed local match time. |
| `datetime` | ISO-8601 UTC | Timestamp, with a `Z` suffix in the observed example. |
| `is_bye` | `boolean` | True for a bye/fictitious fixture; exclude it from played matches. |
| `is_washout` | `boolean` | Indicates a match cancelled because of weather. |
| `home_team`, `away_team` | `number` or missing/`None` | References to `teams[].id`, not team names. |
| `home_team_score`, `away_team_score` | `number` or missing | Scores; may be unset before the match. |
| `stage_group` | value or `null` | Optional pool/group. |
| `referees` | array | Assigned referees; empty in the tested responses. |
| `videos` | array or `null` | Video links; may be `null` or contain URLs. |
| `play_at` | object or missing | Venue/field: `id` (`number`), `title`, `abbreviation`, `timezone` (`string`). |

For importing, resolve team references through `teams` and obtain the field from `play_at.title` (for example, `Field 1`). `datetime` is the safest value for converting an instant; `date` and `time` remain the local display fields.

### `ladder_summary`

Array of standings entries for a stage. An observed entry contains `team` (`number`), `stage_group` (`null` or a value), `played`, `win`, `loss`, `draw`, `bye`, `forfeit_for`, `forfeit_against`, `score_for`, `score_against`, and `bonus_points` (numbers), plus `difference`, `percentage`, and `points` (decimal strings in the observed responses).

### `pools`

Array of pools. It was empty in the tested stages; its structure was not required for the importer and must not be inferred from an empty array.

## Referenced club resource

Teams expose a club URL, for example:

```text
GET /clubs/{clubSlug}/?format=json
```

This resource is not required to retrieve matches: club information is already included in `teams[].club`. It may be followed to obtain or verify club metadata. The observed schema includes `title`, `short_title`, `slug`, `abbreviation`, `status`, `url`, `facebook`, `twitter`, `youtube` and `website`.

## Recommended competition import workflow

1. Call level 1 and select `competition.slug`.
2. Call level 2 and select `seasons[].slug`.
3. Call level 3 and iterate over `divisions[]`.
4. For each division, call its `url` and index `teams` by `id`.
5. Iterate over every `stage` and concatenate `stage.matches`.
6. Exclude matches where `is_bye === true`; retain `is_washout` separately.
7. Resolve `home_team` and `away_team` through the team index and use `play_at` for the field.

This workflow matches the algorithm in `FIT-games-import.md`: the season response is used to discover divisions, then each division is loaded to obtain stages and matches.

## Limitations and precautions

- This is an observed public API; no OpenAPI contract was provided in the tested responses. Optional fields must therefore be tolerated.
- Season data may change after the initial import (schedule, field, score, referees, video).
- Do not confuse `id` and `uuid`: the API provides both.
- Do not assume that `referees`, `videos`, `pools`, `play_at` or `club` are always non-empty.
- Parameters are path segments, not query parameters; `format=json` is the only observed query parameter.
