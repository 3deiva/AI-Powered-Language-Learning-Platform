import React, { useState, useEffect, useRef } from "react";
import "../styles/letterGame.css";

function App() {
  const [user, setUser] = useState({
    id: "user_" + Math.random().toString(36).substr(2, 9),
    difficulty: 1,
    streak: 0,
    questionsCompleted: 0,
  });
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [userAnswer, setUserAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [audioReady, setAudioReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [performance, setPerformance] = useState({ correct: 0, total: 0 });
  const [exerciseDistribution, setExerciseDistribution] = useState({
    speaking_word: 0,
    speaking_sentence: 0,
    listening: 0,
    writing: 0,
  });
  const [isRecording, setIsRecording] = useState(false);
  const [pastQuestionIds, setPastQuestionIds] = useState([]);
  const [deviceCompatible, setDeviceCompatible] = useState(true);

  const recognitionRef = useRef(null);
  const audioRef = useRef(null);
  const fetchingRef = useRef(false);

  // Check device compatibility on mount
  useEffect(() => {
    // Check for speech recognition support
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const deviceSupportsRecognition = !!SpeechRecognition;

    if (!deviceSupportsRecognition) {
      setFeedback(
        "Speech recognition not supported on this device/browser. Try Chrome on desktop or Android."
      );
      setDeviceCompatible(false);
    }

    // Check audio support
    const audio = new Audio();
    if (!audio.canPlayType("audio/mpeg")) {
      setFeedback(
        (prev) => prev + " MP3 audio not supported on this device/browser."
      );
    }

    // Initialize audio context for mobile
    const initAudioContext = () => {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        const audioCtx = new AudioContext();
        document.removeEventListener("touchstart", initAudioContext);
        document.removeEventListener("click", initAudioContext);
      }
    };

    document.addEventListener("touchstart", initAudioContext, { once: true });
    document.addEventListener("click", initAudioContext, { once: true });

    return () => {
      document.removeEventListener("touchstart", initAudioContext);
      document.removeEventListener("click", initAudioContext);
    };
  }, []);

  // Setup speech recognition
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (!recognitionRef.current) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.maxAlternatives = 3; // Get multiple possible interpretations
      recognitionRef.current.lang = "en-US";

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        console.log("Recognition result:", transcript);
        setUserAnswer(transcript);
        setIsRecording(false);
        setFeedback("Recording complete!");
      };

      recognitionRef.current.onerror = (event) => {
        console.error("Speech recognition error", event.error);
        setIsRecording(false);

        let errorMsg = "Speech recognition failed.";
        if (event.error === "not-allowed") {
          errorMsg =
            "Microphone access denied. Please check your browser settings.";
        } else if (event.error === "no-speech") {
          errorMsg = "No speech detected. Please try again and speak clearly.";
        } else if (event.error === "network") {
          errorMsg = "Network error occurred. Please check your connection.";
        }

        setFeedback(errorMsg);
      };

      recognitionRef.current.onend = () => {
        setIsRecording(false);
      };
    }

    // Only fetch question once
    if (!fetchingRef.current) {
      fetchingRef.current = true;
      fetchQuestion();
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Ignore errors on cleanup
        }
      }
    };
  }, []);

  // Enhanced audio playback function
  const playAudio = (url) => {
    if (!url) {
      setFeedback("Audio example not available");
      return;
    }

    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    // Visual feedback to let user know something is happening
    setFeedback("Loading audio...");
    setAudioReady(false);

    // Create new audio with cache busting
    const audioUrl = url.startsWith("/")
      ? `http://10.16.49.225:5003${url}?t=${Date.now()}`
      : `${url}?t=${Date.now()}`;

    console.log("Attempting to load audio from:", audioUrl);

    audioRef.current = new Audio(audioUrl);

    // Set up all event handlers first before loading
    audioRef.current.oncanplaythrough = () => {
      console.log("Audio ready to play");
      setAudioReady(true);
      setFeedback("Audio loaded, playing now...");

      // Play with better error handling
      audioRef.current
        .play()
        .then(() => {
          console.log("Audio playback started successfully");
        })
        .catch((e) => {
          console.error("Playback failed:", e);
          // On mobile, autoplay is often blocked without user interaction
          if (e.name === "NotAllowedError") {
            setFeedback(
              "Please tap the play button to hear the word (autoplay blocked by browser)"
            );
          } else {
            setFeedback("Click the play button again to hear the word");
          }
        });
    };

    audioRef.current.onerror = (e) => {
      const errorMessage = audioRef.current.error
        ? `Error code: ${audioRef.current.error.code}`
        : "Unknown error";
      console.error(`Audio loading error: ${errorMessage}`, e);
      setFeedback(
        `Audio failed to load. Please try again or skip this question.`
      );
      setAudioReady(false);
    };

    audioRef.current.onended = () => {
      console.log("Audio playback completed");
      setAudioReady(false);
    };

    // Force load the audio
    audioRef.current.load();
  };

  // Auto-play audio for certain question types with delay to ensure component is fully mounted
  useEffect(() => {
    if (
      currentQuestion?.exercise_type === "speaking_word" &&
      currentQuestion?.audio_url
    ) {
      // Auto-play after short delay
      const timer = setTimeout(() => {
        playAudio(currentQuestion.audio_url);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [currentQuestion]);

  // Enhanced speech recognition function
  const handleSpeakingExercise = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setFeedback(
        "Speech recognition not supported in your browser. Try Chrome or Edge."
      );
      return;
    }

    if (!recognitionRef.current) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.maxAlternatives = 3;
      recognitionRef.current.lang = "en-US";

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        console.log("Recognition result:", transcript);
        setUserAnswer(transcript);
        setIsRecording(false);
        setFeedback("Recording complete!");
      };

      recognitionRef.current.onerror = (event) => {
        console.error("Speech recognition error", event.error);
        setIsRecording(false);

        let errorMsg = "Speech recognition failed.";
        if (event.error === "not-allowed") {
          errorMsg =
            "Microphone access denied. Please check your browser settings.";
        } else if (event.error === "no-speech") {
          errorMsg = "No speech detected. Please try again and speak clearly.";
        } else if (event.error === "network") {
          errorMsg = "Network error occurred. Please check your connection.";
        }

        setFeedback(errorMsg);
      };

      recognitionRef.current.onend = () => {
        setIsRecording(false);
      };
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
      return;
    }

    // Reset states
    setUserAnswer("");
    setFeedback("Listening... Speak now!");

    try {
      recognitionRef.current.stop();
      setTimeout(() => {
        try {
          recognitionRef.current.start();
          setIsRecording(true);

          // Safety timeout to stop recording if onend doesn't fire
          setTimeout(() => {
            if (isRecording) {
              try {
                recognitionRef.current.stop();
                setIsRecording(false);
              } catch (e) {
                // Ignore errors
              }
            }
          }, 10000);
        } catch (e) {
          console.error("Failed to start recognition:", e);
          setFeedback(`Could not start speech recognition: ${e.message}`);
          setIsRecording(false);
        }
      }, 100);
    } catch (e) {
      console.error("Recognition error:", e);
      // More specific error message
      if (e.name === "NotAllowedError") {
        setFeedback(
          "Microphone access denied. Please check permissions in your browser settings."
        );
      } else {
        setFeedback(`Microphone error: ${e.message}. Please try again.`);
      }
      setIsRecording(false);
    }
  };

  // Smart exercise type distribution logic
  const determineNextExerciseType = () => {
    const questionNum = user.questionsCompleted;

    if (questionNum < 3) return "speaking_word";
    if (questionNum < 5) return "speaking_sentence";

    const writingNeeded = Math.max(0, 3 - exerciseDistribution.writing);
    const listeningNeeded = Math.max(0, 2 - exerciseDistribution.listening);

    if (writingNeeded > 0) return "writing";
    if (listeningNeeded > 0) return "listening";

    return Math.random() < 0.6 ? "writing" : "listening";
  };

  // Improved question fetching with better error handling
  const fetchQuestion = async () => {
    if (user.questionsCompleted >= 10) {
      setSessionComplete(true);
      return;
    }

    setIsLoading(true);
    setFeedback("");

    try {
      const nextExerciseType = determineNextExerciseType();
      let requestedDifficulty = user.difficulty;

      if (
        nextExerciseType === "speaking_sentence" ||
        (nextExerciseType === "writing" && user.questionsCompleted >= 5)
      ) {
        requestedDifficulty = Math.max(3, user.difficulty);
      }

      // Avoid double fetch with fetchingRef
      if (fetchingRef.current) {
        fetchingRef.current = false;
      }

      console.log(
        `Fetching ${nextExerciseType} question at difficulty ${requestedDifficulty}`
      );

      const response = await fetch(
        "http://10.16.49.225:5003/api/get_question",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: user.id,
            last_correct: feedback.includes("Correct"),
            native_language: "tamil",
            current_difficulty: requestedDifficulty,
            force_exercise_type: nextExerciseType,
            past_question_ids: pastQuestionIds,
            questionsCompleted: user.questionsCompleted,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch question");
      }

      const data = await response.json();

      if (!data || !data.exercise_type) {
        throw new Error("Invalid question format received");
      }

      if (data.question_id) {
        setPastQuestionIds((prev) => [...prev, data.question_id]);
      }

      setCurrentQuestion(data);
      setUserAnswer("");

      console.log("Question received:", data.exercise_type, data.difficulty);
    } catch (error) {
      console.error("Fetch error:", error);
      setFeedback(`Error: ${error.message}. Retrying...`);
      setTimeout(fetchQuestion, 2000);
    } finally {
      setIsLoading(false);
    }
  };

  // Improved answer submission with more forgiving matching
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentQuestion) return;

    let isCorrect = false;
    const userResponse = userAnswer.trim();
    const correctAnswer = currentQuestion.correct_answer;

    switch (currentQuestion.exercise_type) {
      case "speaking_word":
      case "speaking_sentence":
        const normalizedUser = userResponse
          .toLowerCase()
          .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
          .replace(/\s{2,}/g, " ")
          .trim();

        const normalizedCorrect = correctAnswer
          .toLowerCase()
          .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
          .replace(/\s{2,}/g, " ")
          .trim();

        // More forgiving matching for speaking exercises
        isCorrect =
          normalizedUser === normalizedCorrect ||
          normalizedUser.includes(normalizedCorrect) ||
          (normalizedCorrect.includes(normalizedUser) &&
            normalizedUser.length > normalizedCorrect.length / 2) ||
          (currentQuestion.exercise_type === "speaking_sentence" &&
            wordMatchPercentage(normalizedUser, normalizedCorrect) > 0.6) || // More lenient threshold
          levensteinDistance(normalizedUser, normalizedCorrect) <=
            Math.max(2, Math.floor(normalizedCorrect.length * 0.25)); // Allow some typos

        setFeedback(
          isCorrect
            ? "✓ Correct! Good pronunciation!"
            : `✗ Try saying: "${correctAnswer}"`
        );
        break;

      case "listening":
        if (currentQuestion.options) {
          isCorrect = currentQuestion.options.some(
            (opt) =>
              opt.toLowerCase().trim() === userResponse.toLowerCase().trim()
          );
        } else {
          isCorrect =
            userResponse.toLowerCase().trim() ===
            correctAnswer.toLowerCase().trim();
        }
        setFeedback(
          isCorrect
            ? "✓ Correct! Well done!"
            : `✗ The correct answer is: "${correctAnswer}"`
        );
        break;

      case "writing":
        // More forgiving for writing at lower difficulty levels
        if (currentQuestion.difficulty <= 2) {
          isCorrect =
            userResponse.toLowerCase().trim() ===
              correctAnswer.toLowerCase().trim() ||
            levensteinDistance(
              userResponse.toLowerCase(),
              correctAnswer.toLowerCase()
            ) <= 1;
        } else {
          isCorrect =
            userResponse.toLowerCase().trim() ===
            correctAnswer.toLowerCase().trim();
        }
        setFeedback(
          isCorrect
            ? "✓ Perfect! Your spelling is correct!"
            : `✗ Correct spelling: "${correctAnswer}"`
        );
        break;

      default:
        isCorrect =
          userResponse.toLowerCase().trim() ===
          correctAnswer.toLowerCase().trim();
        setFeedback(
          isCorrect
            ? "✓ Correct answer!"
            : `✗ Incorrect. Answer: "${correctAnswer}"`
        );
    }

    function wordMatchPercentage(str1, str2) {
      const words1 = str1.split(" ");
      const words2 = str2.split(" ");
      let matches = 0;

      for (const word of words1) {
        if (words2.includes(word)) matches++;
      }

      return matches / Math.max(words1.length, words2.length);
    }

    // Levenshtein distance for fuzzy matching
    function levensteinDistance(a, b) {
      if (a.length === 0) return b.length;
      if (b.length === 0) return a.length;

      const matrix = [];

      // Initialize matrix
      for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
      }

      for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
      }

      // Fill matrix
      for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
          if (b.charAt(i - 1) === a.charAt(j - 1)) {
            matrix[i][j] = matrix[i - 1][j - 1];
          } else {
            matrix[i][j] = Math.min(
              matrix[i - 1][j - 1] + 1, // substitution
              Math.min(
                matrix[i][j - 1] + 1, // insertion
                matrix[i - 1][j] + 1 // deletion
              )
            );
          }
        }
      }

      return matrix[b.length][a.length];
    }

    setPerformance((prev) => ({
      correct: isCorrect ? prev.correct + 1 : prev.correct,
      total: prev.total + 1,
    }));

    setExerciseDistribution((prev) => ({
      ...prev,
      [currentQuestion.exercise_type]: prev[currentQuestion.exercise_type] + 1,
    }));

    try {
      const response = await fetch(
        "http://10.16.49.225:5003/api/submit_answer",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: user.id,
            difficulty: currentQuestion.difficulty,
            exercise_type: currentQuestion.exercise_type,
            is_correct: isCorrect,
            user_answer: userResponse,
            correct_answer: correctAnswer,
            streak: isCorrect ? user.streak + 1 : 0,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to submit answer");
      }

      const data = await response.json();

      setUser((prev) => ({
        ...prev,
        difficulty: data.new_difficulty || prev.difficulty,
        streak: isCorrect ? prev.streak + 1 : 0,
        questionsCompleted: prev.questionsCompleted + 1,
      }));

      if (isCorrect) {
        setTimeout(() => {
          setFeedback("");
          setUserAnswer("");
          fetchQuestion();
        }, 1500);
      }
    } catch (error) {
      console.error("Submission error:", error);
      setFeedback("Error saving your answer. Please try again.");
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestion) {
      setExerciseDistribution((prev) => ({
        ...prev,
        [currentQuestion.exercise_type]:
          prev[currentQuestion.exercise_type] + 1,
      }));
    }

    setUser((prev) => ({
      ...prev,
      questionsCompleted: prev.questionsCompleted + 1,
    }));
    fetchQuestion();
  };

  const renderExercise = () => {
    if (!currentQuestion || !currentQuestion.exercise_type) {
      return <div className="loading">Loading question...</div>;
    }

    switch (currentQuestion.exercise_type) {
      case "listening":
        return (
          <div className="exercise-container">
            <h3>👂 Listen & Choose (Level {currentQuestion.difficulty})</h3>
            <button
              className="audio-button"
              onClick={() => playAudio(currentQuestion.audio_url)}
              disabled={!currentQuestion.audio_url}
            >
              ▶ Play Sound
            </button>
            <p className="tamil-hint">{currentQuestion.explanation || ""}</p>

            {currentQuestion.options ? (
              <div className="options-container">
                {currentQuestion.options.map((option, index) => (
                  <button
                    key={index}
                    className={`option-button ${
                      userAnswer === option ? "selected" : ""
                    }`}
                    onClick={() => setUserAnswer(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            ) : (
              <input
                type="text"
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                placeholder="Type what you hear..."
              />
            )}
          </div>
        );

      case "speaking_word":
        return (
          <div className="exercise-container">
            <h3>Word Speaking Practice (Level {currentQuestion.difficulty})</h3>
            <div className="speaking-prompt">
              <p>Say this word in English:</p>
              <div className="tamil-prompt-box">
                {currentQuestion.question.split("?")[0].trim()}
              </div>
              {currentQuestion.explanation && (
                <p className="english-hint">({currentQuestion.explanation})</p>
              )}
            </div>

            <div className="device-recommendation">
              For best results, use headphones or earbuds with a microphone.
            </div>

            <div className="speaking-controls">
              <button
                className={`record-button ${isRecording ? "recording" : ""}`}
                onClick={handleSpeakingExercise}
                disabled={isLoading || !deviceCompatible}
              >
                {isRecording ? "◉ Recording..." : "🎤 Start Recording"}
              </button>

              <button
                className="audio-button"
                onClick={() => playAudio(currentQuestion.audio_url)}
                disabled={!currentQuestion.audio_url || isLoading}
              >
                ▶ Hear Example
              </button>
            </div>

            {userAnswer && (
              <div className="speaking-feedback">
                <p>
                  <strong>You said:</strong> "{userAnswer}"
                </p>
                {feedback.includes("Correct") ? (
                  <p className="correct-feedback">✓ Correct! Good job!</p>
                ) : (
                  <p className="incorrect-feedback">
                    ✗ Try saying: "{currentQuestion.correct_answer}"
                  </p>
                )}
              </div>
            )}
          </div>
        );
      case "speaking_sentence":
        return (
          <div className="exercise-container">
            <h3>
              🗣 Sentence Speaking Practice (Level {currentQuestion.difficulty})
            </h3>
            <div className="speaking-prompt">
              <p>Say this sentence in English:</p>
              <div className="tamil-prompt-box">{currentQuestion.question}</div>
              <p className="english-translation">
                (Should sound like: "{currentQuestion.correct_answer}")
              </p>
            </div>

            <p className="tamil-hint">{currentQuestion.explanation || ""}</p>

            <div className="device-recommendation">
              For best results, use headphones or earbuds with a microphone.
            </div>

            <div className="speaking-controls">
              <button
                className={`record-button ${isRecording ? "recording" : ""}`}
                onClick={handleSpeakingExercise}
                disabled={!deviceCompatible}
              >
                {isRecording ? (
                  <span className="recording-indicator">◾ Recording...</span>
                ) : (
                  "🎤 Start Recording"
                )}
              </button>

              {currentQuestion.audio_url && (
                <button
                  className="audio-button"
                  onClick={() => playAudio(currentQuestion.audio_url)}
                >
                  ▶ Hear Example
                </button>
              )}
            </div>

            {userAnswer && (
              <div className="speaking-feedback">
                <p>
                  <strong>You said:</strong> "{userAnswer}"
                </p>
                {feedback.includes("Correct") ? (
                  <p className="correct-feedback">
                    ✓ Great job with that sentence!
                  </p>
                ) : (
                  <p className="incorrect-feedback">
                    ✗ Not quite. Try saying: "{currentQuestion.correct_answer}"
                  </p>
                )}
              </div>
            )}
          </div>
        );

      case "writing":
        return (
          <div className="exercise-container">
            <h3>✏️ Writing Practice (Level {currentQuestion.difficulty})</h3>
            <p>{currentQuestion.question}</p>

            {currentQuestion.audio_url && (
              <button
                className="audio-button"
                onClick={() => playAudio(currentQuestion.audio_url)}
              >
                ▶ Play Prompt
              </button>
            )}

            <p className="tamil-hint">{currentQuestion.explanation || ""}</p>

            <textarea
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              rows={3}
              placeholder="Type your answer..."
            />
          </div>
        );

      default:
        return (
          <div className="exercise-container">
            <h3>{currentQuestion.question}</h3>
            <input
              type="text"
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              placeholder="Your answer..."
            />
          </div>
        );
    }
  };

  if (sessionComplete) {
    return (
      <div className="app">
        <header>
          <h1>Session Complete!</h1>
        </header>
        <main className="results-container">
          <div className="results-card">
            <h2>Your Results</h2>
            <div className="result-stats">
              <p>
                Correct Answers: <strong>{performance.correct}/10</strong>
              </p>
              <p>
                Current Level: <strong>{user.difficulty}/5</strong>
              </p>
              <p>Exercise Types:</p>
              <ul>
                <li>Word Speaking: {exerciseDistribution.speaking_word}/3</li>
                <li>
                  Sentence Speaking: {exerciseDistribution.speaking_sentence}/2
                </li>
                <li>Listening: {exerciseDistribution.listening}</li>
                <li>Writing: {exerciseDistribution.writing}</li>
              </ul>
            </div>
            <button
              className="new-session-button"
              onClick={() => {
                setSessionComplete(false);
                setUser({
                  id: "user_" + Math.random().toString(36).substr(2, 9),
                  difficulty: 1,
                  streak: 0,
                  questionsCompleted: 0,
                });
                setPerformance({ correct: 0, total: 0 });
                setExerciseDistribution({
                  speaking_word: 0,
                  speaking_sentence: 0,
                  listening: 0,
                  writing: 0,
                });
                setPastQuestionIds([]);
                fetchingRef.current = true;
                fetchQuestion();
              }}
            >
              Start New Session
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <header>
        <h1>English Learning App</h1>
        <div className="user-stats">
          <span>Level: {user.difficulty}</span>
          <span>Streak: {user.streak}</span>
          <span>Question: {user.questionsCompleted + 1}/10</span>
        </div>
      </header>

      <main>
        {isLoading || !currentQuestion ? (
          <div className="loading">
            <div className="spinner"></div>
            <p>Loading question...</p>
          </div>
        ) : (
          <>
            {renderExercise()}

            {feedback && (
              <div
                className={`feedback ${
                  feedback.includes("Correct") ? "correct" : "incorrect"
                }`}
              >
                {feedback}
              </div>
            )}

            <div className="action-buttons">
              <button
                className="submit-button"
                onClick={handleSubmit}
                disabled={
                  !userAnswer &&
                  !currentQuestion.exercise_type.startsWith("speaking")
                }
              >
                Submit
              </button>

              <button className="next-button" onClick={handleNextQuestion}>
                Next Question
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default App;
