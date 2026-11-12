const { buildReport, bucketModeFor } = require('../src/utils/reportBuilder');

const row = (id, reading_date, slot, value) => ({ id, reading_date, slot, value });

describe('bucketModeFor', () => {
  test('each report type has its own breakdown', () => {
    expect(bucketModeFor('daily', '2026-11-11', '2026-11-11')).toBe('slot');
    expect(bucketModeFor('weekly', '2026-11-05', '2026-11-11')).toBe('day');
    expect(bucketModeFor('monthly', '2026-10-01', '2026-10-31')).toBe('week');
    expect(bucketModeFor('yearly', '2026-01-01', '2026-11-11')).toBe('month');
  });

  test('custom ranges pick day / week / month by length', () => {
    expect(bucketModeFor('custom', '2026-11-01', '2026-11-14')).toBe('day'); // 14 days
    expect(bucketModeFor('custom', '2026-11-01', '2026-11-15')).toBe('week'); // 15 days
    expect(bucketModeFor('custom', '2026-09-01', '2026-11-30')).toBe('week'); // 91 days
    expect(bucketModeFor('custom', '2026-08-01', '2026-11-30')).toBe('month'); // 122 days
  });
});

describe('buildReport', () => {
  test('daily lists each reading with its slot', () => {
    const report = buildReport({
      type: 'daily',
      from: '2026-11-11',
      to: '2026-11-11',
      rows: [row(1, '2026-11-11', 'morning', 104), row(2, '2026-11-11', 'after_breakfast', 156)],
    });
    expect(report).toMatchObject({ count: 2, highest: 156, lowest: 104, average: 130, bucketBy: 'slot' });
    expect(report.readings.map((r) => r.slotLabel)).toEqual(['Morning (fasting)', 'After breakfast']);
    expect(report.buckets.map((b) => b.name)).toEqual(['Morning (fasting)', 'After breakfast']);
  });

  test('weekly groups by day and leaves out days with no readings', () => {
    const report = buildReport({
      type: 'weekly',
      from: '2026-11-05',
      to: '2026-11-11',
      rows: [
        row(1, '2026-11-05', 'morning', 100),
        row(2, '2026-11-05', 'after_dinner', 140),
        row(3, '2026-11-08', 'morning', 90), // 6, 7 have none
      ],
    });
    expect(report.buckets).toEqual([
      { name: 'Thu 5 Nov', label: 'Thu 5', count: 2, low: 100, avg: 120, high: 140 },
      { name: 'Sun 8 Nov', label: 'Sun 8', count: 1, low: 90, avg: 90, high: 90 },
    ]);
  });

  test('monthly groups into 7-day weeks starting on the 1st', () => {
    const report = buildReport({
      type: 'monthly',
      from: '2026-10-01',
      to: '2026-10-31',
      rows: [row(1, '2026-10-01', 'morning', 100), row(2, '2026-10-07', 'morning', 110), row(3, '2026-10-08', 'morning', 130), row(4, '2026-10-31', 'morning', 150)],
    });
    expect(report.buckets.map((b) => [b.name, b.count, b.avg])).toEqual([
      ['1 Oct – 7 Oct', 2, 105],
      ['8 Oct – 14 Oct', 1, 130],
      ['29 Oct – 31 Oct', 1, 150],
    ]);
  });

  test('yearly groups by month with a rounded weighted average', () => {
    const report = buildReport({
      type: 'yearly',
      from: '2026-01-01',
      to: '2026-11-11',
      rows: [row(1, '2026-01-10', 'morning', 100), row(2, '2026-01-11', 'morning', 101), row(3, '2026-01-12', 'morning', 101), row(4, '2026-03-02', 'morning', 120)],
    });
    expect(report.buckets.map((b) => [b.name, b.label, b.count, b.avg])).toEqual([
      ['January 2026', 'Jan', 3, 100.7],
      ['March 2026', 'Mar', 1, 120],
    ]);
    expect(report.average).toBe(105.5);
  });

  test('no readings gives zero count, null stats and no buckets', () => {
    const report = buildReport({ type: 'custom', from: '2026-11-01', to: '2026-11-03', rows: [] });
    expect(report).toMatchObject({ count: 0, highest: null, lowest: null, average: null, buckets: [] });
  });
});
