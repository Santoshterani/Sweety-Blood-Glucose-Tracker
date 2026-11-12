const {
  isValidDateString,
  todayInTimezone,
  monthToDateRange,
  previousMonthRange,
  lastSevenDaysRange,
  yearToDateRange,
  addDays,
  diffDays,
  ageOn,
} = require('../src/utils/dates');
const { summarize } = require('../src/utils/stats');

describe('report date ranges', () => {
  test('month-to-date runs from the 1st to the selected date', () => {
    expect(monthToDateRange('2026-10-15')).toEqual({ from: '2026-10-01', to: '2026-10-15' });
    expect(monthToDateRange('2026-10-01')).toEqual({ from: '2026-10-01', to: '2026-10-01' });
  });

  test('monthly is the whole previous month (assignment example)', () => {
    expect(previousMonthRange('2026-10-15')).toEqual({ from: '2026-09-01', to: '2026-09-30' });
  });

  test('monthly handles January -> December of the previous year', () => {
    expect(previousMonthRange('2026-01-20')).toEqual({ from: '2025-12-01', to: '2025-12-31' });
  });

  test('monthly handles February lengths, including leap years', () => {
    expect(previousMonthRange('2026-03-05').to).toBe('2026-02-28');
    expect(previousMonthRange('2028-03-05').to).toBe('2028-02-29');
  });
});

describe('isValidDateString', () => {
  test('accepts real dates and rejects impossible ones', () => {
    expect(isValidDateString('2028-02-29')).toBe(true);
    expect(isValidDateString('2026-02-29')).toBe(false);
    expect(isValidDateString('2026-13-01')).toBe(false);
    expect(isValidDateString('2026-1-1')).toBe(false);
    expect(isValidDateString(null)).toBe(false);
  });
});

describe('todayInTimezone', () => {
  test('uses the given timezone, not the server timezone', () => {
    // 20:30 UTC on 11 Nov is already 02:00 on 12 Nov in India.
    const instant = new Date('2026-11-11T20:30:00Z');
    expect(todayInTimezone('Asia/Kolkata', instant)).toBe('2026-11-12');
    expect(todayInTimezone('UTC', instant)).toBe('2026-11-11');
  });
});

describe('summarize', () => {
  test('highest, lowest, average and count', () => {
    expect(summarize([100, 120, 140, 90])).toEqual({ count: 4, highest: 140, lowest: 90, average: 112.5 });
  });

  test('rounds the average to 1 decimal', () => {
    expect(summarize([100, 101, 101]).average).toBe(100.7); // 100.666...
    expect(summarize([110, 110, 110, 111]).average).toBe(110.3); // 110.25 rounds half up
  });

  test('empty list gives nulls and a zero count (for the empty state)', () => {
    expect(summarize([])).toEqual({ count: 0, highest: null, lowest: null, average: null });
  });
});

describe('weekly, yearly and date arithmetic', () => {
  test('weekly is the 7 days ending on the selected date', () => {
    expect(lastSevenDaysRange('2026-11-11')).toEqual({ from: '2026-11-05', to: '2026-11-11' });
    expect(lastSevenDaysRange('2026-03-03')).toEqual({ from: '2026-02-25', to: '2026-03-03' });
  });

  test('yearly is 1 January up to the selected date', () => {
    expect(yearToDateRange('2026-11-11')).toEqual({ from: '2026-01-01', to: '2026-11-11' });
  });

  test('addDays and diffDays cross month and year ends', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(diffDays('2026-11-05', '2026-11-11')).toBe(6);
  });

  test('ageOn only counts a birthday once it has happened', () => {
    expect(ageOn('1972-03-14', '2026-03-13')).toBe(53);
    expect(ageOn('1972-03-14', '2026-03-14')).toBe(54);
  });
});
