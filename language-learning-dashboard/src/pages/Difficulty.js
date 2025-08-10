import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import DrawingCanvas from "../components/DrawingCanvas";
import "../styles/easy1-styles.css";

const Difficulty = () => {
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentImage, setCurrentImage] = useState(null);
  const [evaluation, setEvaluation] = useState(null);
  const [completed, setCompleted] = useState(false);
  const [results, setResults] = useState([]);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [activeTab, setActiveTab] = useState("draw"); // 'draw' or 'upload'

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        "http://10.16.49.225:5000/api/generate/sentences"
      );

      if (!response.ok) {
        throw new Error("Failed to fetch questions");
      }

      const data = await response.json();
      setQuestions(data.questions);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleSaveImage = (base64Data) => {
    setCurrentImage(base64Data);
    setUploadedImage(null);
    setEvaluation(null);
  };

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64String = e.target.result.split(",")[1];
      setUploadedImage(base64String);
      setCurrentImage(base64String);
      setEvaluation(null);
      setActiveTab("upload");
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!currentImage) {
      alert("Please draw or upload an image first!");
      return;
    }

    try {
      const currentQuestion = questions[currentQuestionIndex];

      const response = await fetch(
        "http://10.16.49.225:5000/api/test/evaluate-single",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            target: currentQuestion.content,
            image: currentImage,
            question_index: currentQuestionIndex,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to evaluate writing");
      }

      const evaluationData = await response.json();
      setEvaluation(evaluationData);
      setResults((prev) => [...prev, evaluationData]);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setCurrentImage(null);
      setUploadedImage(null);
      setEvaluation(null);
      setActiveTab("draw");
    } else {
      setCompleted(true);
    }
  };

  const handleTryAgain = () => {
    setCurrentImage(null);
    setUploadedImage(null);
    setEvaluation(null);
  };

  const calculateScore = () => {
    const correctAnswers = results.filter((result) => result.is_correct).length;
    return {
      correct: correctAnswers,
      total: results.length,
      percentage: Math.round((correctAnswers / results.length) * 100),
    };
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Loading questions...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-screen">
        <h2>Error Loading Content</h2>
        <p>{error}</p>
        <button onClick={fetchQuestions} className="primary-button">
          Try Again
        </button>
      </div>
    );
  }

  if (completed) {
    const score = calculateScore();
    return (
      <div className="results-container">
        <div className="results-header">
          <h2>Practice Completed!</h2>
          <div className="score-display">
            <div className="score-circle">
              <span className="score-percent">{score.percentage}%</span>
              <span className="score-text">Score</span>
            </div>
            <p className="score-detail">
              {score.correct} out of {score.total} correct
            </p>
          </div>
        </div>

        <div className="results-details">
          <h3>Detailed Results</h3>
          <div className="results-list">
            {results.map((result, index) => (
              <div
                key={index}
                className={`result-item ${
                  result.is_correct ? "correct" : "incorrect"
                }`}
              >
                <div className="result-target">
                  <span className="result-label">Sentence:</span>
                  <span>{result.target}</span>
                </div>
                <div className="result-detected">
                  <span className="result-label">Detected:</span>
                  <span>{result.extracted_text || "None"}</span>
                </div>
                <div className="result-status">
                  {result.is_correct ? "✓ Correct" : "✗ Incorrect"}
                  <span className="result-accuracy">
                    (Accuracy: {result.accuracy}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="results-actions">
          <button
            onClick={() => window.location.reload()}
            className="primary-button"
          >
            Try Again
          </button>
          <Link to="/writing" className="secondary-button">
            Back to Menu
          </Link>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div className="practice-container">
      <div className="practice-header">
        <h1>Sentences Practice</h1>
        <div className="progress-tracker">
          <span className="progress-current">{currentQuestionIndex + 1}</span>
          <span className="progress-divider">/</span>
          <span className="progress-total">{questions.length}</span>
        </div>
      </div>

      <div className="question-card">
        <div className="question-prompt">
          <h2>Write the following sentence:</h2>
          <div className="sentence-display">"{currentQuestion?.content}"</div>
        </div>

        <div className="input-methods">
          <div className="method-tabs">
            <button
              className={`tab-button ${activeTab === "draw" ? "active" : ""}`}
              onClick={() => setActiveTab("draw")}
            >
              Draw
            </button>
            <button
              className={`tab-button ${activeTab === "upload" ? "active" : ""}`}
              onClick={() => setActiveTab("upload")}
            >
              Upload
            </button>
          </div>

          <div className="method-content">
            {activeTab === "draw" ? (
              <div className="drawing-container">
                <DrawingCanvas
                  onSave={handleSaveImage}
                  canvasWidth={700}
                  canvasHeight={400}
                  allowResize={true}
                />
                <p className="hint-text">Draw the sentence in the box above</p>
              </div>
            ) : (
              <div className="upload-container">
                {uploadedImage ? (
                  <div className="upload-preview">
                    <img
                      src={`data:image/jpeg;base64,${uploadedImage}`}
                      alt="Uploaded handwriting"
                    />
                    <button
                      onClick={() => setUploadedImage(null)}
                      className="replace-button"
                    >
                      Replace Image
                    </button>
                  </div>
                ) : (
                  <div className="upload-dropzone">
                    <input
                      type="file"
                      id="handwriting-upload"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="file-input"
                    />
                    <label
                      htmlFor="handwriting-upload"
                      className="upload-label"
                    >
                      <div className="upload-icon">↑</div>
                      <p className="upload-instructions">
                        Click to browse or drag & drop an image
                      </p>
                      <p className="upload-requirements">
                        Supports JPG, PNG (Max 5MB)
                      </p>
                    </label>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="action-buttons">
        <button
          onClick={handleSubmit}
          disabled={!currentImage}
          className="primary-button submit-button"
        >
          Submit Answer
        </button>
        <button
          onClick={handleTryAgain}
          disabled={!currentImage}
          className="secondary-button"
        >
          Clear
        </button>
      </div>

      {evaluation && (
        <div
          className={`evaluation-card ${
            evaluation.is_correct ? "correct" : "incorrect"
          }`}
        >
          <div className="evaluation-header">
            <h3>{evaluation.is_correct ? "Correct!" : "Needs Practice"}</h3>
            <div className="accuracy-badge">{evaluation.accuracy}% Match</div>
          </div>

          <div className="evaluation-details">
            <div className="detail-row">
              <span className="detail-label">Expected:</span>
              <span className="detail-value">"{evaluation.target}"</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Detected:</span>
              <span className="detail-value">
                "{evaluation.extracted_text || "None"}"
              </span>
            </div>
            <div className="feedback">{evaluation.feedback}</div>
          </div>

          <button
            onClick={handleNextQuestion}
            className="primary-button next-button"
          >
            {currentQuestionIndex < questions.length - 1
              ? "Continue to Next Sentence"
              : "View Results"}
          </button>
        </div>
      )}

      <Link to="/writing" className="back-link">
        ← Back to Practice Menu
      </Link>
    </div>
  );
};

export default Difficulty;
