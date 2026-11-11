const { validateReadingInput, validateSignup } = require('../src/utils/validation');

const TODAY = '2026-10-15';
const valid = { value: 120, date: '2026-10-10', slot: 'morning' };

describe('validateReadingInput', () => {
  test('accepts a valid reading', () => {
    const { errors, data } = validateReadingInput(valid, TODAY);
    expect(errors).toEqual({});
    expect(data).toEqual(valid);
  });

  test('value is required', () => {
    for (const value of [undefined, null, '', '   ']) {
      const { errors } = validateReadingInput({ ...valid, value }, TODAY);
      expect(errors.value).toBe('Please enter a glucose value.');
    }
  });

  test.each([39, 601, 0, -50, 120.5, 'abc', '12a', '1e2'])('rejects value %p', (value) => {
    const { errors } = validateReadingInput({ ...valid, value }, TODAY);
    expect(errors.value).toBe('Value must be between 40 and 600 mg/dl.');
  });

  test.each([40, 600, '95'])('accepts value %p (boundaries and numeric strings)', (value) => {
    const { errors, data } = validateReadingInput({ ...valid, value }, TODAY);
    expect(errors.value).toBeUndefined();
    expect(data.value).toBe(Number(value));
  });

  test('date cannot be in the future, but today is fine', () => {
    expect(validateReadingInput({ ...valid, date: '2026-10-16' }, TODAY).errors.date).toBe(
      'Date cannot be in the future.'
    );
    expect(validateReadingInput({ ...valid, date: TODAY }, TODAY).errors.date).toBeUndefined();
  });

  test('date must be present and a real calendar date', () => {
    expect(validateReadingInput({ ...valid, date: '' }, TODAY).errors.date).toBe('Please select a date.');
    expect(validateReadingInput({ ...valid, date: '2026-02-30' }, TODAY).errors.date).toMatch(/valid date/);
    expect(validateReadingInput({ ...valid, date: '15/10/2026' }, TODAY).errors.date).toMatch(/valid date/);
  });

  test('slot must be one of the 4 slots', () => {
    expect(validateReadingInput({ ...valid, slot: undefined }, TODAY).errors.slot).toBe('Please select a time slot.');
    expect(validateReadingInput({ ...valid, slot: 'midnight' }, TODAY).errors.slot).toBe(
      'Please select a valid time slot.'
    );
  });

  test('reports every problem at once', () => {
    const { errors } = validateReadingInput({}, TODAY);
    expect(Object.keys(errors).sort()).toEqual(['date', 'slot', 'value']);
  });
});

describe('validateSignup', () => {
  test('cleans up name and lower-cases email', () => {
    const { errors, data } = validateSignup({ name: '  Asha ', email: 'Asha@Example.COM ', password: 'password1' });
    expect(errors).toEqual({});
    expect(data).toEqual({ name: 'Asha', email: 'asha@example.com', password: 'password1' });
  });

  test('rejects missing fields, bad email and short password', () => {
    expect(Object.keys(validateSignup({}).errors).sort()).toEqual(['email', 'name', 'password']);
    expect(validateSignup({ name: 'A', email: 'nope', password: 'password1' }).errors.email).toMatch(/valid email/);
    expect(validateSignup({ name: 'A', email: 'a@b.co', password: 'short' }).errors.password).toMatch(/at least 8/);
  });
});
