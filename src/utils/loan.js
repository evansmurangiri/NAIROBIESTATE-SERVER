import { KMRC_MAX_FINANCED, DEFAULT_INTEREST_RATE, DEFAULT_LOAN_TERM_YEARS } from "../config/constants.js";

export function monthlyPayment(principal, annualRatePct = DEFAULT_INTEREST_RATE, years = DEFAULT_LOAN_TERM_YEARS) {
  const r = annualRatePct / 100 / 12;
  const n = years * 12;
  if (n <= 0) return 0;
  if (r === 0) return principal / n;
  return (principal * (r * Math.pow(1 + r, n))) / (Math.pow(1 + r, n) - 1);
}

// Minimum deposit is whatever the price exceeds the KMRC financing ceiling by.
export function minimumDeposit(price) {
  return Math.max(price - KMRC_MAX_FINANCED, 0);
}

// Populates Property.monthlyPayment so buyers can filter/sort by affordability.
export function estimateMonthlyPayment(price) {
  const deposit = minimumDeposit(price);
  return Math.round(monthlyPayment(Math.max(price - deposit, 0)));
}

// Lenders want total monthly debt under ~30% of gross income.
export function affordability({ income = 0, debt = 0, deposit = 0 }) {
  const monthlyBudget = Math.max(income * 0.3 - debt, 0);
  const r = DEFAULT_INTEREST_RATE / 100 / 12;
  const n = DEFAULT_LOAN_TERM_YEARS * 12;
  const financeable = r === 0 ? monthlyBudget * n : (monthlyBudget * (Math.pow(1 + r, n) - 1)) / (r * Math.pow(1 + r, n));
  return { monthlyBudget: Math.round(monthlyBudget), resultAmount: Math.round(financeable + Number(deposit || 0)) };
}

export function buyingCosts(price) {
  const stampDuty = price * 0.04;
  const legalFees = price * 0.015;
  const valuationFee = price * 0.0025;
  const registration = price * 0.005;
  return {
    stampDuty: Math.round(stampDuty),
    legalFees: Math.round(legalFees),
    valuationFee: Math.round(valuationFee),
    registration: Math.round(registration),
    total: Math.round(stampDuty + legalFees + valuationFee + registration),
  };
}

export function rentVsBuy({ rent = 0, mortgage = 0, years = 10 }) {
  const rentTotal = rent * 12 * years;
  const buyTotal = mortgage * 12 * years;
  return { rentTotal, buyTotal, difference: rentTotal - buyTotal, years };
}
