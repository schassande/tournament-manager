const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('../../frontend/node_modules/typescript');
const { jsPDF } = require('../../frontend/node_modules/jspdf');
const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'frontend/src/service/water-carrier-pdf.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const compiledModule = { exports: {} };
new Function('exports', 'require', 'module', compiled)(compiledModule.exports, require, compiledModule);

/** Generates realistic display data, including Unicode and horizontal/vertical overflow. */
function fixture(fieldCount, slotCount) {
  const fields = Array.from({ length: fieldCount }, (_, i) => ({ id: `f${i}`, name: `Terrain ${i + 1}` }));
  const timeslots = Array.from({ length: slotCount }, (_, i) => ({ id: `s${i}`,
    start: 1788253200 + i * 1800, end: 1788255000 + i * 1800 }));
  return {
    tournamentName: 'Tournoi international été 2026', timeZone: 'Europe/Paris', selectedPeriodId: 'period',
    periods: [{ id: 'period', label: 'Day 1 - Morning' }], fields, timeslots,
    matches: timeslots.flatMap(slot => fields.map(field => ({
      id: slot.id + field.id, dayId: 'd1', timeslotId: slot.id, fieldId: field.id, start: slot.start, end: slot.end,
      description: 'Mixed Open - Demi-finale - Équipe de Saint-Étienne / Genève',
      backgroundColor: '#e0edff', fontColor: '#173f72',
      referees: [{ attendeeId: 'a', name: 'Élodie François' }, { attendeeId: 'b', name: 'Michał Dvořák' },
        { attendeeId: 'c', name: 'Françoise de la Tour' }], waterCarriers: [],
    }))),
  };
}

/** Exercises the production PDF builder with its bundled Unicode font. */
function createPdf(planning) {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  pdf.addFileToVFS('NotoSans-Regular.ttf', fs.readFileSync(path.join(root, 'frontend/public/fonts/NotoSans-Regular.ttf')).toString('base64'));
  pdf.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal');
  pdf.setFont('NotoSans');
  compiledModule.exports.buildWaterCarrierPdf(pdf, planning);
  return pdf;
}

test('single-page paper planning uses a downloadable A4 landscape PDF', () => {
  const pdf = createPdf(fixture(2, 1));
  assert.equal(pdf.getNumberOfPages(), 1);
  assert.ok(Math.abs(pdf.internal.pageSize.getWidth() - 297) < 0.1);
  assert.ok(Math.abs(pdf.internal.pageSize.getHeight() - 210) < 0.1);
  assert.match(pdf.output(), /^%PDF-/);
});

test('large planning paginates vertically and horizontally for visual verification', () => {
  const pdf = createPdf(fixture(7, 8));
  assert.ok(pdf.getNumberOfPages() > 3);
  const directory = path.join(root, 'tmp/pdfs');
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'water-carrier.pdf'), Buffer.from(pdf.output('arraybuffer')));
});
