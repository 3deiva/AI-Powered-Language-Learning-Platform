// src/pages/Profile.js
import React, { useContext, useState, useEffect } from "react";
import { User, Edit, Save, X, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import "../styles/Profile.css";
import { AuthContext } from "../context/AuthContext";

function Profile() {
  const { currentUser, login } = useContext(AuthContext);
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [editedUser, setEditedUser] = useState({
    username: "",
    phoneNumber: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Static progress values
  const staticProgress = {
    reading: 3,
    writing: 4,
    speaking: 5,
    listening: 2,
  };

  useEffect(() => {
    if (currentUser) {
      setEditedUser({
        username: currentUser.username || "",
        phoneNumber: currentUser.phone_number || "",
      });
    }
  }, [currentUser]);

  const handleEditToggle = () => {
    setIsEditing(!isEditing);
    setError(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditedUser((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSave = async () => {
    if (!editedUser.username.trim()) {
      setError("Username cannot be empty");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `http://10.16.49.225:5002/api/user/${currentUser.username}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(editedUser),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update profile");
      }

      login(data.user);
      setIsEditing(false);
    } catch (err) {
      setError(err.message);
      console.error("Error updating profile:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const goBack = () => {
    navigate(-1);
  };

  if (!currentUser) {
    return <div className="loading">Loading user data...</div>;
  }

  return (
    <div className="profile-page-container">
      <header className="profile-header">
        <button className="back-button" onClick={goBack}>
          <ArrowLeft size={20} />
          <span>Back to Dashboard</span>
        </button>
        <h1>Your Profile</h1>
      </header>

      <div className="profile-content card">
        <div className="card-header">
          <div className="header-title">
            <User size={20} className="icon" />
            <h2>Profile Details</h2>
          </div>
          {isEditing ? (
            <div className="action-buttons">
              <button
                onClick={handleSave}
                className="btn primary"
                disabled={isLoading}
              >
                <Save size={16} />
                {isLoading ? "Saving..." : "Save"}
              </button>
              <button
                onClick={handleEditToggle}
                className="btn secondary"
                disabled={isLoading}
              >
                <X size={16} />
                Cancel
              </button>
            </div>
          ) : (
            <button onClick={handleEditToggle} className="btn secondary">
              <Edit size={16} />
              Edit
            </button>
          )}
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="card-body">
          <div className="profile-avatar">
            <div className="avatar-placeholder">
              {currentUser.username.charAt(0).toUpperCase()}
            </div>
          </div>

          {isEditing ? (
            <div className="profile-form">
              <div className="form-group">
                <label htmlFor="username">Username</label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={editedUser.username}
                  onChange={handleInputChange}
                  disabled={isLoading}
                />
              </div>
              <div className="form-group">
                <label htmlFor="phoneNumber">Phone Number</label>
                <input
                  type="text"
                  id="phoneNumber"
                  name="phoneNumber"
                  value={editedUser.phoneNumber}
                  onChange={handleInputChange}
                  disabled={isLoading}
                />
              </div>
            </div>
          ) : (
            <div className="profile-details">
              <div className="detail-item">
                <span className="label">Username</span>
                <span className="value">{currentUser.username}</span>
              </div>
              <div className="detail-item">
                <span className="label">Phone</span>
                <span className="value">
                  {currentUser.phone_number || "Not provided"}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="profile-stats">
          <h3>Learning Progress</h3>
          <div className="progress-summary">
            {["reading", "writing", "speaking", "listening"].map((skill) => (
              <div key={skill} className="progress-item">
                <span className="skill-name">
                  {skill.charAt(0).toUpperCase() + skill.slice(1)}
                </span>
                <div className="progress-track">
                  <div
                    className="progress-value"
                    style={{
                      width: `${staticProgress[skill]}%`,
                    }}
                  ></div>
                </div>
                <span className="skill-percent">{staticProgress[skill]}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Profile;
