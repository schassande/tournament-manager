import { BasicDivision, SlotType } from "./tournament";

export const palette = {
  red: {
    name: 'red',
    background:  ['#570f0f', '#701414', '#891818', '#a31d1d', '#bc2121', '#d52626', '#dd3c3c', '#e15555', '#e66e6e', '#ea8888', '#eea1a1', '#f3baba', '#f7d4d4'],
    color:       ['#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#000000', '#000000', '#000000', '#000000', '#000000', '#000000', '#000000'],
  },
  blue: {
    name: 'blue',
    background:  ['#0f3357', '#144270', '#185189', '#1d60a3', '#216ebc', '#267dd5', '#3c8cdd', '#559be1', '#6eaae6', '#88b9ea', '#a1c8ee', '#bad7f3', '#d4e5f7'],
    color:       ['#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#000000', '#000000', '#000000', '#000000', '#000000', '#000000', '#000000'],
  },
  green: {
    name: 'green',
    background:  ['#0f5727', '#147033', '#18893e', '#1da349', '#21bc55', '#26d560', '#3cdd71', '#55e184', '#6ee696', '#88eaa9', '#a1eebb', '#baf3cd', '#d4f7e0'],
    color:       ['#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#000000', '#000000', '#000000', '#000000', '#000000', '#000000', '#000000'],
  },
  orange: {
    name: 'orange',
    background:  ['#57330f', '#704214', '#895118', '#a3601d', '#bc6e21', '#d57d26', '#dd8c3c', '#e19b55', '#e6aa6e', '#eab988', '#eec8a1', '#f3d7ba', '#f7e5d4'],
    color:       ['#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#000000', '#000000', '#000000', '#000000', '#000000', '#000000', '#000000'],
  },
  violet: {
    name: 'violet',
    background:  ['#570f0f', '#701414', '#891818', '#a31d1d', '#bc2121', '#d52626', '#dd3c3c', '#e15555', '#e66e6e', '#ea8888', '#eea1a1', '#f3baba', '#f7d4d4'],
    color:       ['#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#000000', '#000000', '#000000', '#000000', '#000000', '#000000', '#000000'],
  },
  yellow: {
    name: 'yellow',
    background:  ['#3f0f57', '#511470', '#641889', '#761da3', '#8821bc', '#9b26d5', '#a73cdd', '#b255e1', '#be6ee6', '#c988ea', '#d5a1ee', '#e0baf3', '#ebd4f7'],
    color:       ['#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#000000', '#000000', '#000000', '#000000', '#000000', '#000000', '#000000'],
  }
}

