import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import DrawingCanvas from "../components/DrawingCanvas";
import "../styles/easy1-styles.css";

const Easy1 = () => {
  // Get username from location state
  const location = useLocation();
  const username = location.state?.username || "User";

  console.log("Username in Easy1 component:", username);

  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentImage, setCurrentImage] = useState(null);
  const [evaluation, setEvaluation] = useState(null);
  const [completed, setCompleted] = useState(false);
  const [results, setResults] = useState([]);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [activeTab, setActiveTab] = useState("draw");
  const [convertedText, setConvertedText] = useState("");
  const [isConverting, setIsConverting] = useState(false);
  const [notepadContent, setNotepadContent] = useState([]);
  const [currentLetter, setCurrentLetter] = useState("");
  const [selectedLetterIndex, setSelectedLetterIndex] = useState(null);
  const [showDeletePrompt, setShowDeletePrompt] = useState(false);

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        "http://10.16.49.225:5000/api/generate/letters"
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

  const handleLetterComplete = async (base64Data) => {
    try {
      setIsConverting(true);
      const response = await fetch("http://10.16.49.225:5000/api/ocr/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64Data }),
      });

      const { text } = await response.json();
      const cleanText = text.trim().charAt(0) || "";

      setCurrentLetter(cleanText);
      setCurrentImage(base64Data);
      setIsConverting(false);
    } catch (error) {
      console.error("Conversion error:", error);
      setIsConverting(false);
    }
  };

  const handleAddToNotepad = () => {
    if (currentLetter) {
      setNotepadContent((prev) => [...prev, currentLetter]);
      setCurrentLetter("");
    }
  };

  const handleLetterSelect = (index) => {
    setSelectedLetterIndex(index);
    setShowDeletePrompt(true);
  };

  const handleDeleteLetter = () => {
    if (selectedLetterIndex !== null) {
      setNotepadContent((prev) =>
        prev.filter((_, idx) => idx !== selectedLetterIndex)
      );
      setSelectedLetterIndex(null);
      setShowDeletePrompt(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === " " && showDeletePrompt) {
        handleDeleteLetter();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showDeletePrompt]);

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64String = e.target.result.split(",")[1];
      setUploadedImage(base64String);
      setCurrentImage(base64String);
      setEvaluation(null);
      setConvertedText("");
      setActiveTab("upload");
    };
    reader.readAsDataURL(file);
  };

  const handleConvertToText = async (base64Data) => {
    setIsConverting(true);
    try {
      const response = await fetch("http://10.16.49.225:5000/api/ocr/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64Data }),
      });

      if (!response.ok) {
        throw new Error("Conversion failed");
      }

      const data = await response.json();
      setConvertedText(data.text || "No text detected");
      return data.text;
    } catch (err) {
      setError(err.message);
      setConvertedText("Conversion error");
      return null;
    } finally {
      setIsConverting(false);
    }
  };

  const handleSubmit = async () => {
    if (!currentImage) {
      alert("Please draw or upload an image first!");
      return;
    }

    try {
      const currentQuestion = questions[currentQuestionIndex];

      // Get the text to evaluate - use notepad content if available, otherwise use current letter
      const textToEvaluate =
        notepadContent.length > 0 ? notepadContent.join("") : currentLetter;

      const response = await fetch(
        "http://10.16.49.225:5000/api/test/evaluate-single",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: username,
            target: currentQuestion.content,
            image: currentImage, // Send the image for OCR verification
            type: "letter", // Explicitly specify this is a letter
            extracted_text: textToEvaluate, // Send what the user sees in notepad
          }),
        }
      );

      const evaluationData = await response.json();
      setEvaluation(evaluationData);
      setResults((prev) => [...prev, evaluationData]);

      // Clear for next question only if evaluation was successful
      if (!evaluationData.error) {
        setTimeout(handleNextQuestion, 1500);
      }
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
      setConvertedText("");
      setCurrentLetter("");
      setActiveTab("draw");
    } else {
      setCompleted(true);
    }
  };

  const handleTryAgain = () => {
    setCurrentImage(null);
    setUploadedImage(null);
    setEvaluation(null);
    setConvertedText("");
    setCurrentLetter("");
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
      <div className="loading-container">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <p>உங்கள் பயிற்சி அமர்வு தயாராகிறது...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <div className="error-card">
          <h2>இணைப்பு பிழை</h2>
          <p>பயிற்சி உள்ளடக்கத்தை ஏற்ற முடியவில்லை. {error}</p>
          <button onClick={fetchQuestions} className="retry-button">
            மீண்டும் முயற்சிக்கவும்
          </button>
          <Link to="/writing" className="back-button">
            மெனுவுக்கு திரும்புக
          </Link>
        </div>
      </div>
    );
  }

  if (completed) {
    const score = calculateScore();
    return (
      <div className="results-page">
        <header className="results-header">
          <h1>பயிற்சி முடிவுகள்</h1>
          <Link to="/writing" className="close-button">
            &times;
          </Link>
        </header>

        <div className="results-summary">
          <div className="score-circle">
            <div className="score-value">{score.percentage}%</div>
            <div className="score-label">துல்லியம்</div>
          </div>
          <div className="score-details">
            <div className="detail-item">
              <span className="detail-number">{score.correct}</span>
              <span className="detail-label">சரியானது</span>
            </div>
            <div className="detail-item">
              <span className="detail-number">
                {score.total - score.correct}
              </span>
              <span className="detail-label">பயிற்சி தேவை</span>
            </div>
            <div className="detail-item">
              <span className="detail-number">{score.total}</span>
              <span className="detail-label">மொத்தம்</span>
            </div>
          </div>
        </div>

        <div className="results-breakdown">
          <h2>எழுத்து வாரியான முடிவுகள்</h2>
          <div className="results-grid">
            {results.map((result, index) => (
              <div
                key={index}
                className={`result-item ${
                  result.is_correct ? "correct" : "incorrect"
                }`}
              >
                <div className="result-letter">{result.target}</div>
                <div className="result-status">
                  {result.is_correct ? (
                    <span className="correct-icon">✓</span>
                  ) : (
                    <span className="incorrect-icon">✗</span>
                  )}
                  <span>{result.accuracy}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="results-actions">
          <button
            onClick={() => window.location.reload()}
            className="primary-action"
          >
            மீண்டும் பயிற்சி
          </button>
          <Link
            to="/writing"
            state={{ username }} // Pass username back to Writing
            className="secondary-action"
          >
            வேறு பயிற்சியை தேர்ந்தெடுக்கவும்
          </Link>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div className="app-container">
      {/* Header Section */}
      <header className="app-header">
        <div className="header-content">
          <Link
            to="/writing"
            state={{ username }} // Pass username back to Writing
            className="back-button"
          >
            <span>&larr;</span>
          </Link>
          <h1>எழுத்து பயிற்சி</h1>
          <div className="progress-indicator">
            {currentQuestionIndex + 1} / {questions.length}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="app-main">
        {/* Current Letter Prompt */}
        <section className="letter-prompt-section">
          <div className="prompt-card">
            <h2>இந்த எழுத்தை எழுதவும்:</h2>
            <div className="target-letter">{currentQuestion?.content}</div>
          </div>
        </section>

        {/* Input Methods */}
        <section className="input-section">
          <div className="input-tabs">
            <button
              className={`tab ${activeTab === "draw" ? "active" : ""}`}
              onClick={() => setActiveTab("draw")}
            >
              வரையவும்
            </button>
            <button
              className={`tab ${activeTab === "upload" ? "active" : ""}`}
              onClick={() => setActiveTab("upload")}
            >
              பதிவேற்றம்
            </button>
          </div>

          <div className="input-content">
            {activeTab === "draw" ? (
              <div className="drawing-area">
                <DrawingCanvas
                  onSave={handleLetterComplete}
                  canvasWidth={Math.min(window.innerWidth - 40, 500)}
                  canvasHeight={300}
                />
                <p className="drawing-hint">
                  மேலே உள்ள இடத்தில் எழுத்தை வரையவும்
                </p>
              </div>
            ) : (
              <div className="upload-area">
                {uploadedImage ? (
                  <div className="upload-preview-container">
                    <img
                      src={`data:image/jpeg;base64,${uploadedImage}`}
                      alt="பதிவேற்றப்பட்ட கையெழுத்து"
                      className="uploaded-image"
                    />
                    <div className="upload-actions">
                      <button
                        onClick={() => setUploadedImage(null)}
                        className="secondary-button"
                      >
                        மாற்றவும்
                      </button>
                      <button
                        onClick={() => handleConvertToText(uploadedImage)}
                        disabled={isConverting}
                        className="primary-button"
                      >
                        {isConverting ? "செயலாக்குகிறது..." : "மாற்றுக"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="upload-dropzone">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="file-input"
                    />
                    <div className="dropzone-content">
                      <div className="upload-icon">+</div>
                      <p>பதிவேற்ற கிளிக் செய்யவும் அல்லது இழுத்து விடவும்</p>
                      <p className="file-requirements">
                        JPG அல்லது PNG, அதிகபட்சம் 5MB
                      </p>
                    </div>
                  </label>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Converted Text Display */}
        {convertedText && (
          <section className="converted-text-section">
            <h3>கண்டறியப்பட்ட உரை:</h3>
            <div className="text-display">{convertedText}</div>
          </section>
        )}

        {/* Current Letter Preview */}
        {currentLetter && (
          <section className="current-letter-section">
            <h3>உங்கள் எழுத்து:</h3>
            <div className="letter-preview">
              {currentLetter}
              <button onClick={handleAddToNotepad} className="add-button">
                குறிப்பேட்டில் சேர்க்கவும்
              </button>
            </div>
          </section>
        )}

        {/* Notepad Section */}
        <section className="notepad-section">
          <div className="notepad-header">
            <h3>உங்கள் முன்னேற்றம்</h3>
            <div className="notepad-counter">
              {notepadContent.length}{" "}
              {notepadContent.length === 1 ? "எழுத்து" : "எழுத்துகள்"}
            </div>
          </div>
          <div className="notepad-content">
            {notepadContent.length > 0 ? (
              <div className="letters-grid">
                {notepadContent.map((letter, index) => (
                  <div
                    key={index}
                    className={`letter-tile ${
                      selectedLetterIndex === index ? "selected" : ""
                    }`}
                    onClick={() => handleLetterSelect(index)}
                  >
                    {letter}
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-notepad">
                <p>உங்கள் பயிற்சி எழுத்துகள் இங்கே தோன்றும்</p>
              </div>
            )}
          </div>
        </section>

        {/* Action Buttons */}
        <section className="action-buttons">
          <button
            onClick={handleTryAgain}
            disabled={!currentImage}
            className="secondary-button"
          >
            அழி
          </button>
          <button
            onClick={() => handleSubmit()}
            disabled={!currentImage}
            className="primary-button"
          >
            சமர்ப்பிக்கவும்
          </button>
        </section>
      </main>

      {/* Evaluation Modal */}
      {evaluation && (
        <div className="evaluation-modal">
          <div className="modal-content">
            <div
              className={`result-header ${
                evaluation.is_correct ? "success" : "warning"
              }`}
            >
              <h2>{evaluation.is_correct ? "நல்லது!" : "பயிற்சி தேவை"}</h2>
              <div className="accuracy-score">
                {evaluation.accuracy}% பொருத்தம்
              </div>
            </div>

            <div className="result-details">
              <div className="detail-row">
                <span className="detail-label">எதிர்பார்க்கப்பட்டது:</span>
                <span className="detail-value">{evaluation.target}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">நீங்கள் எழுதியது:</span>
                <span className="detail-value">
                  {evaluation.extracted_text || "எழுத்து கண்டறியப்படவில்லை"}
                </span>
              </div>
              <div className="feedback">{evaluation.feedback}</div>
            </div>

            <button onClick={handleNextQuestion} className="continue-button">
              {currentQuestionIndex < questions.length - 1
                ? "தொடரவும்"
                : "முடிவுகளைக் காண்க"}
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeletePrompt && (
        <div className="confirmation-modal">
          <div className="modal-content">
            <h3>இந்த எழுத்தை நீக்கவா?</h3>
            <p>நீக்க SPACEBAR ஐ அழுத்தவும்</p>
            <div className="modal-actions">
              <button
                onClick={() => setShowDeletePrompt(false)}
                className="cancel-button"
              >
                ரத்துசெய்
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Easy1;
