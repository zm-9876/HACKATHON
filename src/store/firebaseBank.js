import { getApp, getApps, initializeApp } from "firebase/app";
import { createUserWithEmailAndPassword, getAuth, signInWithEmailAndPassword, signOut, updatePassword, updateProfile } from "firebase/auth";
import { get, getDatabase, push, ref, remove, runTransaction, set, update } from "firebase/database";
import { auth, database, firebaseConfig } from "./firebase";

const managerEmail = "zm271524@gmail.com";
const managerPassword = "Manager@123";
const highLoanLimit = 1000000;
const largeTransactionLimit = highLoanLimit;
const moneyTypes = ["deposit", "withdrawal", "loan", "donation", "zakat"];
const debitTypes = ["withdrawal", "donation", "zakat"];
const provisioningApp = getApps().some((item) => item.name === "vertexbank-provisioning") ? getApp("vertexbank-provisioning") : initializeApp(firebaseConfig, "vertexbank-provisioning");
const provisioningAuth = getAuth(provisioningApp);
const provisioningDatabase = getDatabase(provisioningApp);

const accountNumber = () => `VB-${Math.floor(10000000 + Math.random() * 89999999)}`;
const userPath = (uid) => ref(database, `users/${uid}`);
const provisioningUserPath = (uid) => ref(provisioningDatabase, `users/${uid}`);

async function sendNotification(userId, payload) {
  await set(push(ref(database, `notifications/${userId}`)), { ...payload, read: false, createdAt: Date.now() });
}

async function notifyManagers(payload) {
  const users = (await get(ref(database, "users"))).val() || {};
  const managers = Object.entries(users).filter(([, user]) => user.role === "manager" && user.status === "active");
  await Promise.all(managers.map(([id]) => sendNotification(id, payload)));
}

async function createSecondaryUser({ email, password, name }) {
  const credential = await createUserWithEmailAndPassword(provisioningAuth, email.trim(), password);
  await updateProfile(credential.user, { displayName: name.trim() });
  return credential.user;
}

async function requireActiveStaff(actor) {
  if (!actor?.id) throw new Error("You must sign in as an employee or manager to create a customer account.");
  if (auth.currentUser && auth.currentUser.uid !== actor.id) throw new Error("Your staff session could not be verified.");
  const profile = auth.currentUser ? (await get(userPath(actor.id))).val() : actor.profile;
  if (!profile || !["employee", "manager"].includes(profile.role) || profile.status !== "active") {
    throw new Error("Only active employees and managers can create customer accounts.");
  }
}

async function bootstrapManager(password) {
  if (password !== managerPassword) throw new Error("Manager password is incorrect.");
  const user = await createSecondaryUser({ email: managerEmail, password, name: "Zain, Bank Manager" });
  try {
    await set(provisioningUserPath(user.uid), { name: "Zain, Bank Manager", email: managerEmail, role: "manager", status: "active", createdAt: Date.now() });
  } finally {
    await signOut(provisioningAuth);
  }
}

export async function loginWithRole({ email, password, portal }) {
  const normalisedEmail = email.trim().toLowerCase();
  let credential;
  try {
    credential = await signInWithEmailAndPassword(auth, normalisedEmail, password);
  } catch (error) {
    if (normalisedEmail !== managerEmail || !["auth/user-not-found", "auth/invalid-credential"].includes(error.code)) throw error;
    try {
      await bootstrapManager(password);
    } catch (bootstrapError) {
      if (bootstrapError.code === "auth/email-already-in-use") throw error;
      throw bootstrapError;
    }
    credential = await signInWithEmailAndPassword(auth, normalisedEmail, password);
  }
  let profile = (await get(userPath(credential.user.uid))).val();
  if (!profile && normalisedEmail === managerEmail) {
    profile = { name: "Zain, Bank Manager", email: managerEmail, role: "manager", status: "active", createdAt: Date.now() };
    await set(userPath(credential.user.uid), profile);
  }
  const staff = ["employee", "manager"].includes(profile?.role);
  const allowed = portal === "customer" ? profile?.role === "customer" : staff;
  if (!allowed || profile?.status !== "active") {
    await signOut(auth);
    if (profile?.status === "pending") throw new Error("Your employee application is waiting for manager approval.");
    throw new Error("This account does not have access to the selected portal.");
  }
  return { id: credential.user.uid, email: credential.user.email, role: profile.role, profile };
}

export async function createCustomerAccount(payload, actor) {
  await requireActiveStaff(actor);
  const user = await createSecondaryUser(payload);
  try {
    await set(provisioningUserPath(user.uid), { name: payload.name.trim(), email: user.email, phone: payload.phone?.trim() || null, role: "customer", status: "active", mustChangePassword: true, accountType: payload.accountType || "Savings", accountNumber: accountNumber(), balance: 0, createdAt: Date.now() });
  } finally {
    await signOut(provisioningAuth);
  }
}

