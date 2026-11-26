// Rahisi Cash: fee calculation.
// Pure functions, no imports. Used by the `create-payment` Edge Function
// (the only place fees are ever calculated) and by the admin preview.
//
// All money values are whole RWF (integers). Percentages may have up to
// 2 decimals (for example 1.5). Maths is done in integers (hundredths of a
// percent) so floating-point error can never change a fee.

export interface FeeSettings {
  commissionPercent: number; // agent commission, % of the amount
  systemFeePercent: number; // Rahisi Cash system fee, % of the amount
}

export interface FeeResult {
  amount: number;
  commission_percent: number;
  system_fee_percent: number;
  agent_commission: number;
  system_fee: number;
  total_fee: number;
  total_paid: number; // charged to the client = amount + total_fee
  agent_owed: number; // owed to the agent = amount + agent_commission
}

const MAX_AMOUNT = 100_000_000; // safety cap, RWF

/** Percent -> hundredths of a percent, as an integer (1.5% -> 150). */
function toBasisPoints(pct: number, label: string): number {
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
    throw new RangeError(`${label} must be between 0 and 100`);
  }
  const bp = Math.round(pct * 100);
  if (Math.abs(bp - pct * 100) > 1e-6) {
    throw new RangeError(`${label} can have at most 2 decimals`);
  }
  return bp;
}

/** amount * basisPoints / 10000, rounded to the nearest RWF (0.5 rounds up). */
function percentOf(amount: number, bp: number): number {
  return Math.floor((amount * bp + 5000) / 10000);
}

export function calculateFees(amount: number, s: FeeSettings): FeeResult {
  if (!Number.isInteger(amount) || amount <= 0 || amount > MAX_AMOUNT) {
    throw new RangeError("amount must be a whole number of RWF greater than 0");
  }
  const cBp = toBasisPoints(s.commissionPercent, "commissionPercent");
  const sBp = toBasisPoints(s.systemFeePercent, "systemFeePercent");

  // 1. Round the commission and the combined fee separately.
  const commissionRounded = percentOf(amount, cBp);
  const totalRounded = percentOf(amount, cBp + sBp);

  // 2. System fee = combined fee minus the rounded commission, so the
  //    parts always add up exactly (no 1 RWF drift from double rounding).
  const agent_commission = commissionRounded;
  const system_fee = totalRounded - commissionRounded;
  const total_fee = totalRounded;
  return {
    amount,
    commission_percent: s.commissionPercent,
    system_fee_percent: s.systemFeePercent,
    agent_commission,
    system_fee,
    total_fee,
    total_paid: amount + total_fee,
    agent_owed: amount + agent_commission,
  };
}
