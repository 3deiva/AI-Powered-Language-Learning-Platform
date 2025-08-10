import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import "../styles/Listening.css";

const API_BASE_URL = "http://10.16.49.225:5001";

const Listening = () => {
  const [stories, setStories] = useState({});
  const [selectedStory, setSelectedStory] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [tamilAnswer, setTamilAnswer] = useState("");
  const [completion, setCompletion] = useState(0);
  const [storyCompleted, setStoryCompleted] = useState(false);
  const [quiz, setQuiz] = useState([]);
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [quizFeedback, setQuizFeedback] = useState("");
  const [showQuiz, setShowQuiz] = useState(false);
  const [currentSentence, setCurrentSentence] = useState("");
  const [sentenceHistory, setSentenceHistory] = useState([]);

  // New state variables based on backend
  const [fullText, setFullText] = useState("");
  const [culturalNotes, setCulturalNotes] = useState({});
  const [keyVocabulary, setKeyVocabulary] = useState([]);
  const [analyzedText, setAnalyzedText] = useState([]);
  const [currentTranslation, setCurrentTranslation] = useState("");
  const [availableLanguages, setAvailableLanguages] = useState({});
  const [selectedLanguage, setSelectedLanguage] = useState("ta"); // Default Tamil
  const [difficultyLevel, setDifficultyLevel] = useState("beginner");
  const [speechSpeed, setSpeechSpeed] = useState(1.0);
  const [userProgress, setUserProgress] = useState({});
  const [showTranscript, setShowTranscript] = useState(false);
  const [keywords, setKeywords] = useState([]);
  const [recordingStatus, setRecordingStatus] = useState("idle");
  const [recordedAudio, setRecordedAudio] = useState(null);
  const [pronunciationFeedback, setPronunciationFeedback] = useState(null);

  const audioRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  useEffect(() => {
    // Fetch available stories
    axios
      .get(`${API_BASE_URL}/api/get_stories`)
      .then((response) => {
        console.log("Stories response:", response.data);
        if (response.data && response.data.stories) {
          setStories(response.data.stories);
        } else {
          console.error("Unexpected response format:", response.data);
          // Set empty object if data structure is unexpected
          setStories({});
        }
      })
      .catch((error) => {
        console.error("Error fetching stories:", error);
        // Set empty object on error
        setStories({});
      });

    // Fetch available languages
    axios
      .get(`${API_BASE_URL}/api/get_languages`)
      .then((response) => {
        setAvailableLanguages(response.data.languages);
      })
      .catch((error) => {
        console.error("Error fetching languages:", error);
      });
  }, []);
  const selectStory = (type) => {
    axios
      .post(`${API_BASE_URL}/api/select_story`, { type })
      .then((response) => {
        setSelectedStory(response.data.story_title);
        setFullText(response.data.full_text);
        setCulturalNotes(response.data.cultural_notes);
        setKeyVocabulary(response.data.key_vocabulary);
        setAnalyzedText(response.data.analyzed_text);
        setDifficultyLevel(response.data.difficulty);
        setIsPlaying(true);
        setIsPaused(false);
        setStoryCompleted(false);
        setSentenceHistory([]);
        setCurrentSentence("");
        setCurrentTranslation("");
        startProgressTracking();
      })
      .catch((error) => {
        console.error("Error selecting story:", error);
      });
  };

  const startProgressTracking = () => {
    const interval = setInterval(() => {
      axios
        .get(`${API_BASE_URL}/api/get_story_status`)
        .then((response) => {
          setCompletion(response.data.completion_percentage);

          // Update current sentence and translation
          if (
            response.data.current_sentence &&
            response.data.current_sentence !== currentSentence
          ) {
            if (currentSentence) {
              setSentenceHistory((prev) =>
                [currentSentence, ...prev].slice(0, 5)
              ); // Keep last 5 sentences
            }
            setCurrentSentence(response.data.current_sentence);
            setCurrentTranslation(response.data.translation);
          }

          if (response.data.is_completed) {
            setStoryCompleted(true);
            clearInterval(interval);
          }
        })
        .catch((error) => {
          console.error("Error getting story status:", error);
          clearInterval(interval);
        });
    }, 1000);
  };

  const pauseStory = () => {
    axios
      .post(`${API_BASE_URL}/api/pause_story`)
      .then(() => {
        setIsPlaying(false);
        setIsPaused(true);
      })
      .catch((error) => {
        console.error("Error pausing story:", error);
      });
  };

  const continueStory = () => {
    axios
      .post(`${API_BASE_URL}/api/continue_story`)
      .then(() => {
        setIsPlaying(true);
        setIsPaused(false);
      })
      .catch((error) => {
        console.error("Error continuing story:", error);
      });
  };

  const repeatCurrent = () => {
    axios
      .post(`${API_BASE_URL}/api/repeat_current`)
      .then(() => {
        setIsPlaying(true);
        setIsPaused(false);
      })
      .catch((error) => {
        console.error("Error repeating section:", error);
      });
  };

  const askQuestion = () => {
    if (!currentQuestion.trim()) return;

    axios
      .post(`${API_BASE_URL}/api/ask_question`, {
        question: currentQuestion,
      })
      .then((response) => {
        setAnswer(response.data.answer);
        setTamilAnswer(response.data.translation);
        setKeywords(response.data.keywords || []);
        setCurrentQuestion("");
      })
      .catch((error) => {
        console.error("Error asking question:", error);
      });
  };

  const generateQuiz = () => {
    axios
      .get(`${API_BASE_URL}/api/generate_quiz`)
      .then((response) => {
        setQuiz(response.data.quiz);
        setCurrentQuizIndex(0);
        setShowQuiz(true);
        setUserAnswer("");
        setQuizFeedback("");
      })
      .catch((error) => {
        console.error("Error generating quiz:", error);
      });
  };

  const checkAnswer = () => {
    const currentQuestion = quiz[currentQuizIndex];

    axios
      .post(`${API_BASE_URL}/api/check_answer`, {
        type: currentQuestion.type,
        user_answer: userAnswer,
        correct_answer: currentQuestion.answer,
      })
      .then((response) => {
        setQuizFeedback(response.data.message);
        setTimeout(() => {
          if (currentQuizIndex < quiz.length - 1) {
            setCurrentQuizIndex(currentQuizIndex + 1);
            setUserAnswer("");
            setQuizFeedback("");
          } else {
            setShowQuiz(false);
            setQuiz([]);
            setCurrentQuizIndex(0);
            // Get updated user progress after quiz
            getUserProgress();
          }
        }, 3000);
      })
      .catch((error) => {
        console.error("Error checking answer:", error);
      });
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      if (showQuiz) {
        checkAnswer();
      } else {
        askQuestion();
      }
    }
  };

  const setPreferences = () => {
    axios
      .post(`${API_BASE_URL}/api/set_preferences`, {
        speed: speechSpeed,
        language: selectedLanguage,
        difficulty: difficultyLevel,
      })
      .then((response) => {
        console.log("Preferences updated:", response.data.preferences);
      })
      .catch((error) => {
        console.error("Error setting preferences:", error);
      });
  };

  const getUserProgress = () => {
    axios
      .get(`${API_BASE_URL}/api/get_user_progress`)
      .then((response) => {
        setUserProgress(response.data);
      })
      .catch((error) => {
        console.error("Error getting user progress:", error);
      });
  };

  const getTranscript = () => {
    axios
      .get(`${API_BASE_URL}/api/get_transcript`)
      .then((response) => {
        setAnalyzedText(response.data.transcript);
        setCulturalNotes(response.data.cultural_notes);
        setShowTranscript(true);
      })
      .catch((error) => {
        console.error("Error getting transcript:", error);
      });
  };

  const pronounceWord = (word) => {
    axios
      .post(`${API_BASE_URL}/api/pronounce_word`, { word })
      .then((response) => {
        console.log("Pronouncing word:", response.data);
      })
      .catch((error) => {
        console.error("Error pronouncing word:", error);
      });
  };

  // Pronunciation practice functions
  const startRecording = () => {
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        setRecordingStatus("recording");
        mediaRecorderRef.current = new MediaRecorder(stream);
        audioChunksRef.current = [];

        mediaRecorderRef.current.ondataavailable = (e) => {
          audioChunksRef.current.push(e.data);
        };

        mediaRecorderRef.current.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, {
            type: "audio/wav",
          });
          setRecordedAudio(audioBlob);
          setRecordingStatus("recorded");
        };

        mediaRecorderRef.current.start();
      })
      .catch((error) => {
        console.error("Error accessing microphone:", error);
        setRecordingStatus("error");
      });
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recordingStatus === "recording") {
      mediaRecorderRef.current.stop();
    }
  };

  const checkPronunciation = (textToCheck) => {
    if (!recordedAudio) return;

    const formData = new FormData();
    formData.append("audio", recordedAudio);
    formData.append("text", textToCheck);

    setRecordingStatus("checking");

    axios
      .post(`${API_BASE_URL}/api/check_pronunciation`, formData)
      .then((response) => {
        setPronunciationFeedback(response.data);
        setRecordingStatus("idle");
      })
      .catch((error) => {
        console.error("Error checking pronunciation:", error);
        setRecordingStatus("error");
      });
  };

  const getLanguageName = (code) => {
    const languages = {
      ta: "Tamil",
      hi: "Hindi",
      es: "Spanish",
      fr: "French",
      de: "German",
      "zh-CN": "Chinese",
      ja: "Japanese",
      ko: "Korean",
    };
    return languages[code] || code;
  };

  useEffect(() => {
    // Apply preferences when they change
    if (selectedStory) {
      setPreferences();
    }
  }, [speechSpeed, selectedLanguage, difficultyLevel]);

  return (
    <div className="listening-container">
      <h1>English Listening Practice</h1>

      {!selectedStory ? (
        <div className="story-selection">
          <h2>Choose a Story</h2>
          <div className="story-buttons">
            {Object.keys(stories).length > 0 ? (
              Object.keys(stories).map((story) => (
                <button key={story} onClick={() => selectStory(story)}>
                  {story.charAt(0).toUpperCase() + story.slice(1)} Story
                  {stories[story] && (
                    <span className="story-preview">
                      <small>
                        ({stories[story].difficulty || "unknown"} ·{" "}
                        {stories[story].word_count || 0} words)
                      </small>
                    </span>
                  )}
                </button>
              ))
            ) : (
              <p>Loading stories... or No stories available.</p>
            )}
          </div>

          {Object.keys(userProgress).length > 0 && (
            <div className="user-progress">
              <h3>Your Progress</h3>
              <p>Stories completed: {userProgress.stories_completed}</p>
              <p>
                Listening time: {userProgress.listening_time_minutes} minutes
              </p>
              <p>Quiz accuracy: {userProgress.quiz_accuracy}%</p>
            </div>
          )}
        </div>
      ) : (
        <div className="story-player">
          <h2>{selectedStory}</h2>

          <div className="preferences-panel">
            <div className="preference">
              <label>Speed:</label>
              <select
                value={speechSpeed}
                onChange={(e) => setSpeechSpeed(parseFloat(e.target.value))}
              >
                <option value="0.8">Slow</option>
                <option value="1.0">Normal</option>
                <option value="1.2">Fast</option>
              </select>
            </div>

            <div className="preference">
              <label>Translation:</label>
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
              >
                {Object.entries(availableLanguages).map(([name, code]) => (
                  <option key={code} value={code}>
                    {name.charAt(0).toUpperCase() + name.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div className="preference">
              <label>Difficulty:</label>
              <select
                value={difficultyLevel}
                onChange={(e) => setDifficultyLevel(e.target.value)}
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
          </div>

          <div className="progress-bar">
            <div className="progress" style={{ width: `${completion}%` }}></div>
          </div>

          <div className="player-controls">
            {isPlaying && !isPaused ? (
              <button onClick={pauseStory} className="control-button">
                Pause
              </button>
            ) : (
              <button onClick={continueStory} className="control-button">
                Continue
              </button>
            )}
            <button onClick={repeatCurrent} className="control-button">
              Repeat Section
            </button>
            <button onClick={getTranscript} className="control-button">
              {showTranscript ? "Hide Transcript" : "Show Transcript"}
            </button>
          </div>

          <div className="story-text">
            {sentenceHistory.map((sentence, index) => (
              <p key={index} className="history-sentence">
                {sentence}
              </p>
            ))}
            {currentSentence && (
              <div>
                <p className="active-sentence">{currentSentence}</p>
                {currentTranslation && (
                  <p className="translation">
                    ({getLanguageName(selectedLanguage)}): {currentTranslation}
                  </p>
                )}
              </div>
            )}
          </div>

          {showTranscript && (
            <div className="transcript-container">
              <h3>Interactive Transcript</h3>
              <div className="transcript-text">
                {analyzedText.map((word, idx) => (
                  <span
                    key={idx}
                    className={
                      word.is_punctuation
                        ? ""
                        : `word ${word.difficulty} ${
                            word.is_key ? "key-word" : ""
                          }`
                    }
                    onClick={() =>
                      !word.is_punctuation && pronounceWord(word.word)
                    }
                    title={
                      word.definition
                        ? `${word.definition} (Click to hear pronunciation)`
                        : ""
                    }
                  >
                    {word.word}{" "}
                  </span>
                ))}
              </div>

              {Object.keys(culturalNotes).length > 0 && (
                <div className="cultural-notes">
                  <h4>Cultural Notes</h4>
                  <ul>
                    {Object.entries(culturalNotes).map(([term, note]) => (
                      <li key={term}>
                        <strong>{term}</strong>: {note}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="pronunciation-practice">
                <h4>Practice Pronunciation</h4>
                <div className="practice-controls">
                  {recordingStatus === "idle" && (
                    <button onClick={startRecording}>Start Recording</button>
                  )}
                  {recordingStatus === "recording" && (
                    <button onClick={stopRecording}>Stop Recording</button>
                  )}
                  {recordingStatus === "recorded" && (
                    <button onClick={() => checkPronunciation(currentSentence)}>
                      Check Pronunciation
                    </button>
                  )}

                  {pronunciationFeedback && (
                    <div
                      className={`pronunciation-feedback ${
                        pronunciationFeedback.success ? "correct" : "incorrect"
                      }`}
                    >
                      <p>
                        <strong>Score:</strong>{" "}
                        {Math.round(pronunciationFeedback.score * 100)}%
                      </p>
                      <p>
                        <strong>Your speech:</strong>{" "}
                        {pronunciationFeedback.recognized}
                      </p>
                      {!pronunciationFeedback.success && (
                        <p>Try again! Focus on clear pronunciation.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="question-section">
            <h3>Ask a Question</h3>
            <input
              type="text"
              value={currentQuestion}
              onChange={(e) => setCurrentQuestion(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask about the story..."
            />
            <button onClick={askQuestion}>Ask</button>

            {answer && (
              <div className="answer-section">
                <h4>Answer:</h4>
                <p>{answer}</p>
                {tamilAnswer && (
                  <div className="tamil-translation">
                    <h5>{getLanguageName(selectedLanguage)}:</h5>
                    <p>{tamilAnswer}</p>
                  </div>
                )}

                {keywords.length > 0 && (
                  <div className="keywords">
                    <h5>Key Words:</h5>
                    <div className="keyword-list">
                      {keywords.map((word, index) => (
                        <span
                          key={index}
                          className="keyword"
                          onClick={() => pronounceWord(word)}
                        >
                          {word}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {storyCompleted && !showQuiz && (
            <div className="quiz-section">
              <h3>Story Completed!</h3>
              <button onClick={generateQuiz} className="quiz-button">
                Take Quiz
              </button>
            </div>
          )}

          {showQuiz && quiz.length > 0 && (
            <div className="quiz-container">
              <h3>Quiz</h3>
              <div className="quiz-question">
                <p>{quiz[currentQuizIndex].question}</p>

                {quiz[currentQuizIndex].type === "multiple_choice" ? (
                  <div className="options">
                    {quiz[currentQuizIndex].options.map((option, index) => (
                      <button
                        key={index}
                        onClick={() => setUserAnswer(option)}
                        className={userAnswer === option ? "selected" : ""}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                ) : quiz[currentQuizIndex].type === "fill_blank" ? (
                  <div>
                    <div className="options">
                      {quiz[currentQuizIndex].options.map((option, index) => (
                        <button
                          key={index}
                          onClick={() => setUserAnswer(option)}
                          className={userAnswer === option ? "selected" : ""}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                    <div className="blank-preview">
                      {quiz[currentQuizIndex].full_sentence && (
                        <button
                          className="pronunciation-button"
                          onClick={() =>
                            pronounceWord(quiz[currentQuizIndex].full_sentence)
                          }
                        >
                          🔊 Listen to sentence
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <input
                    type="text"
                    value={userAnswer}
                    onChange={(e) => setUserAnswer(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type your answer..."
                  />
                )}

                <button onClick={checkAnswer} className="submit-button">
                  Submit
                </button>

                {quizFeedback && (
                  <div
                    className={`feedback ${
                      quizFeedback.includes("correct") ? "correct" : "incorrect"
                    }`}
                  >
                    {quizFeedback}
                  </div>
                )}
              </div>

              <div className="quiz-progress">
                Question {currentQuizIndex + 1} of {quiz.length}
              </div>
            </div>
          )}
        </div>
      )}

      <audio ref={audioRef} />
    </div>
  );
};

export default Listening;
