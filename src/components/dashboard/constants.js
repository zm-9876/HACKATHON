export const money = new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 });
export const date = new Intl.DateTimeFormat("en-PK", { dateStyle: "medium" });
export const highLoanLimit = 1000000;
export const requestLabels = {
  deposit: "Deposit request",
  withdrawal: "Withdrawal request",
  loan: "Loan application",
  donation: "Donation request",
  zakat: "Zakat request",
};
