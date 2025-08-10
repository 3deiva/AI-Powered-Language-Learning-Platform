import React, { useContext } from "react";
import {
  BookOpen,
  Edit,
  Mic,
  Headphones,
  User,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import "../styles/Dashboard.css";
import { AuthContext } from "../context/AuthContext";
import readingImage from "../images/reading.jpg";
import writingImage from "../images/writing.jpg";
import listeningImage from "../images/listening.jpg";
import speakingImage from "../images/quiz.jpg";

function Dashboard() {
  const { currentUser, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  if (!currentUser) {
    return <div className="loading">பயனர் தரவை ஏற்றுகிறது...</div>;
  }

  return (
    <div className="dashboard-container dark-theme">
      {/* Header Section */}
      <header className="dashboard-header">
        <div className="header-content">
          <h1>
            மீண்டும் வரவேற்கிறோம்,{" "}
            <span>{currentUser.username || currentUser.email || "பயனர்"}</span>
          </h1>
        </div>
        <div className="header-actions">
          <Link to="/profile" className="profile-button">
            <User size={20} />
            <span>சுயவிவரம்</span>
          </Link>
          <button onClick={handleLogout} className="logout-button">
            <LogOut size={20} />
            <span>வெளியேறு</span>
          </button>
        </div>
      </header>

      {/* Learning Categories */}
      <div className="learning-categories">
        <div className="section-header">
          <h2>கற்றல் பிரிவுகள்</h2>
          <Link to="/all-courses" className="view-all">
            அனைத்தையும் காண்க <ChevronRight size={16} />
          </Link>
        </div>
        <div className="skills-grid">
          <Link to="/reading" className="skill-card reading">
            <div className="card-glow"></div>
            <div className="image-container">
              <img src={readingImage} alt="வாசித்தல்" className="skill-image" />
              <BookOpen size={28} className="skill-icon" />
            </div>
            <h3>வாசித்தல்</h3>
            <p>ஈடுபாடான உள்ளடக்கத்துடன் புரிதலை மேம்படுத்தவும்</p>
            <button className="btn primary">கற்கத் தொடங்கு</button>
          </Link>

          <Link
            to="/writing"
            state={{ username: currentUser.username }}
            className="skill-card writing"
          >
            <div className="card-glow"></div>
            <div className="image-container">
              <img src={writingImage} alt="எழுதுதல்" className="skill-image" />
              <Edit size={28} className="skill-icon" />
            </div>
            <h3>எழுதுதல்</h3>
            <p>கட்டமைக்கப்பட்ட பயிற்சிகளுடன் பயிற்சி செய்யுங்கள்</p>
            <button className="btn primary">கற்கத் தொடங்கு</button>
          </Link>
          <Link to="/listening" className="skill-card listening">
            <div className="card-glow"></div>
            <div className="image-container">
              <img src={listeningImage} alt="கேட்டல்" className="skill-image" />
              <Headphones size={28} className="skill-icon" />
            </div>
            <h3>கேட்டல்</h3>
            <p>இயல்பான ஒலியுடன் திறன்களை வளர்க்கவும்</p>
            <button className="btn primary">கற்கத் தொடங்கு</button>
          </Link>
          <Link to="/speaking" className="skill-card speaking">
            <div className="card-glow"></div>
            <div className="image-container">
              <img src={speakingImage} alt="பேசுதல்" className="skill-image" />
              <Mic size={28} className="skill-icon" />
            </div>
            <h3>தேர்வு</h3>
            <p>பேசுதல் மற்றும் எழுதுதல் பயிற்சி</p>
            <button className="btn primary">தேர்வு எடுக்கத் தொடங்கு</button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
