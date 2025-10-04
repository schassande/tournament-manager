"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isReferee = isReferee;
exports.isRefereeCoach = isRefereeCoach;
/**
 * Indicate if the role is a referee
 * @param attendeeRole role of a game attendee
 * @returns true is the role is a referee
 */
function isReferee(attendeeRole) {
    return attendeeRole === 'Referee'
        || attendeeRole === 'PlayerReferee'
        || attendeeRole === 'PlayerCoachReferee';
}
/**
 * Indicate if the role is a referee coach
 * @param attendeeRole role of a game attendee
 * @returns true is the role is a referee coach
 */
function isRefereeCoach(attendeeRole) {
    return attendeeRole === 'CoachReferee';
}
//# sourceMappingURL=referee.js.map