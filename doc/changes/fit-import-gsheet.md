
## GSheet code

Voici le d'une google sheet qui effectue le téléchargement des données d'une competition. Tu peux t'inspirer de ce code pour comprendre l'API.


```
const spreadsheet = SpreadsheetApp.getActive();
const nbMaxDay = 10;
function onOpen() {
  const gameImportMenu = SpreadsheetApp.getUi().createMenu('Games import');
  for(let day = 1; day<=nbMaxDay; day++) {
    gameImportMenu.addItem('Import day '+day+' games into Tournament Info','syncDay'+day);    
  }  
  SpreadsheetApp.getUi().createMenu('Totem')
    .addItem('1.Download data from FIT web site','synchroCompetitionManagerFIT')
    .addItem('2.Import Teams into Tournament Info','syncTeams')
    .addItem('3.Import Timeslots into Tournament Info','syncTimeSlots')    
    .addSeparator()
    .addSubMenu(gameImportMenu)
    .addSeparator()
    .addItem('Export referee appointments to FIT web site','collectRefereesFromAppointments')    
    .addSeparator()
    .addItem('Clean data','cleanData')
    .addItem('For Dev Set Version','setVersion')
    .addToUi();
}
function setVersion() {
  const version = new Date().toISOString();
  SpreadsheetApp.getActive().getSheetByName('Version').getRange('A2').setValue(version);
  Browser.msgBox('Version has been set to: '+version);
}
/**
 * Download and format matches from the FIT web site
 * use 3 data from the spread sheet:
 * Sheet('Sources').B5 : the FIT competition name
 * Sheet('Sources').B6 : the FIT competition year
 * Sheet('Sources').B7 : the number of hours to add to the FIT time
 * 
 * It fills the Sheet Orphan and Day X
 * 
 * @Last update: 24 july 2022
 * @Author S.Chassande-Barrioz
 */
function synchroCompetitionManagerFIT() {

  var sourcesSheet = spreadsheet.getSheetByName('Sources');
  const competitionName = sourcesSheet.getRange('B3').getValue();
  const competitionSeason = sourcesSheet.getRange('B4').getValue();
  const timeZone = sourcesSheet.getRange('B5').getValue();
  const capitalizeTeamsNames = sourcesSheet.getRange('B6').getValue();

  sourcesSheet.getRange('B10').setValue('Importing...');
  sourcesSheet.getRange('B11:B20').clearContent();

  Logger.log('Getting data from the FIT web site for the competition \'' + competitionName  + '\' ' + competitionSeason);
  const divisions = getFullDivisions(competitionName, competitionSeason);
  let matches = [];
  divisions.forEach(division => {
    division.stages.forEach(stage => {
      stage.matches.forEach(match => {
        match.comp = division.title;
      });
      const smatches = stage.matches.filter(match => !match.is_bye);
      matches = [...matches, ...smatches];
    });
  });
  const teamNames = loadNComputeTeamNames(divisions, capitalizeTeamsNames);
  sourcesSheet.getRange('B10').setValue(new Date());
  sourcesSheet.getRange('B10').setNumberFormat('dd/MM/yyyy HH:mm:ss');
  
  const isByeGameIds = getIsByeGameIds(divisions);
  if (isByeGameIds.length > 0) {
    matches = matches.filter(m => isByeGameIds.indexOf(m.id) < 0);
  }
  
  Logger.log("Transforming data");
  
  adjustCategoryNaming(matches);
  adjustFieldNaming(matches);

  matches.forEach(m => transformMatch(m, timeZone, teamNames, divisions));
  const category2teams = extractTeams(matches);
  const day2matches = splitByDay(matches);
  const day2timeslots = extractTimeSlots(day2matches);

  writeTeams(spreadsheet, sourcesSheet, category2teams);
  writeTeamNames(spreadsheet, teamNames);
  writeTimeSlots(spreadsheet, sourcesSheet, day2timeslots);
  writeGames(spreadsheet, sourcesSheet, day2matches);

  Logger.log('End.');
}


/**
 * Gets the divisions from the FIT web site for a competition
 * @param competitionName is the name of the competition on FIT web site
 * @param competitionSeason is the year of the competition on FIT web site
 */
function getDivisions(competitionName, competitionSeason) {
  const formsAPIUrl = 'https://www.internationaltouch.org/api/v1/competitions/' + competitionName + '/seasons/' + competitionSeason + '/?format=json';
  const options = {
    'headers': {
      Accept: 'application/json'
    },
    'method': 'get'
  };  
  const divisions = JSON.parse(UrlFetchApp.fetch(formsAPIUrl, options));
  // Logger.log('Response from forms.responses was: ' + JSON.stringify(divisions, null, 2));
  return divisions
}
/**
 * Gets the division from the FIT web site for a competition
 * @param competitionName is the name of the competition on FIT web site
 * @param competitionSeason is the year of the competition on FIT web site
 * @param divisionName is the short name of the division
 */
function getDivision(competitionName, competitionSeason, divisionName) {
  Logger.log('getDivision: ' + competitionName + '/' + competitionSeason + '/' + divisionName);
  const formsAPIUrl = 'https://www.internationaltouch.org/api/v1/competitions/' + competitionName + '/seasons/' 
                      + competitionSeason + '/divisions/' + divisionName + '/?format=json';
  const options = {
    'headers': {
      Accept: 'application/json'
    },
    'method': 'get'
  };  
  const division = JSON.parse(UrlFetchApp.fetch(formsAPIUrl, options));
  // Logger.log('Response from forms.responses was: ' + JSON.stringify(division, null, 2));
  return division
}
function getFullDivisions(competitionName, competitionSeason) {
  const competition = getDivisions(competitionName, competitionSeason)
  return competition.divisions.map(div => getDivision(competitionName, competitionSeason, div.slug));
}

function getIsByeGameIds(divisions) {
  let isByeGameIds = [];
  divisions.forEach(division => {
    division.stages.forEach(stage => {
      const gameIds = stage.matches.filter(m => m.is_bye === true).map(m => m.uuid);
      isByeGameIds = isByeGameIds.concat(gameIds);
    });
  });
  return isByeGameIds;
}
/**
 * Load manual renaming and compute team names 
 * @param divisions: array of Division
 * @param capitalizeTeamsNames flag indicating if the team name must be capitalized
 * @return {
 *    teamNames: TeamStructure[],
 *    id2teamName: Map<teamId, TeamStructure>
 *   }
 * with TeamStructure: {
 *      division: Division, 
 *      team: Team,
 *      autoName: string,
 *      manualName: string
 *    }
 */
function loadNComputeTeamNames(divisions, capitalizeTeamsNames) {
  // load renaming from gsheet
  const teamRenamingSheet = spreadsheet.getSheetByName('Team Renaming');
  const manualRenaming = new Map();
  teamRenamingSheet.getRange('A4:D200').getDisplayValues().forEach(row => {
    const divSlug = row[0];
    const teamSlug = row[1];
    const newTeamName = row[3];
    if (divSlug && teamSlug && newTeamName) {
      manualRenaming.set(divSlug+'/'+teamSlug, newTeamName);
    }
  });

  // Compute the team names and the build a structure
  const teamNames = [];
  divisions.forEach(division => {
    division.teams.forEach(team => {
      let teamName;
      if (!team.club && team.title) {
        teamName = team.title;
      } else if (team.club.abbreviation) {
        teamName = team.club.abbreviation;
        if (team.club.slug) {
          const nbs = team.club.slug.match(/\d+/g);
          if (nbs) {
            teamName = teamName + nbs.join("");
          }
        }
      } else if (team.club.slug) {
        teamName = team.club.slug;
      } else if (team.club.short_title) {
        teamName = team.club.short_title;
      } else if (team.club.title) {
        teamName = team.club.title;
      }
      if (capitalizeTeamsNames) {
        teamName = teamName.toUpperCase();
      } else {
        teamName = teamName.charAt(0).toUpperCase() + teamName.substring(1).toLowerCase()
      }
      teamNames.push({
        division: division, 
        team: team,
        autoName: teamName,
        manualName: manualRenaming.get(division.slug+'/'+team.slug)
      });
    });
  });
  const id2teamName = new Map();
  teamNames.forEach(teamName => {
    id2teamName.set(teamName.team.id, teamName);
    // Logger.log(teamName.team.id+'=>'+teamName);
  });
  return { teamNames, id2teamName };
}
/**
 * Transform the Match objet. It adds new fields
 * timeSlot: String representing HH:MM
 * field: number. -1 means no information
 * day: date as string YYYY-MM-DD
 * what: the type of the game: Pool or ....
 * resultRequired: Yes if the match is not a pool game.
 * teamA: upper first letter, lower the rest
 * teamB: upper first letter, lower the rest
 * category: Category/division of the team in 3 letters max
 * 
 * @param match
 * @param timeZone
 * @param teamNames
 * @param divisions
 * @param teamRename : Map<string(division.slug/team.slug), string(new team name)>
 */
function transformMatch(match, timeZone, teamNames, divisions) {
  Logger.log(match);
  if (!match.location && match.play_at) {
    match.location = match.play_at.title;
  }
  if (!match.field) {
    match.field = match.location ? Number.parseInt(match.location.substring(6)) : -1;
  }
  if (match.scheduledStartTime) {
    const date = new Date(match.scheduledStartTime);
    match.timeSlot = getTimeSlot(date, timeZone);
    match.day = getDay(date);
    // Logger.log(match.scheduledStartTime + ' => ' + match.day + ' --- ' + match.timeSlot + ' --- ' + date.getTimezoneOffset());
  } else if (match.date && match.time) {
    const date = new Date(match.date);
    match.timeSlot = match.time;
    match.day = getDay(date);
  } else {
    match.timeSlot = '';
    match.day = '';
  }
  const what = match.round ? match.round.split(' ').map(elem => elem.trim().toLowerCase()) : [];
  if (what.length > 1 && what[0] === 'round') {
    match.what = 'Pool'
    match.resultRequired = 'No';
  } else if (Number.parseInt(match.round, 10)) {
    match.what = 'Pool'
    match.resultRequired = 'No';
  } else {
    match.what = match.round;
    match.resultRequired = 'Yes';
  }

  // compute team names
  const division = divisions.find(div => div.title === match.comp);
  if (!division) {
    console.error('Division "'+match.comp+'" is unknown.');
    return;
  }
  let dMatch;
  division.stages.find(s => {
    const m3 = s.matches.find(m2 => m2.id === match.id);
    if (m3) dMatch = m3;
  });
  if (!dMatch) {
    console.error('Match "'+match.id+'" is unknown.');
    return;
  }
  if (dMatch.is_bye) {
    console.error('Match "'+match.id+'" should be removed.');
  }
  match.teamA = getTeamName(dMatch.home_team, teamNames);
  match.teamB = getTeamName(dMatch.away_team, teamNames);
}
function getTeamName(teamId, teamNames) {
  if (!teamId || teamId === 'None') return undefined;
  const teamStruct = teamNames.id2teamName.get(teamId);
  if (!teamStruct) {
    Logger.log('Error: Team with Id '+teamId+' has not been found.')
    return '';
  }
  return teamStruct.manualName ? teamStruct.manualName : teamStruct.autoName;
}

/** 
 * Build a Map of matches sorted by day
 * @param matches (Match[]) is the array of the match from FIT web site
 * @return Map<String,Match[]>. Key is the date as string (YYYY-MM-DD). Value is an array of the Match
 */
function splitByDay(matches) {
  const day2matches = new Map();
  matches.forEach( match => {
    let dayMatches = day2matches.get(match.day);
    if (!dayMatches) {
      dayMatches = [];
    }
    dayMatches.push(match);
    if (match.day) dayMatches.sort((m1, m2) => sortMatches(m1, m2));
    day2matches.set(match.day, dayMatches);
  });
  return day2matches;
}

/**
 * Extract the teams per division/category from the matches
 * @return Map<string,string[]>, key is the category name, value is the array of team name
 */
function extractTeams(matches) {
  const category2teams = new Map();
  matches.forEach( match => {
    let teams = category2teams.get(match.category);
    if (!teams) {
      teams = [];
    }
    if (match.teamA && match.teamA.length > 0 && teams.indexOf(match.teamA) < 0) {
      teams.push(match.teamA);
      teams.sort();
    }
    if (match.teamB && match.teamB.length > 0 && teams.indexOf(match.teamB) < 0) {
      teams.push(match.teamB);
      teams.sort();
    }
    category2teams.set(match.category, teams);
  });
  return category2teams;
}

function adjustCategoryNaming(matches) {
  const divisionSheet = spreadsheet.getSheetByName('Division Renaming');
  const categoryNaming = new Map();

  // read renaming data from the sheet
  // A: FIT name of the category
  // B: Automatic name computed by the program
  // C: manuel name set by the user 
  const renaming = divisionSheet.getRange('A4:C23').getValues();
  // console.log(renaming);

  // for each match apply a renaming of the categories
  matches.forEach( match => {
    // match.comp is the FIT name of the category
    const initial = match.comp;
    let cat = categoryNaming.get(initial);
    if (!cat) {
      // category not already managed
      // search if the user set a manuel renaming
      const ren = renaming.find(ren => ren[0] === match.comp && ren[2] && ren[2].trim().length > 0);
      const manual = ren ? ren[2] : undefined;
      const automatic = toCategory(match.comp); // computed the automatic renaming at least for information
      const category = manual ? manual : automatic; // new category name is the manual choice by default otherwise the automatic name
      // remind all info
      cat = {initial, manual, automatic, category};
      categoryNaming.set(cat.initial, cat);
      console.log('Category "' + cat.initial + '" renamed to ' + cat.category);
    } // else already set
    if (!cat || !cat.category) {
      console.log('Problem', cat, match);
    }
    match.category = cat.category;
  });

  // rewrite renaming data for the user
  const firstLine = 4
  divisionSheet.getRange('A'+firstLine+':C23').clearContent();
  // sort the categories by the FIT name
  const categories = []
  categoryNaming.forEach((val, key) => categories.push(val));
  categories.sort((a, b) => a.initial.localeCompare(b.initial)); //sort by the initial name
  categories.forEach((cat, idx) => {
    divisionSheet.getRange('A' + (firstLine+idx)).setValue(cat.initial);
    divisionSheet.getRange('B' + (firstLine+idx)).setValue(cat.automatic);
    if (cat.manual) {
      divisionSheet.getRange('C' + (firstLine+idx)).setValue(cat.manual);
    }
  });
}

function adjustFieldNaming(matches) {
  const fieldSheet = spreadsheet.getSheetByName('Field Renaming');
  const fieldNaming = new Map();

  // read renaming data from the sheet
  // A: FIT name of the field
  // B: New name of the field
  const renaming = fieldSheet.getRange('A4:B50').getValues();
  // console.log(renaming);

  // for each match apply a renaming of the categories
  matches.forEach( match => {
    // match.comp is the FIT name of the category
    const initial = match.location;
    let field = fieldNaming.get(initial);
    if (!field) {
      // field not already managed
      // search if the user set a manuel renaming
      const ren = renaming.find(ren => ren[0] === initial && ren[1] && (''+ren[1]).trim().length > 0);
      if (ren) {
        field = ren[1];
        fieldNaming.set(initial, field);
        console.log('Field "' + initial + '" renamed to ' + field);
      }
    } // else already set
    match.field = field;
  });
}



/**
 * Extract time slots from matches
 * @return Map<String,string[]: key is the date as string YYYY-MM-DD, value is a list of time slot as string HH:MM
 */
function extractTimeSlots(day2matches) {
  const day2timeslots = new Map();
  const days = Array.from(day2matches.keys());
  days.forEach(day => {
    if (day) {
      const matches = day2matches.get(day);
      //extract only timeslots
      let timeSlots = matches.map(m => m.timeSlot);
      // remove redundant value
      
      timeSlots = timeSlots.filter((item, index) => {
        return index === timeSlots.indexOf(item);
      });
      timeSlots.sort();
      timeSlots = timeSlots.filter(ts => ts.length > 0);
      day2timeslots.set(day, timeSlots);
      Logger.log('Day ' + day + ' has ' + timeSlots.length + ' time slots.')
    }
  });
  return day2timeslots;
}

/**
 * Write the teams in the sheet Teams for each division/category
 */
function writeTeams(spreadsheet, sourcesSheet, category2teams) {
  Logger.log('Writing teams');
  const rowInfo = 11;
  sourcesSheet.getRange(rowInfo, 2).setValue('Importing ...');

  const categories = Array.from(category2teams.keys());
  let nbTeams = 0;
  categories.sort();
  let categoryCol = 1
  const teamsSheet = spreadsheet.getSheetByName('Teams');
  teamsSheet.getRange('A2:T50').clearContent();
  categories.forEach(category => {
    const teams = category2teams.get(category);
    console.log('Writing category "' + category + '" with the teams ', teams);
    teamsSheet.showColumns(categoryCol);
    teamsSheet.getRange(2, categoryCol).setValue(category);
    let rowIdx = 3;
    teams.forEach(team => {
      teamsSheet.getRange(rowIdx, categoryCol).setValue(team);
      rowIdx++;
    });
    nbTeams += teams.length;
    categoryCol++;
  });
  if (categoryCol < 20) {
    for(let i=categoryCol; i<=20; i++) {
      teamsSheet.hideColumns(i);
    }
  }
  sourcesSheet.getRange(rowInfo, 2).setValue(nbTeams + ' teams, over ' + categories.length + ' categories (' + categories.join(',') + ')');
}
function writeTeamNames(spreadsheet, teamNames) {
  Logger.log('Writing team names');
  const teamRenamingSheet = spreadsheet.getSheetByName('Team Renaming');

  const values = teamNames.teamNames.map(teamStruct => [
    teamStruct.division.slug,
    teamStruct.team.slug,
    teamStruct.autoName,
    teamStruct.manualName
  ]);
  teamRenamingSheet.getRange('A4:D200').clearContent();
  if (values.length > 0) {
    teamRenamingSheet.getRange('A4:D' + (3+values.length)).setValues(values);
  }
}

/**
 * Write the time slot in the sheet TimeSlots for each day
 */
function writeTimeSlots(spreadsheet, sourcesSheet, day2timeslots) {
  Logger.log('Writing time slots');
  const rowInfo = 13;
  sourcesSheet.getRange(rowInfo, 2).setValue('Importing ...');

  const days = Array.from(day2timeslots.keys());
  days.sort();
  let nbTimeSlots = 0;
  let dayCol = 1
  const timeSlotsSheet = spreadsheet.getSheetByName('TimeSlots');
  timeSlotsSheet.getRange('A3:E34').clearContent();
  days.forEach(day => {
    if (day) {
      timeSlotsSheet.showColumns(dayCol);
      const timeSlots = day2timeslots.get(day);
      let rowIdx = 3;
      timeSlots.forEach(timeSlot => {
        timeSlotsSheet.getRange(rowIdx, dayCol).setNumberFormat('@');
        timeSlotsSheet.getRange(rowIdx, dayCol).setValue(timeSlot);
        timeSlotsSheet.getRange(rowIdx, dayCol).setNumberFormat('@');
        rowIdx++;
      });
      nbTimeSlots += timeSlots.length;
      dayCol++;
    }
  });
  if (dayCol < 10) {
    for(let i=dayCol; i<=10; i++) {
      timeSlotsSheet.hideColumns(i);
    }
  }
  sourcesSheet.getRange(rowInfo, 2).setValue(nbTimeSlots + ' time slots, over ' + days.length + ' days.');
}

/**
 * Write all games in the current speardsheet and in the 'Day X' sheets.
 */
function writeGames(spreadsheet, sourcesSheet, day2matches) {
  const days = Array.from(day2matches.keys());
  const firstDayInfoRow = 14;
  const orphanInfoRow = 12;
  days.sort();
  let dayIdx = 1
  for(let i= 1; i<=10; i++) {
    spreadsheet.getSheetByName('Day ' + i).hideSheet();
  }
  spreadsheet.getSheetByName('Orphan').hideSheet();
  days.forEach(day => {
    const dayMatches = day2matches.get(day);
    const sheetName = day ? 'Day ' + dayIdx : 'Orphan';
    const rowInfo = day ? firstDayInfoRow + dayIdx - 1 : orphanInfoRow;
    sourcesSheet.showRows(rowInfo);
    spreadsheet.getSheetByName(sheetName).showSheet();
    writeDay(spreadsheet, sourcesSheet, day, dayMatches, sheetName, rowInfo, dayIdx);
    if (day) {
      dayIdx++;
    }
  });
  if (days.length < 10) {
    for(let i=days.length; i<=10; i++) {
      sourcesSheet.hideRows(firstDayInfoRow + i);
    }
  }
}

/**
 * Write the games of a day
 */
function writeDay(spreadsheet, sourcesSheet, day, dayMatches, sheetName, rowInfo, dayIdx) {
  if (!day) {
    sourcesSheet.getRange(rowInfo, 2).setValue(dayMatches.length + ' games not allocated.');
    Logger.log('Writing Orphan');
  } else {
    Logger.log('Writing Day ' + dayIdx);
  }
  sourcesSheet.getRange(rowInfo, 2).setValue('Importing ...');
  let daySheet = spreadsheet.getSheetByName(sheetName);
  if (!daySheet) {
    Logger.log('Creating sheet ' + sheetName);
    daySheet = spreadsheet.insertSheet(sheetName)
  }

  //load existing games for computing the status
  const existingMatches = daySheet.getRange('A2:I300').getDisplayValues();
  daySheet.getRange('A2:I300').clearContent();

  let nbNoMatch = 0, nbNew = 0, nbUpdate = 0, nbEqual = 0; 
  let rowIdx = 2;
  dayMatches.forEach((match,matchIdx) => {
    computeStatus(existingMatches, matchIdx, match);
    daySheet.getRange('A'+rowIdx+':J'+rowIdx).setValues([[
      match.timeSlot,
      match.field,
      match.category,
      match.what,
      match.resultRequired,
      match.teamA,
      match.teamB,
      match.status,
      match.id,
      match.changes
    ]]);
    if      (match.status === 'NoMatch')nbNoMatch++;
    else if (match.status === 'Equal')  nbEqual++;
    else if (match.status === 'Update') nbUpdate++;
    else if (match.status === 'New')    nbNew++;
    rowIdx++;
  });
  sourcesSheet.getRange(rowInfo, 2).setValue(
    (day ? day + ': ' : '')
    + dayMatches.length + ' games found' 
    + (nbEqual > 0 ? ', ' + nbEqual + ' no change' : '')
    + (nbNew > 0 ? ', ' + nbNew + ' new games' : '')
    + (nbUpdate > 0 ? ', ' + nbUpdate + ' games updated' : '')
    + (nbNoMatch > 0 ? ', ' + nbNoMatch + ' games no match' : '')
    + '.');
}


/** 
 * Converts a game division/category from FIT web site to a short name 
 * First letter is one of these:
 * - M: Men, 
 * - W: Women,
 * - X: Mixed,
 * - B: Boy
 * - G: Girl
 * The next 2 letters are the age
 * - O: Open
 * - XX: age number of the category
 */
function toCategory(txt) {
  let category = '';
  if (txt.indexOf('Women') >= 0) {
    category += 'W';
  } else if (txt.indexOf('Men') >= 0) {
    category += 'M';
  } else if (txt.indexOf('Mixed') >= 0) {
    category += 'X';
  } else if (txt.indexOf('Boy') >= 0) {
    category += 'B';
  } else if (txt.indexOf('Girl') >= 0) {
    category += 'G';
  } else {
    category += '?';
  }

  if (txt.indexOf(' Open') >= 0) {
    category += 'O';
  } else {
    const age = Number.parseInt(txt.slice(-2), 10)
    category += age ? age : '?';
  }
  // Logger.log(txt + '=>' + category);
  return category;
}

/**
 * Compare 2 matches
 * - startTime
 * - field
 * - id
 */
function sortMatches(m1, m2) {
  let res = m1.day ? m1.day.localeCompare(m2.day) : 0;
  if (res === 0) {
    res = m1.timeSlot.localeCompare(m2.timeSlot);
    if (res === 0) {
      res = m1.field - m2.field;
      if (res === 0) {
        res = m1.id.localeCompare(m1.id);
      }
    }
  }
  return res;
}

/**
 * Get the time slot from a date time. Adjust the hour with a timezone
 * @param date (Date) is the date time
 * @param timeZone is a number indicating the number of hours to add to the date time
 * @return a string HH:MM
 */
function getTimeSlot(date, timeZone) {
  return ("0" + (date.getUTCHours() + timeZone)).slice(-2) + ':' + ("0" + date.getMinutes()).slice(-2);
}
/**
 * get the date as string YYYY-MM-DD
 */
function getDay(date) {
  return date.getFullYear() + '-' + ("0" + (date.getMonth()+1)).slice(-2) + '-' + ("0" + date.getDate()).slice(-2);
}
/**
 * Compute the status of a match by comparing the current data stored in the gsheet to the downloaded data. Status can be 'New'|'Update'|'Equal'.
 * @param existingMatches is the list of the existing matches from the current gsheet
 * @param matchIdx is the index of the match in the existing match
 * @param match is the downloaded match.
 */
function computeStatus(existingMatches, matchIdx, match) {
  // Search by the gameId
  let idx = existingMatches.findIndex(m => m[8] === (''+ match.id));
  if (idx < 0) {
    // Game not found by its id => search by category,what,teamA, teamB
    idx = existingMatches.findIndex(m => m[2] === match.category && m[3] === match.what && m[5] === match.teamA && m[6] === match.teamB);
    match.changes = 'GameId not found,';
  } else {
    match.changes = '';
  }
  if (idx < 0) { // Game not found
    match.status += 'New';
    return
  } else if (matchIdx !== idx) { // different row
    match.changes += 'row '+idx+'=>'+matchIdx+',';
  } // else same row

  // compare attribute by attribute betwenn the found game and the download game
  if (match.timeSlot       !== existingMatches[idx][0]) match.changes += 'timeSlot '      +existingMatches[idx][0]+'=>'+match.timeSlot+',';
  if ((''+match.field)     !== existingMatches[idx][1]) match.changes += 'field '         +existingMatches[idx][1]+'=>'+match.field+',';
  if (match.category       !== existingMatches[idx][2]) match.changes += 'category '      +existingMatches[idx][2]+'=>'+match.category+',';
  if (match.what           !== existingMatches[idx][3]) match.changes += 'what '          +existingMatches[idx][3]+'=>'+match.what+',';
  if (match.resultRequired !== existingMatches[idx][4]) match.changes += 'resultRequired '+existingMatches[idx][4]+'=>'+match.resultRequired+',';
  if (match.teamA          !== existingMatches[idx][5]) match.changes += 'teamA '         +existingMatches[idx][5]+'=>'+match.teamA+',';
  if (match.teamB          !== existingMatches[idx][6]) match.changes += 'teamB '         +existingMatches[idx][6]+'=>'+match.teamB+'';
  match.status = match.changes.length === 0 ? 'Equal' : 'Update';
}

/**
 * Synchronise the timeslots from this sheet to Tournament info speadsheet
 */
function syncTimeSlots() {
  const spreadsheet = SpreadsheetApp.getActive();
  const sourcesSheet = spreadsheet.getSheetByName('Sources');
  const srcSheet = spreadsheet.getSheetByName('TimeSlots');
  let tournamentInfoSS = sourcesSheet.getRange('B7').getValue();
  const tiss = SpreadsheetApp.openByUrl(tournamentInfoSS);
  const destSheet = tiss.getSheetByName('Tournament information');
  destSheet.getRange('B4:F35').setValues(srcSheet.getRange('A3:E34').getValues());
  sourcesSheet.getRange('C13').setValue(new Date());
  sourcesSheet.getRange('C13').setNumberFormat('dd/MM/yyyy HH:mm:ss');
}

/**
 * Synchronise the teams from this sheet to Tournament info speadsheet
 */
function syncTeams() {
  const spreadsheet = SpreadsheetApp.getActive();
  const sourcesSheet = spreadsheet.getSheetByName('Sources');
  const srcSheet = spreadsheet.getSheetByName('Teams');
  let tournamentInfoSS = sourcesSheet.getRange('B7').getValue();
  const tiss = SpreadsheetApp.openByUrl(tournamentInfoSS);
  const destSheet = tiss.getSheetByName('Tournament information');
  destSheet.getRange('Q3:AJ35').setValues(srcSheet.getRange('A2:T34').getValues());
  sourcesSheet.getRange('C11').setValue(new Date());
  sourcesSheet.getRange('C11').setNumberFormat('dd/MM/yyyy HH:mm:ss');
}

/** Synchronise the games of the day 1 */
function syncDay1() {
  syncDayX(1);
}
/** Synchronise the games of the day 2 */
function syncDay2() {
  syncDayX(2);
}
/** Synchronise the games of the day 3 */
function syncDay3() {
  syncDayX(3);
}
/** Synchronise the games of the day 4 */
function syncDay4() {
  syncDayX(4);
}
/** Synchronise the games of the day 5 */
function syncDay5() {
  syncDayX(5);
}
/** Synchronise the games of the day 6 */
function syncDay6() {
  syncDayX(6);
}
/** Synchronise the games of the day 7 */
function syncDay7() {
  syncDayX(7);
}
/** Synchronise the games of the day 8 */
function syncDay8() {
  syncDayX(8);
}
/** Synchronise the games of the day 9 */
function syncDay9() {
  syncDayX(9);
}
/** Synchronise the games of the day 10 */
function syncDay10() {
  syncDayX(10);
}
/** Synchronise the games of a day */
function syncDayX(dayIdx) {
  if (nbMaxDay < dayIdx) {
    console.error('Wrong day Idx: over max allowed.');
    return;
  }
  const spreadsheet = SpreadsheetApp.getActive();
  const sourcesSheet = spreadsheet.getSheetByName('Sources');
  const srcSheet = spreadsheet.getSheetByName('Day ' + dayIdx);
  let tournamentInfoSS = sourcesSheet.getRange('B7').getValue();
  const tiss = SpreadsheetApp.openByUrl(tournamentInfoSS);
  const destSheet = tiss.getSheetByName('Day ' + dayIdx + ' games');
  destSheet.getRange('B5:H154').setValues(srcSheet.getRange('A2:G151').getValues());
  destSheet.getRange('CF5:CF154').setValues(srcSheet.getRange('I2:I151').getValues());
  sourcesSheet.getRange(13 + dayIdx, 3).setValue(new Date());
  sourcesSheet.getRange(13 + dayIdx, 3).setNumberFormat('dd/MM/yyyy HH:mm:ss');
}

function collectRefereesFromAppointments() {
  const spreadsheet = SpreadsheetApp.getActive();
  const sourcesSheet = spreadsheet.getSheetByName('Sources');

  // get referees info
  const tournamentInfoSS = sourcesSheet.getRange('B7').getValue();
  const tiss = SpreadsheetApp.openByUrl(tournamentInfoSS);
  const refereesSheet = tiss.getSheetByName('Referees');
  const refereesInfo = refereesSheet.getRange('B3:T122').getDisplayValues();

  for(let day = 1; day<=nbMaxDay; day++) {
    // get referees appointments
    const daySSUrl = sourcesSheet.getRange('C' + (13+day)).getValue();
    if (daySSUrl) {
      const daySS = SpreadsheetApp.openByUrl(daySSUrl);
      const appointmentSheet = daySS.getSheetByName('Appointments');
      const appointments = appointmentSheet.getRange('A4:U131').getDisplayValues()

      const daySheet = spreadsheet.getSheetByName('Day ' + day);
      const allocations = daySheet.getRange('A2:I150').getDisplayValues();
      daySheet.getRange("J2:R150").clearContent();
      for(let gameRowIdx = 0; gameRowIdx < allocations.length && allocations[gameRowIdx][0]  && allocations[gameRowIdx][0].trim().length > 0; gameRowIdx++) {
        const timeSlot = allocations[gameRowIdx][0];
        const field = allocations[gameRowIdx][1];
        const gameId = allocations[gameRowIdx][8];
        const referees = getAppointedReferees(appointments, timeSlot, field);
        // console.log('Appointed referees: ' + JSON.stringify(referees));
        const refereeData = referees.map(refDesc => getRefereeRow(refereesInfo, refDesc))
          .filter(r => r >= 0)
          .map(row => [ refereesInfo[row][0], refereesInfo[row][1], refereesInfo[row][2] ])
          .reduce((prev, cur) => prev.concat(cur), []);
        console.log('Day ' + day + ', Row ' + gameRowIdx + ': ' + timeSlot + ', Field ' + field + ', gameId: "' + gameId + '", referees: '  + JSON.stringify(refereeData));
        const row = 2 + gameRowIdx;
        refereeData.forEach((d,colIdx) => daySheet.getRange(row, 10 + colIdx).setValue(d));
      }
    }
  }
}

function getRefereeRow(refereesInfo, refDesc) {
  for(let row =0 ;row<refereesInfo.length; row++) {
    if (refereesInfo[row][12] === refDesc) {
      // console.log('getRefereeRow(' + refDesc + ')='+row);
      return row;
    }
  }
  return -1;
}
function getAppointedReferees(appointments, timeSlot, field) {
  const rowIdx = appointments.findIndex((row) => row[0] === timeSlot);
  if (rowIdx < 0) {
    return undefined;
  }
  return [
    appointments[rowIdx+1][field],
    appointments[rowIdx+2][field],
    appointments[rowIdx+3][field]
  ];
}
```