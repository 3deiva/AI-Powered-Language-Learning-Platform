import React from "react";
import { Link, useLocation } from "react-router-dom";
import "../styles/writing.css";

function Writing() {
  // Access the state passed from the Dashboard
  const location = useLocation();
  const username = location.state?.username || "User";

  return (
    <div className="writing-page dark-theme">
      <div className="writing-header">
        <h1 className="writing-title">Handwriting Practice</h1>
        <p className="writing-subtitle">
          Choose a practice mode to improve your handwriting skills
        </p>
      </div>

      <div className="practice-grid">
        <Link
          to="/easy1"
          state={{ username }}
          className="practice-card letter-card"
        >
          <div className="card-icon">✍️</div>
          <h3>Letters Practice</h3>
          <p>Master individual letter formation</p>
        </Link>

        <Link
          to="/easy2"
          state={{ username }}
          className="practice-card word-card"
        >
          <div className="card-icon">📝</div>
          <h3>Words Practice</h3>
          <p>Practice connecting letters into words</p>
        </Link>

        <Link
          to="/difficulty"
          state={{ username }}
          className="practice-card sentence-card"
        >
          <div className="card-icon">📜</div>
          <h3>Sentences Practice</h3>
          <p>Improve flow and consistency</p>
        </Link>
      </div>
    </div>
  );
}

export default Writing;
