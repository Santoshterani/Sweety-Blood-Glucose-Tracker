const { validateReading, VALUE_RANGE_MESSAGE } = require('../src/validators/readings.validator');
const { validateSignup, validateLogin } = require('../src/validators/auth.validator');
const { validateProfile } = require('../src/validators/profile.validator');
const { validateReportType, validateReportParams, validateCustomRange } = require('../src/validators/reports.validator');

const TODAY = '2026-10-15';
const valid = { value: 120, date: '2026-10-10', slot: 'morning' };
const completePatientProfile = {
  name: 'A',
  email: 'a@b.co',
  phone: '123456',
  dateOfBirth: '1990-01-01',
  sex: 'Female',
  heightCm: '160',
  weightKg: '60',
  diabetesType: 'Type 2',
  diagnosedYear: '2010',
  medication: 'None',
};

/** Runs a validator and returns { errors, data } instead of throwing. */
function run(fn, ...args) {
  try {
    return { errors: {}, data: fn(...args) };
  } catch (err) {
    if (!err.errors) throw err;
    return { errors: err.errors, data: undefined };
  }
}
const reading = (input) => run(validateReading, input, TODAY);
const profile = (input) => run(validateProfile, input, TODAY);

describe('validateReading', () => {
  test('accepts a valid reading', () => {
    const { errors, data } = reading(valid);
    expect(errors).toEqual({});
    expect(data).toEqual(valid);
  });

  test('value is required', () => {
    for (const value of [undefined, null, '', '   ']) {
      expect(reading({ ...valid, value }).errors.value).toBe('Please enter a glucose value.');
    }
  });

  test.each([39, 601, 0, -50, 120.5, 'abc', '12a', '1e2'])('rejects value %p', (value) => {
    expect(reading({ ...valid, value }).errors.value).toBe(VALUE_RANGE_MESSAGE);
    expect(VALUE_RANGE_MESSAGE).toBe('Value must be between 40 and 600 mg/dl.');
  });

  test.each([40, 600, '95'])('accepts value %p (boundaries and numeric strings)', (value) => {
    const { errors, data } = reading({ ...valid, value });
    expect(errors.value).toBeUndefined();
    expect(data.value).toBe(Number(value));
  });

  test('date cannot be in the future, but today is fine', () => {
    expect(reading({ ...valid, date: '2026-10-16' }).errors.date).toBe('Date cannot be in the future.');
    expect(reading({ ...valid, date: TODAY }).errors.date).toBeUndefined();
  });

  test('date must be present and a real calendar date', () => {
    expect(reading({ ...valid, date: '' }).errors.date).toBe('Please select a date.');
    expect(reading({ ...valid, date: '2026-02-30' }).errors.date).toMatch(/valid date/);
    expect(reading({ ...valid, date: '15/10/2026' }).errors.date).toMatch(/valid date/);
  });

  test('slot must be one of the 4 slots', () => {
    expect(reading({ ...valid, slot: undefined }).errors.slot).toBe('Please select a time slot.');
    expect(reading({ ...valid, slot: 'midnight' }).errors.slot).toBe('Please select a valid time slot.');
  });

  test('reports every problem at once', () => {
    expect(Object.keys(reading({}).errors).sort()).toEqual(['date', 'slot', 'value']);
  });

  test('throws a 400 HttpError', () => {
    expect(() => validateReading({}, TODAY)).toThrow(expect.objectContaining({ status: 400 }));
  });
});

describe('validateSignup / validateLogin', () => {
  test('cleans up name and lower-cases email', () => {
    const { errors, data } = run(validateSignup, { name: '  Asha ', email: 'Asha@Example.COM ', password: 'password1' });
    expect(errors).toEqual({});
    expect(data).toEqual({ name: 'Asha', email: 'asha@example.com', password: 'password1', role: 'patient' });
  });

  test('rejects missing fields, bad email and short password', () => {
    expect(Object.keys(run(validateSignup, {}).errors).sort()).toEqual(['email', 'name', 'password']);
    expect(run(validateSignup, { name: 'A', email: 'nope', password: 'password1' }).errors.email).toMatch(/valid email/);
    expect(run(validateSignup, { name: 'A', email: 'a@b.co', password: 'short' }).errors.password).toMatch(/at least 8/);
  });

  test('signup accepts the doctor role and rejects unknown roles', () => {
    const base = { name: 'Dr A', email: 'dr@b.co', password: 'password1' };
    expect(run(validateSignup, { ...base, role: 'doctor' }).data.role).toBe('doctor');
    expect(run(validateSignup, { ...base, role: 'admin' }).errors.role).toBe('Please choose a valid account type.');
  });

  test('login needs an email and a password', () => {
    expect(run(validateLogin, { email: '  ', password: '' }).errors).toEqual({
      email: 'Please enter your email.',
      password: 'Please enter your password.',
    });
  });
});

