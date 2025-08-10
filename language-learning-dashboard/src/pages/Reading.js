import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSpeechSynthesis } from "react-speech-kit";
import Webcam from "react-webcam";
import "../styles/Reading.css";

const ReadingPage = () => {
  // Speech synthesis
  const { speak, cancel } = useSpeechSynthesis();

  // Refs for webcam and audio
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Main application state
  const [state, setState] = useState({
    loading: false,
    currentMode: "words", // words | paragraph | pronunciation
    lesson: null,
    currentWord: null,
    paragraph: null,
    answers: {},
    results: null,
    pronunciationFeedback: null,
    isMirrorActive: false,
    targetSound: "TH",
    mouthAnalysis: null,
    analyzingMouth: false,
    availableSounds: ["TH", "V", "W", "F", "R", "L", "P", "B"],
    isRecording: false,
    audioURL: null,
    recordingStatus: "idle", // idle | recording | processing | done
  });

  // API call helper
  const fetchData = async (endpoint, body) => {
    setState((prev) => ({ ...prev, loading: true }));
    try {
      const res = await fetch(`http://10.16.49.225:5004/api/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }
      return await res.json();
    } catch (error) {
      console.error(`Error fetching from ${endpoint}:`, error);
      return { error: error.message };
    } finally {
      setState((prev) => ({ ...prev, loading: false }));
    }
  };

  // Lesson generation
  const generateLesson = async (topic = "daily life") => {
    const data = await fetchData("generate-lesson", { topic });
    if (!data.error) {
      setState((prev) => ({
        ...prev,
        lesson: data,
        currentWord: data.words && data.words.length > 0 ? data.words[0] : null,
        currentMode: "words",
      }));
    }
  };

  // Paragraph generation
  const generateParagraph = async (level = "intermediate") => {
    const data = await fetchData("generate-paragraph", { level });
    if (!data.error) {
      setState((prev) => ({
        ...prev,
        paragraph: data,
        answers: {},
        results: null,
        currentMode: "paragraph",
      }));
    }
  };

  // Submit reading answers
  const submitAnswers = async () => {
    const results = await fetchData("analyze-reading", {
      paragraph_id: state.paragraph?.id,
      answers: state.answers,
    });
    if (!results.error) {
      setState((prev) => ({ ...prev, results }));
    }
  };

  // Audio recording functions
  const startRecording = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isRecording: true,
      recordingStatus: "recording",
      audioURL: null,
      pronunciationFeedback: null,
    }));

    audioChunksRef.current = [];

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };

        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, {
            type: "audio/webm",
          });
          const audioUrl = URL.createObjectURL(audioBlob);
          setState((prev) => ({
            ...prev,
            audioURL: audioUrl,
            recordingStatus: "processing",
          }));

          // Process the recorded audio
          processAudio(audioBlob);
        };

        mediaRecorder.start();
      })
      .catch((error) => {
        console.error("Error accessing microphone:", error);
        setState((prev) => ({
          ...prev,
          isRecording: false,
          recordingStatus: "idle",
        }));
        alert("Could not access your microphone. Please check permissions.");
      });
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && state.isRecording) {
      mediaRecorderRef.current.stop();
      setState((prev) => ({ ...prev, isRecording: false }));

      // Stop all audio tracks
      if (mediaRecorderRef.current.stream) {
        mediaRecorderRef.current.stream
          .getTracks()
          .forEach((track) => track.stop());
      }
    }
  }, [state.isRecording]);

  // Process recorded audio for pronunciation analysis
  const processAudio = async (audioBlob) => {
    try {
      // Create a FormData object to send the audio file
      const formData = new FormData();
      formData.append("audio", audioBlob);
      formData.append(
        "word",
        state.currentWord ? state.currentWord.english : state.targetSound
      );

      // Convert FormData to a proper object for our fetchData function
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Audio = reader.result;

        // Send the audio data to the backend for analysis
        const result = await fetchData("analyze-pronunciation-audio", {
          audio: base64Audio,
          word: state.currentWord
            ? state.currentWord.english
            : state.targetSound,
        });

        if (!result.error) {
          setState((prev) => ({
            ...prev,
            pronunciationFeedback: result,
            recordingStatus: "done",
          }));
        } else {
          setState((prev) => ({
            ...prev,
            recordingStatus: "done",
            pronunciationFeedback: {
              score: 0,
              feedback: "Error analyzing pronunciation. Please try again.",
              tips: "Ensure your microphone is working properly.",
            },
          }));
        }
      };
    } catch (error) {
      console.error("Error processing audio:", error);
      setState((prev) => ({
        ...prev,
        recordingStatus: "done",
        pronunciationFeedback: {
          score: 0,
          feedback: "Error processing audio. Please try again.",
          tips: "Ensure your microphone is working properly.",
        },
      }));
    }
  };

  // Webcam functions
  const toggleMirror = async () => {
    setState((prev) => ({ ...prev, isMirrorActive: !prev.isMirrorActive }));
  };

  const capture = useCallback(() => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      return imageSrc;
    }
    return null;
  }, [webcamRef]);

  const analyzeMouthShape = async () => {
    const image = capture();
    if (!image) {
      alert("Failed to capture image from webcam");
      setState((prev) => ({ ...prev, analyzingMouth: false }));
      return;
    }

    try {
      // Show analyzing state and clear previous results
      setState((prev) => ({
        ...prev,
        analyzingMouth: true,
        mouthAnalysis: null,
      }));

      console.log("Sending image for analysis...");
      const response = await fetch(
        "http://10.16.49.225:5004/api/analyze-mouth-shape",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image,
            targetSound: state.targetSound,
          }),
        }
      );

      // Parse response as JSON
      const analysis = await response.json();
      console.log("Received mouth analysis:", analysis);

      // Update state with the analysis results
      setState((prev) => ({
        ...prev,
        analyzingMouth: false,
        mouthAnalysis: analysis,
      }));
    } catch (err) {
      console.error("Error analyzing mouth shape:", err);
      setState((prev) => ({
        ...prev,
        analyzingMouth: false,
        mouthAnalysis: {
          error: err.message || "Failed to connect to analysis service",
          score: 0,
          feedback: [
            "Analysis failed due to a connection error. Please try again.",
          ],
        },
      }));
    }
  };
  // Initial load
  useEffect(() => {
    generateLesson();

    // Check if browser supports audio recording
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.warn("Audio recording is not supported in this browser");
    }
  }, []);

  // Clean up webcam and audio on unmount
  useEffect(() => {
    return () => {
      // Clean up webcam
      if (webcamRef.current && webcamRef.current.video) {
        const stream = webcamRef.current.video.srcObject;
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
        }
      }

      // Clean up audio recorder
      if (mediaRecorderRef.current && mediaRecorderRef.current.stream) {
        mediaRecorderRef.current.stream
          .getTracks()
          .forEach((track) => track.stop());
      }

      // Clean up audio URL
      if (state.audioURL) {
        URL.revokeObjectURL(state.audioURL);
      }
    };
  }, [state.audioURL]);

  // Render loading state
  if (state.loading) {
    return (
      <div className="loader-container">
        <div className="loader"></div>
        <p>Generating AI lesson...</p>
      </div>
    );
  }

  return (
    <div className="reading-container">
      {/* Header and Mode Selector */}
      <header>
        <h1>English Learning Platform</h1>
        <div className="mode-selector">
          <button
            onClick={() => generateLesson()}
            className={state.currentMode === "words" ? "active" : ""}
          >
            Vocabulary Builder
          </button>
          <button
            onClick={() => generateParagraph()}
            className={state.currentMode === "paragraph" ? "active" : ""}
          >
            Reading Comprehension
          </button>
          <button
            onClick={() =>
              setState((prev) => ({ ...prev, currentMode: "pronunciation" }))
            }
            className={state.currentMode === "pronunciation" ? "active" : ""}
          >
            Accent Training
          </button>
        </div>
      </header>

      {/* Vocabulary Mode */}
      {state.currentMode === "words" && state.lesson && (
        <div className="word-mode">
          <div className="word-card">
            {state.currentWord && (
              <>
                <div className="word-header">
                  <h2>{state.currentWord.english}</h2>
                  <span className="pos">{state.currentWord.pos}</span>
                </div>

                {state.currentWord.image && (
                  <img
                    src={state.currentWord.image}
                    alt={state.currentWord.english}
                    className="word-image"
                  />
                )}

                <div className="pronunciation-guide">
                  <p className="tamil-script">
                    {state.currentWord.tamil_script}
                  </p>
                  <p className="romanized">
                    ({state.currentWord.tamil_romanized})
                  </p>
                  <button
                    onClick={() => {
                      cancel();
                      speak({ text: state.currentWord.english });
                    }}
                    className="speak-button"
                  >
                    🔊 Hear Pronunciation
                  </button>
                </div>

                <div className="sentences">
                  <h3>Example Sentences:</h3>
                  {state.currentWord.sentences &&
                    state.currentWord.sentences.map((sentence, i) => (
                      <div key={i} className="sentence">
                        <p className="english">{sentence.english}</p>
                        <p className="tamil">{sentence.tamil}</p>
                        <button
                          onClick={() => speak({ text: sentence.english })}
                          className="speak-button small"
                        >
                          🔊
                        </button>
                      </div>
                    ))}
                </div>
              </>
            )}
          </div>

          <div className="word-navigation">
            {state.lesson.words &&
              state.lesson.words.map((word, i) => (
                <button
                  key={i}
                  onClick={() =>
                    setState((prev) => ({ ...prev, currentWord: word }))
                  }
                  className={word === state.currentWord ? "active" : ""}
                >
                  {word.english}
                </button>
              ))}
          </div>

          <div className="pronunciation-practice">
            <h3>Practice Pronunciation</h3>
            {state.currentWord && (
              <div className="audio-recorder">
                <div className="recorder-controls">
                  {!state.isRecording ? (
                    <button
                      onClick={startRecording}
                      className="record-button"
                      disabled={state.recordingStatus === "processing"}
                    >
                      🎤 Record Pronunciation
                    </button>
                  ) : (
                    <button onClick={stopRecording} className="stop-button">
                      ⏹️ Stop Recording
                    </button>
                  )}
                </div>

                {state.recordingStatus === "recording" && (
                  <div className="recording-indicator">
                    <span className="recording-dot"></span> Recording...
                  </div>
                )}

                {state.recordingStatus === "processing" && (
                  <div className="processing-indicator">
                    Analyzing pronunciation...
                  </div>
                )}

                {state.audioURL && (
                  <div className="audio-playback">
                    <audio
                      src={state.audioURL}
                      controls
                      className="audio-player"
                    />
                  </div>
                )}
              </div>
            )}

            {state.pronunciationFeedback && (
              <div className="pronunciation-feedback">
                <h4>Score: {state.pronunciationFeedback.score}/100</h4>
                <p>{state.pronunciationFeedback.feedback}</p>
                <p className="tip">Tip: {state.pronunciationFeedback.tips}</p>

                {state.pronunciationFeedback.phonemes && (
                  <div className="phoneme-analysis">
                    <h4>Phoneme Analysis:</h4>
                    <div className="phoneme-chart">
                      {Object.entries(state.pronunciationFeedback.phonemes).map(
                        ([phoneme, accuracy]) => (
                          <div key={phoneme} className="phoneme-bar">
                            <span className="phoneme-label">{phoneme}</span>
                            <div className="accuracy-bar-container">
                              <div
                                className="accuracy-bar"
                                style={{
                                  width: `${accuracy}%`,
                                  backgroundColor:
                                    accuracy > 80
                                      ? "#4CAF50"
                                      : accuracy > 60
                                      ? "#FF9800"
                                      : "#F44336",
                                }}
                              ></div>
                            </div>
                            <span className="accuracy-value">{accuracy}%</span>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {state.lesson.tips && (
            <div className="tips-section">
              <h3>Teaching Tips</h3>
              <p>{state.lesson.tips}</p>
            </div>
          )}
        </div>
      )}

      {/* Paragraph Mode */}
      {state.currentMode === "paragraph" && state.paragraph && (
        <div className="paragraph-mode">
          <div className="paragraph-display">
            <h2>Reading Practice</h2>
            <div className="text-content">
              <p className="english">{state.paragraph.english}</p>
              <details>
                <summary>Show Tamil Translation</summary>
                <p className="tamil">{state.paragraph.tamil}</p>
              </details>
            </div>

            <div className="paragraph-pronunciation">
              <h3>Read Aloud Practice</h3>
              <div className="audio-recorder">
                <div className="recorder-controls">
                  {!state.isRecording ? (
                    <button
                      onClick={startRecording}
                      className="record-button"
                      disabled={state.recordingStatus === "processing"}
                    >
                      🎤 Record Reading
                    </button>
                  ) : (
                    <button onClick={stopRecording} className="stop-button">
                      ⏹️ Stop Recording
                    </button>
                  )}
                </div>

                {state.recordingStatus === "recording" && (
                  <div className="recording-indicator">
                    <span className="recording-dot"></span> Recording...
                  </div>
                )}

                {state.recordingStatus === "processing" && (
                  <div className="processing-indicator">
                    Analyzing reading...
                  </div>
                )}

                {state.audioURL && (
                  <div className="audio-playback">
                    <audio
                      src={state.audioURL}
                      controls
                      className="audio-player"
                    />
                  </div>
                )}

                {state.pronunciationFeedback && (
                  <div className="reading-feedback">
                    <h4>Reading Analysis</h4>
                    <p>
                      <strong>Fluency Score:</strong>{" "}
                      {state.pronunciationFeedback.score}/100
                    </p>
                    <p>{state.pronunciationFeedback.feedback}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="questions">
              <h3>Comprehension Check</h3>
              {state.paragraph.questions &&
                state.paragraph.questions.map((q, i) => (
                  <div key={i} className="question">
                    <p>{q.text}</p>
                    <select
                      value={state.answers[i] || ""}
                      onChange={(e) =>
                        setState((prev) => ({
                          ...prev,
                          answers: { ...prev.answers, [i]: e.target.value },
                        }))
                      }
                      className="answer-select"
                    >
                      <option value="">Select answer</option>
                      <option value={q.correct}>{q.correct}</option>
                      {q.distractors &&
                        q.distractors.map((d, j) => (
                          <option key={j} value={d}>
                            {d}
                          </option>
                        ))}
                    </select>
                  </div>
                ))}
            </div>

            <button
              onClick={submitAnswers}
              disabled={
                !state.paragraph.questions ||
                Object.keys(state.answers).length <
                  state.paragraph.questions.length
              }
              className="submit-button"
            >
              Submit Answers
            </button>

            {state.results && (
              <div className="results">
                <h3>Your Score: {state.results.score}/100</h3>
                <p>{state.results.feedback}</p>
                <div className="study-plan">
                  <h4>Study Plan:</h4>
                  <ul>
                    {state.results.study_plan &&
                      state.results.study_plan.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pronunciation Mode */}
      {state.currentMode === "pronunciation" && (
        <div className="pronunciation-mode">
          <h2>Accent Mirror</h2>
          <p className="subtitle">
            Practice English sounds with real-time feedback
          </p>

          <div className="sound-selector">
            <p>Select sound to practice:</p>
            <div className="sound-buttons">
              {state.availableSounds.map((sound) => (
                <button
                  key={sound}
                  onClick={() =>
                    setState((prev) => ({
                      ...prev,
                      targetSound: sound,
                      pronunciationFeedback: null,
                      mouthAnalysis: null,
                    }))
                  }
                  className={state.targetSound === sound ? "active" : ""}
                >
                  /{sound}/
                </button>
              ))}
            </div>
          </div>

          <div className="mirror-container">
            {state.isMirrorActive ? (
              <>
                <Webcam
                  audio={false}
                  ref={webcamRef}
                  screenshotFormat="image/jpeg"
                  videoConstraints={{
                    width: 640,
                    height: 480,
                    facingMode: "user",
                  }}
                  className="webcam-feed"
                />
                <canvas
                  ref={canvasRef}
                  width={640}
                  height={480}
                  style={{ display: "none" }}
                />
              </>
            ) : (
              <div className="webcam-placeholder">
                <p>Camera is currently off</p>
              </div>
            )}

            {/* Mouth Analysis Results - Updated Rendering */}
            <div className="analysis-container">
              {state.analyzingMouth && (
                <div className="analyzing-indicator">
                  <p>Analyzing mouth shape...</p>
                </div>
              )}

              {state.mouthAnalysis && !state.mouthAnalysis.error && (
                <div className="analysis-result">
                  <h3>Mouth Shape Analysis</h3>

                  {state.mouthAnalysis.analyzedImage && (
                    <div className="analysis-image">
                      <img
                        src={state.mouthAnalysis.analyzedImage}
                        alt="Mouth analysis"
                        style={{ maxWidth: "100%", border: "1px solid #ccc" }}
                      />
                    </div>
                  )}

                  <div className="analysis-feedback">
                    <div className="score">
                      <h4>
                        Score: <span>{state.mouthAnalysis.score}/100</span>
                      </h4>
                    </div>

                    <div className="feedback">
                      <h4>Feedback:</h4>
                      <ul>
                        {Array.isArray(state.mouthAnalysis.feedback) ? (
                          state.mouthAnalysis.feedback.map((item, i) => (
                            <li key={i}>{item}</li>
                          ))
                        ) : (
                          <li>{String(state.mouthAnalysis.feedback)}</li>
                        )}
                      </ul>
                    </div>

                    {state.mouthAnalysis.referenceImage && (
                      <div className="reference">
                        <h4>Reference:</h4>
                        <img
                          src={state.mouthAnalysis.referenceImage}
                          alt="Reference mouth position"
                          style={{ maxWidth: "100%", border: "1px solid #ccc" }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {state.mouthAnalysis && state.mouthAnalysis.error && (
                <div className="error-message">
                  <h3>Analysis Error</h3>
                  <p>{state.mouthAnalysis.error}</p>
                  <p>
                    Please ensure your face is clearly visible in the camera and
                    try again.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="pronunciation-practice-controls">
            <div className="mirror-controls">
              <button
                onClick={toggleMirror}
                className={
                  state.isMirrorActive ? "stop-button" : "start-button"
                }
              >
                {state.isMirrorActive ? "Stop Camera" : "Start Camera"}
              </button>

              {state.isMirrorActive && (
                <button
                  onClick={analyzeMouthShape}
                  className="analyze-button"
                  disabled={state.analyzingMouth}
                >
                  {state.analyzingMouth
                    ? "Analyzing..."
                    : "Analyze My Mouth Position"}
                </button>
              )}
            </div>

            <div className="audio-recorder">
              <h3>Record Your Pronunciation:</h3>
              <div className="recorder-controls">
                {!state.isRecording ? (
                  <button
                    onClick={startRecording}
                    className="record-button"
                    disabled={state.recordingStatus === "processing"}
                  >
                    🎤 Record Sound
                  </button>
                ) : (
                  <button onClick={stopRecording} className="stop-button">
                    ⏹️ Stop Recording
                  </button>
                )}
              </div>

              {state.recordingStatus === "recording" && (
                <div className="recording-indicator">
                  <span className="recording-dot"></span> Recording...
                </div>
              )}

              {state.recordingStatus === "processing" && (
                <div className="processing-indicator">
                  Analyzing pronunciation...
                </div>
              )}

              {state.audioURL && (
                <div className="audio-playback">
                  <audio
                    src={state.audioURL}
                    controls
                    className="audio-player"
                  />
                </div>
              )}
            </div>
          </div>

          {state.pronunciationFeedback && (
            <div className="pronunciation-feedback">
              <h3>Audio Analysis:</h3>
              <h4>Score: {state.pronunciationFeedback.score}/100</h4>
              <p>{state.pronunciationFeedback.feedback}</p>
              <p className="tip">Tip: {state.pronunciationFeedback.tips}</p>

              {state.pronunciationFeedback.phonemes && (
                <div className="phoneme-analysis">
                  <h4>Sound Analysis:</h4>
                  <div className="phoneme-chart">
                    {Object.entries(state.pronunciationFeedback.phonemes).map(
                      ([phoneme, accuracy]) => (
                        <div key={phoneme} className="phoneme-bar">
                          <span className="phoneme-label">{phoneme}</span>
                          <div className="accuracy-bar-container">
                            <div
                              className="accuracy-bar"
                              style={{
                                width: `${accuracy}%`,
                                backgroundColor:
                                  accuracy > 80
                                    ? "#4CAF50"
                                    : accuracy > 60
                                    ? "#FF9800"
                                    : "#F44336",
                              }}
                            ></div>
                          </div>
                          <span className="accuracy-value">{accuracy}%</span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="tamil-instructions">
            <h3>Tamil Pronunciation Guide</h3>
            {state.targetSound === "TH" && (
              <p>
                தமிழில் "த" போல ஆனால் நாவை மேல் பற்களில் தொடவும் (Like 'த' but
                with tongue touching upper teeth)
              </p>
            )}
            {state.targetSound === "V" && (
              <p>
                கீழ் உதட்டை மேல் பற்களால் சிறிது கடிக்கவும் (Bite lower lip
                slightly with upper teeth)
              </p>
            )}
            {state.targetSound === "W" && (
              <p>
                உதடுகளை வட்டமாக இறுக்கமாக மூடவும் (Tightly round your lips like
                ஊ sound)
              </p>
            )}
            {state.targetSound !== "TH" &&
              state.targetSound !== "V" &&
              state.targetSound !== "W" && (
                <p>
                  இந்த ஒலியை உருவாக்க உங்கள் நாக்கையும் உதடுகளையும் சரியாக
                  வைக்கவும் (Position your tongue and lips correctly for this
                  sound)
                </p>
              )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReadingPage;
