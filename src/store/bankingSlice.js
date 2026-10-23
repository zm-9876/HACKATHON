import { createSlice } from "@reduxjs/toolkit";

const bankingSlice = createSlice({
  name: "banking",
  initialState: {
    activeView: "overview",
    notice: null,
    customers: [],
    employees: [],
    employeeApplications: [],
    requests: [],
    transactions: [],
    notifications: [],
  },
  reducers: {
    setActiveView: (state, action) => { state.activeView = action.payload; },
    showNotice: (state, action) => { state.notice = action.payload; },
    clearNotice: (state) => { state.notice = null; },
    syncCustomers: (state, action) => { state.customers = action.payload; },
    syncEmployees: (state, action) => { state.employees = action.payload; },
    syncEmployeeApplications: (state, action) => { state.employeeApplications = action.payload; },
    syncRequests: (state, action) => { state.requests = action.payload; },
    syncTransactions: (state, action) => { state.transactions = action.payload; },
    syncNotifications: (state, action) => { state.notifications = action.payload; },
  },
});

export const { clearNotice, setActiveView, showNotice, syncCustomers, syncEmployees, syncEmployeeApplications, syncNotifications, syncRequests, syncTransactions } = bankingSlice.actions;
export default bankingSlice.reducer;
