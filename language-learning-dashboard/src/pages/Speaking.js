import React from "react";
import { Link } from "react-router-dom";
import "../styles/speaking.css";

const Speaking = () => {
  return (
    <div className="speaking-container">
      <div className="particles-background"></div>

      <div className="content-wrapper">
        <div className="header-section">
          <h1 className="main-title">
            <span className="title-gradient">மொழி தேர்ச்சி</span>
            <span className="title-underline"></span>
          </h1>
          <p className="subtitle">
            உங்கள் திறமைகளை மேம்படுத்த வடிவமைக்கப்பட்ட ஊடாடும் கற்றல்
            அனுபவங்களில் ஈடுபடவும்
          </p>
        </div>

        <div className="games-grid">
          <Link to="/LetterGame" className="game-card">
            <div className="card-bg"></div>
            <div className="card-content">
              <div className="card-icon">
                <div className="icon-wrapper">✍️</div>
              </div>
              <h3 className="card-title">வினாடி வினா</h3>
              <p className="card-description">
                ஆங்கில மொழியை வினாடி வினா மூலம் கற்றுக்கொள்ளுங்கள்
              </p>
              <div className="progress-bar">
                <div className="progress-fill"></div>
              </div>
              <div className="card-footer">
                <button className="play-button">
                  <span>வினாடி வினா செய்ய</span>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M5 12H19M19 12L12 5M19 12L12 19"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            </div>
            <div className="card-highlight"></div>
          </Link>

          {/* Additional cards would go here */}
        </div>
      </div>
    </div>
  );
};

export default Speaking;
