import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { onValue, ref } from "firebase/database";
import Dashboard from "./components/Dashboard";
import LandingPage from "./components/LandingPage";
import Login from "./components/loginform";
import { auth, database } from "./store/firebase";
import { completeCustomerPasswordSetup, loginWithRole, submitEmployeeApplicationToFirebase } from "./store/firebaseBank";

function AuthPage({ onSession, passwordChangeRequired, onPasswordChangeRequired }) {
  const navigate = useNavigate();

  const login = async (credentials, portal) => {
    const session = await loginWithRole({ ...credentials, portal });
    if (session.role === "customer" && session.profile.mustChangePassword) {
      onPasswordChangeRequired(true);
      return;
    }
    onSession(session);
    navigate("/dashboard");
  };

  const setCustomerPassword = async (password) => {
    const session = await completeCustomerPasswordSetup(password);
    onPasswordChangeRequired(false);
    onSession(session);
    navigate("/dashboard");
  };

  return (
    <Login
      onLogin={login}
      onApplyEmployee={submitEmployeeApplicationToFirebase}
      passwordChangeRequired={passwordChangeRequired}
      onSetCustomerPassword={setCustomerPassword}
    />
  );
}

function ProtectedRoute({ session, children }) {
  return session ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [passwordChangeRequired, setPasswordChangeRequired] = useState(false);

  useEffect(() => {
    let active = true;
    let stopProfile = null;
    let restoreTimer = null;
    let authAttempt = 0;

    const clearRestoreTimer = () => {
      if (restoreTimer !== null) clearTimeout(restoreTimer);
      restoreTimer = null;
    };

    const handleRestoreError = (error) => {
      if (!active) return;
      console.error("Firebase session restore failed:", error);
      clearRestoreTimer();
      setSession(null);
      setPasswordChangeRequired(false);
      setAuthReady(true);
      // Return to the login screen instead of loading forever.
      signOut(auth).catch((signOutError) => console.error("Sign out failed:", signOutError));
    };

    // Also handle the rare case where Firebase never resolves the initial auth state.
    restoreTimer = setTimeout(() => {
      handleRestoreError(new Error("Initial Firebase auth timed out"));
    }, 15000);

    const stopAuth = onAuthStateChanged(
      auth,
      (user) => {
        authAttempt += 1;
        const currentAttempt = authAttempt;
        if (stopProfile) stopProfile();
        stopProfile = null;
        clearRestoreTimer();

        if (!user) {
          setSession(null);
          setPasswordChangeRequired(false);
          setAuthReady(true);
          return;
        }

        setAuthReady(false);
        restoreTimer = setTimeout(() => {
          if (active && currentAttempt === authAttempt) {
            handleRestoreError(new Error("User profile loading timed out"));
          }
        }, 15000);

        try {
          stopProfile = onValue(
            ref(database, `users/${user.uid}`),
            (snapshot) => {
              if (!active || currentAttempt !== authAttempt) return;
              clearRestoreTimer();
              const profile = snapshot.val();

              if (!profile || profile.status !== "active") {
                handleRestoreError(new Error("User profile missing or not active"));
                return;
              }

              if (profile.role === "customer" && profile.mustChangePassword) {
                setSession(null);
                setPasswordChangeRequired(true);
                setAuthReady(true);
                return;
              }

              setSession({ id: user.uid, email: user.email, role: profile.role, profile });
              setPasswordChangeRequired(false);
              setAuthReady(true);
            },
            (error) => {
              if (active && currentAttempt === authAttempt) handleRestoreError(error);
            }
          );
        } catch (error) {
          handleRestoreError(error);
        }
      },
      handleRestoreError
    );

    return () => {
      active = false;
      clearRestoreTimer();
      stopAuth();
      if (stopProfile) stopProfile();
    };
  }, []);

  const logout = async () => {
    await signOut(auth);
    setSession(null);
    setPasswordChangeRequired(false);
  };

  if (!authReady) {
    return <main className="bank-loading"><p>Restoring secure session…</p></main>;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={
          session ? <Navigate to="/dashboard" replace /> :
          <AuthPage onSession={setSession} passwordChangeRequired={passwordChangeRequired} onPasswordChangeRequired={setPasswordChangeRequired} />
        } />
        <Route path="/dashboard" element={
          <ProtectedRoute session={session}><Dashboard session={session} onLogout={logout} /></ProtectedRoute>
        } />
        <Route path="/" element={session ? <Navigate to="/dashboard" replace /> : <LandingPage />} />
        <Route path="*" element={<Navigate to={session ? "/dashboard" : "/"} replace />} />
      </Routes>
    </BrowserRouter>
  );
}