describe('validateProfile', () => {
  test('requires personal and health details', () => {
    const { errors } = profile({ name: 'A', email: 'a@b.co' });
    expect(errors).toMatchObject({
      phone: 'Please enter your phone number.',
      dateOfBirth: 'Please enter your date of birth.',
      sex: 'Please choose an option.',
      diabetesType: 'Please select your diabetes type.',
      diagnosedYear: 'Please enter the year diagnosed.',
      heightCm: 'Please enter your height.',
      weightKg: 'Please enter your weight.',
      medication: 'Please enter your medication.',
    });
  });

  test('required details validate while other fields keep their defaults', () => {
    const { errors, data } = profile({ ...completePatientProfile, name: ' A ', email: 'A@B.co' });
    expect(errors).toEqual({});
    expect(data).toMatchObject({ name: 'A', email: 'a@b.co', targetLow: 70, targetHigh: 180, heightCm: 160 });
  });

  test('turns numeric strings into numbers and blanks into null', () => {
    const { data } = profile({ ...completePatientProfile, heightCm: '162', weightKg: '68.5', doctorName: '  ' });
    expect(data).toMatchObject({ heightCm: 162, weightKg: 68.5, doctorName: null });
  });

  test('rejects a phone number containing only zeros', () => {
    expect(profile({ ...completePatientProfile, phone: '0000000000' }).errors.phone).toBe(
      'Phone number cannot contain only zeros.'
    );
  });

  test('doctor profiles require personal details but not patient health details', () => {
    const { errors, data } = run(validateProfile, {
      name: 'Dr A',
      email: 'doctor@example.com',
      phone: '123456',
      dateOfBirth: '1980-01-01',
      sex: 'Other',
    }, TODAY, 'doctor');
    expect(errors).toEqual({});
    expect(data).toMatchObject({ phone: '123456', diabetesType: null, heightCm: null });
  });

  test('reports a message per bad field', () => {
    const { errors } = profile({
      name: '', email: 'x', phone: 'abc', dateOfBirth: '2027-01-01', sex: 'q', heightCm: 20, weightKg: '70.55',
      diabetesType: 'z', diagnosedYear: 1800, targetLow: 200, targetHigh: 100,
    });
    expect(errors).toMatchObject({
      name: 'Please enter your name.',
      email: 'Please enter a valid email address.',
      phone: 'Please enter a valid phone number.',
      dateOfBirth: 'Date of birth cannot be in the future.',
      sex: 'Please choose a valid option.',
      heightCm: 'Height must be between 50 and 260 cm.',
      weightKg: 'Weight must be between 10 and 400 kg.',
      diabetesType: 'Please choose a valid diabetes type.',
      diagnosedYear: 'Year must be between 1900 and 2026.',
      targetHigh: 'Target high must be greater than target low.',
    });
  });

  test('doctorId is optional, blank means nobody, junk is rejected', () => {
    expect(profile({ ...completePatientProfile }).data.doctorId).toBeNull();
    expect(profile({ ...completePatientProfile, doctorId: '' }).data.doctorId).toBeNull();
    expect(profile({ ...completePatientProfile, doctorId: '7' }).data.doctorId).toBe(7);
    expect(profile({ ...completePatientProfile, doctorId: 'x' }).errors.doctorId).toBe('Please choose a valid doctor.');
    expect(profile({ ...completePatientProfile, doctorId: 0 }).errors.doctorId).toBe('Please choose a valid doctor.');
  });

  test('target range must be in order and in bounds', () => {
    expect(profile({ ...completePatientProfile, targetLow: 100, targetHigh: 100 }).errors.targetHigh).toBe(
      'Target high must be greater than target low.'
    );
    expect(profile({ ...completePatientProfile, targetLow: 5000 }).errors.targetLow).toBe(
      'Must be a whole number between 40 and 600.'
    );
  });
});

describe('report validators', () => {
  test('unknown report type is a 404', () => {
    expect(() => validateReportType('hourly')).toThrow(expect.objectContaining({ status: 404 }));
    expect(validateReportType('weekly')).toBe('weekly');
  });

  test('weekly, monthly and yearly reports accept selected date ranges', () => {
    const range = { from: '2026-10-01', to: '2026-10-07' };
    for (const type of ['weekly', 'monthly', 'yearly']) {
      expect(run(validateReportParams, type, range, TODAY).data).toEqual(range);
    }
    expect(run(validateReportParams, 'weekly', { date: TODAY }, TODAY).data).toEqual({ date: TODAY });
  });

  test('custom range rules', () => {
    expect(run(validateCustomRange, {}).errors).toEqual({
      from: 'Please select a start date.',
      to: 'Please select an end date.',
    });
    expect(run(validateCustomRange, { from: '2026-02-01', to: '2026-01-01' }).errors.to).toBe(
      'End date must be on or after the start date.'
    );
    expect(run(validateCustomRange, { from: '2015-01-01', to: '2026-01-01' }).errors.to).toBe(
      'Date range cannot be longer than 5 years.'
    );
    expect(run(validateCustomRange, { from: '2026-01-01', to: '2999-01-01' }).errors.to).toBe('Date cannot be in the future.');
    expect(run(validateCustomRange, { from: '2026-01-01', to: '2026-02-01' }).data).toEqual({ from: '2026-01-01', to: '2026-02-01' });
  });
});