export async function completeCustomerPasswordSetup(password) {
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in with your temporary password first.");
  if (password.length < 8) throw new Error("Your permanent password must contain at least 8 characters.");
  const profile = (await get(userPath(user.uid))).val();
  if (!profile || profile.role !== "customer" || profile.status !== "active" || !profile.mustChangePassword) {
    throw new Error("This account does not require password setup.");
  }
  await updatePassword(user, password);
  const passwordChangedAt = Date.now();
  await update(userPath(user.uid), { mustChangePassword: false, passwordChangedAt });
  return { id: user.uid, email: user.email, role: profile.role, profile: { ...profile, mustChangePassword: false, passwordChangedAt } };
}

export async function submitEmployeeApplicationToFirebase(payload) {
  const user = await createSecondaryUser(payload);
  const now = Date.now();
  try {
    await set(provisioningUserPath(user.uid), { name: payload.name.trim(), email: user.email, phone: payload.phone.trim(), role: "employee-applicant", status: "pending", department: payload.department, cnic: payload.cnic.trim(), experience: payload.experience.trim(), qualification: payload.qualification.trim(), createdAt: now });
    await set(push(ref(provisioningDatabase, "employeeApplications")), { applicantId: user.uid, name: payload.name.trim(), email: user.email, phone: payload.phone.trim(), cnic: payload.cnic.trim(), department: payload.department, experience: payload.experience.trim(), qualification: payload.qualification.trim(), status: "pending", submittedAt: now });
  } finally {
    await signOut(provisioningAuth);
  }
}

export async function createBankRequest(profile, payload) {
  const amount = Number(payload.amount);
  const managerReview = amount > highLoanLimit;
  await set(push(ref(database, "requests")), { customerId: profile.id, customerName: profile.name, type: payload.type, amount, purpose: payload.purpose || null, duration: payload.duration || null, note: payload.note || null, status: managerReview ? "manager-review" : "pending", createdAt: Date.now() });
  if (amount > largeTransactionLimit) {
    await sendNotification(profile.id, { type: "large-transaction", title: "Large transaction submitted", message: `Your ${payload.type} request is under enhanced review.` });
    await notifyManagers({ type: "large-transaction", title: "Manager review required", message: `${profile.name} submitted a ${payload.type} request above PKR 1,000,000.`, customerId: profile.id });
  }
}

export async function processBankRequest(request, decision, actor) {
  const highValue = Number(request.amount) > highLoanLimit;
  const status = decision === "approved" && actor.role === "employee" && highValue ? "manager-review" : decision;
  if (status === "approved" && moneyTypes.includes(request.type)) {
    let insufficient = false;
    await runTransaction(ref(database, `users/${request.customerId}/balance`), (current) => {
      const balance = Number(current || 0);
      if (debitTypes.includes(request.type) && balance < Number(request.amount)) { insufficient = true; return; }
      return debitTypes.includes(request.type) ? balance - Number(request.amount) : balance + Number(request.amount);
    });
    if (insufficient) throw new Error("Customer has insufficient available balance.");
    await set(push(ref(database, `transactions/${request.customerId}`)), { requestId: request.id, customerId: request.customerId, customerName: request.customerName, type: request.type, amount: Number(request.amount), status: "approved", processedAt: Date.now() });
  }
  await update(ref(database, `requests/${request.id}`), { status, processedAt: Date.now(), processedBy: actor.id, processedByName: actor.profile.name });
  await sendNotification(request.customerId, { type: status === "approved" ? "success" : "status", title: "Request updated", message: `Your ${request.type} request was ${status === "manager-review" ? "forwarded for manager review" : status}.`, requestId: request.id });
  if (status === "manager-review") await notifyManagers({ type: "review", title: "Manager review needed", message: `${request.customerName}'s high-value request is awaiting your decision.`, requestId: request.id });
}

export async function reviewEmployeeApplicationInFirebase(application, decision, actor) {
  const accepted = decision === "approved";
  const now = Date.now();
  await update(ref(database), {
    [`employeeApplications/${application.id}/status`]: decision,
    [`employeeApplications/${application.id}/reviewedAt`]: now,
    [`employeeApplications/${application.id}/reviewedBy`]: actor.id,
    [`users/${application.applicantId}/role`]: accepted ? "employee" : "employee-applicant",
    [`users/${application.applicantId}/status`]: accepted ? "active" : "inactive",
    [`users/${application.applicantId}/reviewedAt`]: now,
  });
  await sendNotification(application.applicantId, { type: accepted ? "success" : "status", title: "Employee application updated", message: accepted ? "Your application was approved. You can now sign in as an employee." : "Your employee application was declined." });
}

export async function updateEmployeeInFirebase(id, patch) {
  await update(userPath(id), patch);
}

export async function deleteEmployeeInFirebase(id) {
  await remove(userPath(id));
}

export async function setAccountBlockedInFirebase(id, blocked) {
  await update(userPath(id), { status: blocked ? "blocked" : "active", statusUpdatedAt: Date.now() });
  await sendNotification(id, { type: blocked ? "security" : "success", title: blocked ? "Account blocked" : "Account restored", message: blocked ? "Your account access was restricted by bank management." : "Your account access has been restored." });
}
