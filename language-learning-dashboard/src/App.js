import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import "./styles/App.css";

// Import existing pages
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import Reading from "./pages/Reading";
import Writing from "./pages/Writing";
import Speaking from "./pages/Speaking";
import Listening from "./pages/Listening";
import Progress from "./pages/Progress";
import Earnings from "./pages/Earnings";
import Easy1 from "./pages/Easy1";
import Easy2 from "./pages/Easy2";
import Difficulty from "./pages/Difficulty";
import LetterGame from "./components/LetterGame";

// Import authentication components
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <main className="container mx-auto p-4">
            <Routes>
              {/* Auth Routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />

              {/* Protected Routes */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />

              <Route path="/profile" element={<Profile />} />
              <Route
                path="/reading"
                element={
                  <ProtectedRoute>
                    <Reading />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/writing"
                element={
                  <ProtectedRoute>
                    <Writing />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/speaking"
                element={
                  <ProtectedRoute>
                    <Speaking />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/listening"
                element={
                  <ProtectedRoute>
                    <Listening />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/easy1"
                element={
                  <ProtectedRoute>
                    <Easy1 />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/easy2"
                element={
                  <ProtectedRoute>
                    <Easy2 />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/difficulty"
                element={
                  <ProtectedRoute>
                    <Difficulty />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/LetterGame"
                element={
                  <ProtectedRoute>
                    <LetterGame />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/progress"
                element={
                  <ProtectedRoute>
                    <Progress />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/earnings"
                element={
                  <ProtectedRoute>
                    <Earnings />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </main>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
