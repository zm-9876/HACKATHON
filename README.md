# VertexBank Enterprise Banking Portal

A React, Redux Toolkit, and Firebase banking application that follows role-based, request-and-approval workflows.

## Roles and functionality

- **Customer:** signs in with credentials created by an employee; views account details, balance, request tracking, transaction history, and loan history; submits deposit, withdrawal, loan, donation, and zakat requests.
- **Employee:** signs in with manager-created credentials; views customer records, balances, request and transaction histories; creates customer accounts; processes deposits and withdrawals; approves loans up to PKR 1,000,000 and forwards larger loans to a manager.
- **Manager:** uses a pre-created account; views customers, employees, all processed transactions, operational requests, and reports; creates, updates, deactivates, or removes employees; approves high-value loans and can block or restore customer accounts.

Balances change only when an approved request is processed. Each approved request creates an audit transaction entry and customer notification.

## Run locally

```bash
npm install
npm run dev
```

Use `npm run lint` for static checks and `npm run build` for a production build.

## Firebase setup

Firebase configuration lives in `src/store/firebase.js`. Enable **Email/Password** authentication and configure a manager account before presenting the application. Customer accounts are created from the employee portal and employee accounts are created from the manager portal.

## Production security requirement

This is an academic/demo client application. A real financial deployment must move account provisioning and balance updates to trusted server code (such as Firebase Cloud Functions), use Firebase custom claims with restrictive Realtime Database Rules, and maintain an immutable server-side double-entry ledger. Client-side role checks alone are not a security boundary.
