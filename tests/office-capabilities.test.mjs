import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildExcelPivotTableScript,
  buildExcelChartScript,
  buildExcelConditionalFormattingScript,
} from '../dist/plugins/office/index.js';

test('office plugin exposes a concrete PivotCaches implementation path', () => {
  const script = buildExcelPivotTableScript(1234, {
    sheet: 'Data',
    sourceRange: 'A1:D20',
    destinationSheet: 'Summary',
    destinationCell: 'F3',
    rowFields: ['Region'],
    dataField: 'Revenue',
  });

  assert.match(script, /PivotCaches\(\)\.Create/);
  assert.match(script, /CreatePivotTable/);
  assert.match(script, /\$pivot\.PivotFields\('Region'\)\.Orientation = 1/);
  assert.match(script, /AddDataField/);
});

test('office plugin exposes a concrete ChartObjects.Add implementation path', () => {
  const script = buildExcelChartScript(1234, {
    sheet: 'Summary',
    sourceRange: 'A1:B8',
    chartType: 'line',
    chartTitle: 'Revenue Trend',
  });

  assert.match(script, /ChartObjects\(\)\.Add/);
  assert.match(script, /\$chart\.SetSourceData/);
  assert.match(script, /ChartType = 4/);
  assert.match(script, /Revenue Trend/);
});

test('office plugin exposes a concrete FormatConditions implementation path', () => {
  const script = buildExcelConditionalFormattingScript(1234, {
    sheet: 'Summary',
    targetRange: 'B2:B20',
    formatType: 'dataBar',
  });

  assert.match(script, /FormatConditions\.Delete/);
  assert.match(script, /FormatConditions\.AddDatabar/);
  assert.match(script, /B2:B20/);
});
