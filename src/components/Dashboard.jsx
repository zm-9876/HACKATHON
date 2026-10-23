import { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { equalTo, onValue, orderByChild, query, ref } from "firebase/database";
import { clearNotice, setActiveView, showNotice, syncCustomers, syncEmployeeApplications, syncEmployees, syncNotifications, syncRequests, syncTransactions } from "../store/bankingSlice";
import { createBankRequest, createCustomerAccount, deleteEmployeeInFirebase, processBankRequest, reviewEmployeeApplicationInFirebase, setAccountBlockedInFirebase, updateEmployeeInFirebase } from "../store/firebaseBank";
import { database } from "../store/firebase";
import { CustomerOverview, LoanView, RequestForm } from "./dashboard/CustomerViews";
import { NotificationsPanel, Panel, RequestTable, TransactionTable } from "./dashboard/Shared";
import { Applications, CustomerAccountForm, Customers, Reports, StaffOverview, Team } from "./dashboard/StaffViews";
import "./dashboard.css";
import "../theme.css";

const asArray = (value) => Object.entries(value || {}).map(([id, item]) => ({ id, ...item }));

export default function Dashboard({ session, onLogout }) {
  const dispatch = useDispatch();
  const bank = useSelector((state) => state.banking);
  const role = session.role;
  const isCustomer = role === "customer";
  const isManager = role === "manager";
  const canCreateCustomer = ["employee", "manager"].includes(role);

  useEffect(() => { dispatch(setActiveView("overview")); }, [dispatch, session.id]);
  useEffect(() => {
    const stopUsers = isCustomer ? onValue(ref(database, `users/${session.id}`), (snapshot) => {
      const profile = snapshot.val();
      dispatch(syncCustomers(profile ? [{ id: session.id, ...profile }] : []));
      dispatch(syncEmployees([]));
    }) : isManager ? onValue(ref(database, "users"), (snapshot) => {
      const users = asArray(snapshot.val());
      dispatch(syncCustomers(users.filter((item) => item.role === "customer")));
      dispatch(syncEmployees(users.filter((item) => item.role === "employee")));
    }) : onValue(query(ref(database, "users"), orderByChild("role"), equalTo("customer")), (snapshot) => {
      dispatch(syncCustomers(asArray(snapshot.val())));
      dispatch(syncEmployees([]));
    });
    const stopRequests = onValue(isCustomer ? query(ref(database, "requests"), orderByChild("customerId"), equalTo(session.id)) : ref(database, "requests"), (snapshot) => dispatch(syncRequests(asArray(snapshot.val()))));
    const stopTransactions = onValue(isCustomer ? ref(database, `transactions/${session.id}`) : ref(database, "transactions"), (snapshot) => {
      const value = snapshot.val() || {};
      const entries = isCustomer ? asArray(value).map((item) => ({ ...item, customerId: session.id })) : Object.entries(value).flatMap(([customerId, values]) => asArray(values).map((item) => ({ ...item, customerId })));
      dispatch(syncTransactions(entries));
    });
    if (!isManager) dispatch(syncEmployeeApplications([]));
    const stopApplications = isManager ? onValue(ref(database, "employeeApplications"), (snapshot) => dispatch(syncEmployeeApplications(asArray(snapshot.val())))) : () => {};
    const stopNotifications = onValue(ref(database, `notifications/${session.id}`), (snapshot) => dispatch(syncNotifications(asArray(snapshot.val()))));
    return () => { stopUsers(); stopRequests(); stopTransactions(); stopApplications(); stopNotifications(); };
  }, [dispatch, isCustomer, isManager, session.id]);

  const profile = isCustomer ? bank.customers.find((item) => item.id === session.id) || session.profile : isManager ? session.profile : bank.employees.find((item) => item.id === session.id) || session.profile;
  const requests = useMemo(() => isCustomer ? bank.requests.filter((item) => item.customerId === session.id) : bank.requests, [bank.requests, isCustomer, session.id]);
  const queue = requests.filter((item) => isManager ? Number(item.amount) > 1000000 && ["pending", "manager-review"].includes(item.status) : Number(item.amount) <= 1000000 && item.status === "pending");
  const totalBalance = bank.customers.reduce((sum, item) => sum + Number(item.balance || 0), 0);
  const totalLoans = bank.requests.filter((item) => item.type === "loan" && item.status === "approved").reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const unread = bank.notifications.filter((item) => !item.read).length;
  const pendingApplications = bank.employeeApplications.filter((item) => item.status === "pending").length;
  const nav = isCustomer ? [["overview", "Overview"], ["request", "New request"], ["activity", "Request activity"], ["transactions", "Transactions"], ["loans", "Loans"], ["notifications", `Notifications${unread ? ` (${unread})` : ""}`]] : isManager ? [["overview", "Overview"], ["queue", "Operations"], ["loan-queue", "High-value loans"], ["employee-applications", `Employee applications${pendingApplications ? ` (${pendingApplications})` : ""}`], ["customers", "Customers"], ["create-customer", "Create customer"], ["transactions", "All transactions"], ["team", "Employee management"], ["reports", "Reports"], ["notifications", `Alerts${unread ? ` (${unread})` : ""}`]] : [["overview", "Overview"], ["queue", "Transaction requests"], ["loan-queue", "Loan requests"], ["customers", "Customers"], ["create-customer", "Create customer"], ["notifications", `Notifications${unread ? ` (${unread})` : ""}`]];
  const go = (view) => { dispatch(setActiveView(view)); dispatch(clearNotice()); };
  const notify = (message, type = "success") => dispatch(showNotice({ message, type }));
  const submitRequest = async (event, form, reset) => {
    event.preventDefault();
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) return notify("Please enter a valid amount.", "error");
    if (form.type === "loan" && (!form.purpose.trim() || !Number(form.duration))) return notify("Loan purpose and duration are required.", "error");
    try { await createBankRequest({ ...profile, id: session.id }, { ...form, amount, purpose: form.purpose.trim(), duration: Number(form.duration) || null, note: form.note.trim() }); reset({ type: "deposit", amount: "", purpose: "", duration: "", note: "" }); notify("Request submitted securely for bank review."); go("activity"); } catch (error) { notify(error.message || "Could not submit request.", "error"); }
  };
  const processRequest = async (request, decision) => { try { await processBankRequest(request, decision, { ...session, profile }); notify(`Request ${decision}.`); } catch (error) { notify(error.message || "Could not process request.", "error"); } };
  const blockAccount = async (id, blocked) => { try { await setAccountBlockedInFirebase(id, blocked); notify(blocked ? "Customer account blocked." : "Customer account restored."); } catch (error) { notify(error.message || "Could not update account access.", "error"); } };
  const saveEmployee = async (id, patch) => { try { await updateEmployeeInFirebase(id, patch); notify("Employee record updated."); } catch (error) { notify(error.message || "Could not update employee.", "error"); } };
  const createCustomer = async (form, reset) => { try { await createCustomerAccount(form, { ...session, profile }); reset(); notify("Customer account created successfully. The customer must replace the temporary password at first sign-in."); } catch (error) { notify(error.message || "Could not create customer account.", "error"); } };
  const reviewEmployeeApplication = async (application, decision) => { try { await reviewEmployeeApplicationInFirebase(application, decision, { ...session, profile }); notify(decision === "approved" ? "Employee application approved. Employee can now log in." : "Employee application declined."); } catch (error) { notify(error.message || "Could not review employee application.", "error"); } };
  const deleteEmployee = async (id) => { try { await deleteEmployeeInFirebase(id); notify("Employee record removed from the banking workspace."); } catch (error) { notify(error.message || "Could not remove employee.", "error"); } };

  return <main className="bank-shell"><aside className="bank-sidebar"><div className="brand"><span className="brand-mark">V</span><span>Vertex<span>Bank</span></span></div><div className="profile-chip"><span className="avatar">{profile.name.slice(0, 1)}</span><div><strong>{profile.name}</strong><small>{role} portal</small></div></div><nav className="bank-nav">{nav.map(([key, label]) => <button className={bank.activeView === key ? "active" : ""} onClick={() => go(key)} key={key}>{label}</button>)}</nav><div className="sidebar-foot"><span className="secure-dot" />Firebase-secured session</div><button className="logout" onClick={onLogout}>Sign out</button></aside><section className="bank-content"><header className="bank-header"><div><p className="eyebrow">VertexBank · {role} workspace</p><h1>{isCustomer ? `Welcome back, ${profile.name.split(" ")[0]}.` : isManager ? "Bank control centre" : "Operations workspace"}</h1><p className="header-copy">{isCustomer ? "Your money stays protected through a controlled request-and-approval workflow." : "A clear, accountable view of daily banking operations."}</p></div></header>{bank.notice && <div className={`notice notice--${bank.notice.type}`}><span>{bank.notice.type === "error" ? "!" : "✓"}</span>{bank.notice.message}<button onClick={() => dispatch(clearNotice())}>×</button></div>}
    {bank.activeView === "overview" && (isCustomer ? <CustomerOverview profile={profile} requests={requests} onNavigate={go} /> : <StaffOverview isManager={isManager} customers={bank.customers} employees={bank.employees} queue={queue} totalBalance={totalBalance} loans={totalLoans} onNavigate={go} onProcess={processRequest} />)}
    {bank.activeView === "request" && isCustomer && <RequestForm onSubmit={submitRequest} />}
    {bank.activeView === "activity" && isCustomer && <Panel eyebrow="Your banking activity" title="Request tracking"><RequestTable requests={requests} role="customer" /></Panel>}
    {bank.activeView === "transactions" && isCustomer && <Panel eyebrow="Account statement" title="Transaction history"><TransactionTable transactions={bank.transactions.filter((item) => item.customerId === session.id)} /></Panel>}
    {bank.activeView === "transactions" && isManager && <Panel eyebrow="Bank-wide audit trail" title="All processed transactions"><TransactionTable transactions={bank.transactions} /></Panel>}
    {bank.activeView === "loans" && isCustomer && <LoanView requests={requests.filter((item) => item.type === "loan")} onNavigate={go} />}
    {bank.activeView === "queue" && !isCustomer && <Panel eyebrow="Controlled approval workflow" title="Requests awaiting review"><RequestTable requests={isManager ? queue : queue.filter((item) => item.type !== "loan")} role={role} onProcess={processRequest} /></Panel>}
    {bank.activeView === "loan-queue" && !isCustomer && <Panel eyebrow="Credit workflow" title={isManager ? "High-value loan decisions" : "Loan requests"}><RequestTable requests={queue.filter((item) => item.type === "loan" && (!isManager || Number(item.amount) > 1000000))} role={role} onProcess={processRequest} /></Panel>}
    {bank.activeView === "employee-applications" && isManager && <Applications applications={bank.employeeApplications} onReview={reviewEmployeeApplication} />}
    {bank.activeView === "customers" && !isCustomer && <Customers customers={bank.customers} requests={bank.requests} transactions={bank.transactions} showBalances={isManager} onBlock={isManager ? blockAccount : null} />}
    {bank.activeView === "create-customer" && canCreateCustomer && <CustomerAccountForm onCreate={createCustomer} />}
    {bank.activeView === "team" && isManager && <Team employees={bank.employees} onSave={saveEmployee} onDelete={deleteEmployee} />}
    {bank.activeView === "reports" && isManager && <Reports customers={bank.customers} requests={bank.requests} balance={totalBalance} loans={totalLoans} />}
    {bank.activeView === "notifications" && <NotificationsPanel notifications={bank.notifications} />}
  </section></main>;
}
