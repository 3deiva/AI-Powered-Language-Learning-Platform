// src/components/Navigation.js
import React from "react";
import { Link } from "react-router-dom";

const Navigation = () => {
  return (
    <nav className="bg-blue-600 text-white p-4 shadow-md">
      <div className="container mx-auto flex flex-col md:flex-row justify-between items-center">
        <div className="flex items-center mb-4 md:mb-0">
          <h1 className="text-xl font-bold">Language Learning Dashboard</h1>
        </div>

        <div className="flex flex-wrap justify-center gap-4">
          <Link
            to="/dashboard"
            className="hover:bg-blue-700 px-3 py-2 rounded transition-colors"
          >
            Dashboard
          </Link>
          <Link
            to="/reading"
            className="hover:bg-blue-700 px-3 py-2 rounded transition-colors"
          >
            Reading
          </Link>
          <Link
            to="/writing"
            className="hover:bg-blue-700 px-3 py-2 rounded transition-colors"
          >
            Writing
          </Link>
          <Link
            to="/speaking"
            className="hover:bg-blue-700 px-3 py-2 rounded transition-colors"
          >
            Speaking
          </Link>
          <Link
            to="/listening"
            className="hover:bg-blue-700 px-3 py-2 rounded transition-colors"
          >
            Listening
          </Link>
          <Link
            to="/profile"
            className="hover:bg-blue-700 px-3 py-2 rounded transition-colors"
          >
            Profile
          </Link>
          <Link
            to="/progress"
            className="hover:bg-blue-700 px-3 py-2 rounded transition-colors"
          >
            Progress
          </Link>
          <Link
            to="/earnings"
            className="hover:bg-blue-700 px-3 py-2 rounded transition-colors"
          >
            Earnings & Leaderboard
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
