import { isLikelySubscription } from './find-schedules';

describe('isLikelySubscription', () => {
  it('flags a fixed-amount weekly recurrence', () => {
    expect(
      isLikelySubscription({
        exactAmount: true,
        date: { frequency: 'weekly' },
      }),
    ).toBe(true);
  });

  it('flags a fixed-amount monthly recurrence', () => {
    expect(
      isLikelySubscription({
        exactAmount: true,
        date: { frequency: 'monthly' },
      }),
    ).toBe(true);
  });

  it('flags a fixed-amount yearly recurrence', () => {
    expect(
      isLikelySubscription({
        exactAmount: true,
        date: { frequency: 'yearly' },
      }),
    ).toBe(true);
  });

  it('does not flag a variable-amount recurrence', () => {
    expect(
      isLikelySubscription({
        exactAmount: false,
        date: { frequency: 'monthly' },
      }),
    ).toBe(false);
  });

  it('does not flag a daily recurrence', () => {
    expect(
      isLikelySubscription({
        exactAmount: true,
        date: { frequency: 'daily' },
      }),
    ).toBe(false);
  });
});