export const BasicDivisions: BasicDivision[] = [
  {name: 'Boys under 11',  shortName: 'B11', backgroundColor: palette.orange.background[0], fontColor:palette.orange.color[0]},
  {name: 'Boys under 13',  shortName: 'B13', backgroundColor: palette.orange.background[2], fontColor:palette.orange.color[2]},
  {name: 'Boys under 15',  shortName: 'B15', backgroundColor: palette.orange.background[4], fontColor:palette.orange.color[4]},
  {name: 'Boys under 18',  shortName: 'B18', backgroundColor: palette.orange.background[6], fontColor:palette.orange.color[6]},
  {name: 'Boys under 20',  shortName: 'B20', backgroundColor: palette.orange.background[8], fontColor:palette.orange.color[8]},
  {name: 'Mens open',      shortName: 'MO',  backgroundColor: palette.red.background[0], fontColor:palette.red.color[0]},
  {name: 'Mens over 30',   shortName: 'M30', backgroundColor: palette.red.background[2], fontColor:palette.red.color[2]},
  {name: 'Mens over 35',   shortName: 'M35', backgroundColor: palette.red.background[4], fontColor:palette.red.color[4]},
  {name: 'Mens over 40',   shortName: 'M40', backgroundColor: palette.red.background[6], fontColor:palette.red.color[6]},
  {name: 'Mens over 45',   shortName: 'M45', backgroundColor: palette.red.background[8], fontColor:palette.red.color[8]},
  {name: 'Mens over 50',   shortName: 'M50', backgroundColor: palette.red.background[10], fontColor:palette.red.color[10]},
  {name: 'Mens over 55',   shortName: 'M55', backgroundColor: palette.red.background[12], fontColor:palette.red.color[12]},
  {name: 'Mens over 60',   shortName: 'M60', backgroundColor: palette.red.background[13], fontColor:palette.red.color[14]},

  {name: 'Girls under 11', shortName: 'G11', backgroundColor: palette.yellow.background[0], fontColor:palette.yellow.color[0]},
  {name: 'Girls under 13', shortName: 'G13', backgroundColor: palette.yellow.background[2], fontColor:palette.yellow.color[2]},
  {name: 'Girls under 15', shortName: 'G15', backgroundColor: palette.yellow.background[4], fontColor:palette.yellow.color[4]},
  {name: 'Girls under 18', shortName: 'G18', backgroundColor: palette.yellow.background[6], fontColor:palette.yellow.color[6]},
  {name: 'Girls under 20', shortName: 'G20', backgroundColor: palette.yellow.background[8], fontColor:palette.yellow.color[8]},
  {name: 'Womens open',    shortName: 'WO',  backgroundColor: palette.violet.background[0], fontColor:palette.violet.color[0]},
  {name: 'Womens over 27', shortName: 'W27', backgroundColor: palette.violet.background[2], fontColor:palette.violet.color[2]},
  {name: 'Womens over 30', shortName: 'W30', backgroundColor: palette.violet.background[4], fontColor:palette.violet.color[4]},
  {name: 'Womens over 35', shortName: 'W35', backgroundColor: palette.violet.background[6], fontColor:palette.violet.color[6]},
  {name: 'Womens over 45', shortName: 'W45', backgroundColor: palette.violet.background[8], fontColor:palette.violet.color[8]},
  {name: 'Womens over 50', shortName: 'W50', backgroundColor: palette.violet.background[10], fontColor:palette.violet.color[10]},
  {name: 'Womens over 55', shortName: 'W55', backgroundColor: palette.violet.background[12], fontColor:palette.violet.color[12]},
  {name: 'Womens over 60', shortName: 'W60', backgroundColor: palette.violet.background[13], fontColor:palette.violet.color[13]},

  {name: 'Mixed under 11', shortName: 'X11', backgroundColor: palette.green.background[0], fontColor:palette.green.color[0]},
  {name: 'Mixed under 13', shortName: 'X13', backgroundColor: palette.green.background[2], fontColor:palette.green.color[2]},
  {name: 'Mixed under 15', shortName: 'X15', backgroundColor: palette.green.background[4], fontColor:palette.green.color[4]},
  {name: 'Mixed under 18', shortName: 'X18', backgroundColor: palette.green.background[6], fontColor:palette.green.color[6]},
  {name: 'Mixed under 20', shortName: 'X20', backgroundColor: palette.green.background[8], fontColor:palette.green.color[8]},
  {name: 'Mixed open',     shortName: 'XO',  backgroundColor: palette.blue.background[0], fontColor:palette.blue.color[0]},
  {name: 'Mixed over 30',  shortName: 'X30', backgroundColor: palette.blue.background[2], fontColor:palette.blue.color[2]},
  {name: 'Mixed over 35',  shortName: 'X35', backgroundColor: palette.blue.background[4], fontColor:palette.blue.color[4]},
  {name: 'Mixed over 40',  shortName: 'X40', backgroundColor: palette.blue.background[6], fontColor:palette.blue.color[6]},
  {name: 'Mixed over 45',  shortName: 'X45', backgroundColor: palette.blue.background[8], fontColor:palette.blue.color[8]},

  {name: 'Open',           shortName: 'O',   backgroundColor: '#ffffff', fontColor: '#000000'}
];

function newBreakSlot(breakDuration: number): SlotType {
  return newSlotType('Break '+breakDuration+'min', 0, 0, breakDuration, 0, 0)
}
/**
 * Creates a new SlotType with the given parameters.
 * @param name - The name of the slot type.
 * @param nbPeriod - The number of periods in the slot type.
 * @param periodDuration - The duration of each period in minutes.
 * @param breakDuration - The duration of the break in minutes.
 * @param extraTimeDuration - The duration of the extra time in minutes.
 * @param interGameDuration - The duration of the inter-game break in minutes.
 * @return A new SlotType object with the specified parameters.
 */
export function newSlotType(name:string, nbPeriod: number, periodDuration: number, breakDuration: number, extraTimeDuration: number, interGameDuration: number): SlotType {
  return {
    id: name,
    name,
    periodDuration,
    breakDuration,
    extraTimeDuration,
    interGameDuration,
    totalDuration: nbPeriod * periodDuration + breakDuration + extraTimeDuration + interGameDuration,
    lastChange: new Date().getTime(),
    nbPeriod,
    playTime: nbPeriod * periodDuration
  } as SlotType;
}

export const defaultSlotType = newSlotType('50min 2x20', 2, 20, 5, 0, 5);
export const defaultSloTypes: SlotType[] = [
    newSlotType('15min 1x10', 1, 10, 0, 0, 5),
    newSlotType('20min 1x15', 1, 15, 0, 0, 5),
    newSlotType('25min 1x20', 1, 20, 0, 0, 5),
    newSlotType('30min 2x10', 2, 10, 3, 0, 7),
    newSlotType('30min 1x25', 1, 25, 0, 0, 5),
    newSlotType('40min 2x15', 2, 15, 5, 0, 5),
    defaultSlotType,
    newSlotType('55min 2x20', 2, 20, 5, 5, 5),
    newSlotType('60min 2x20', 2, 20, 5, 10,5),
    newBreakSlot(5),
    newBreakSlot(10),
    newBreakSlot(15),
    newBreakSlot(20),
    newBreakSlot(30),
    newBreakSlot(40),
    newBreakSlot(50),
    newBreakSlot(60),
    newBreakSlot(70),
    newBreakSlot(80),
    newBreakSlot(90),
    newBreakSlot(100),
    newBreakSlot(110),
    newBreakSlot(120)
  ];
