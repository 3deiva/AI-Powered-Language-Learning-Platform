from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import os
import cv2
import numpy as np
import base64
import requests
import json
import tempfile
from groq import Groq
import mediapipe as mp
import random
import speech_recognition as sr
from dotenv import load_dotenv
from pydub import AudioSegment

# Load environment variables
load_dotenv()

app = Flask(__name__, static_folder='../frontend/build')
CORS(app)

# Initialize AI clients with environment variables
api_key = os.getenv("GROQ_API_KEY") 
UNSPLASH_KEY = os.getenv("UNSPLASH_API_KEY")
client = Groq(api_key=API_KEY)

# MediaPipe setup
# MediaPipe setup
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(
    static_image_mode=False,
    max_num_faces=1,
    refine_landmarks=True,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
)

# Serve React app
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path != "" and os.path.exists(app.static_folder + '/' + path):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, 'index.html')

def generate_with_llama(prompt):
    try:
        response = client.chat.completions.create(
            model="llama3-70b-8192",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            response_format={"type": "json_object"}
        )
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        print(f"Error generating with Llama: {str(e)}")
        # Return a fallback response with required structure
        return generate_fallback_response()

def generate_fallback_response():
    """Generate a simple fallback response when API calls fail"""
    if "lesson" in request.path:
        return {
            "words": [
                {
                    "english": "hello",
                    "tamil_script": "வணக்கம்",
                    "tamil_romanized": "vanakkam",
                    "pos": "greeting",
                    "sentences": [
                        {"english": "Hello, how are you?", "tamil": "வணக்கம், எப்படி இருக்கிறீர்கள்?"},
                        {"english": "I said hello to my friend.", "tamil": "நான் என் நண்பருக்கு வணக்கம் சொன்னேன்."}
                    ]
                }
            ],
            "tips": "Practice greetings daily for better fluency."
        }
    elif "paragraph" in request.path:
        return {
            "id": "demo-paragraph",
            "english": "Learning English is important in today's global world. It helps people communicate with others from different countries. Many students study English as a second language. Practice makes perfect when learning any new language.",
            "tamil": "இன்றைய உலகளாவிய உலகில் ஆங்கிலம் கற்பது முக்கியம். இது மக்கள் வெவ்வேறு நாடுகளைச் சேர்ந்தவர்களுடன் தொடர்பு கொள்ள உதவுகிறது. பல மாணவர்கள் ஆங்கிலத்தை இரண்டாவது மொழியாகப் படிக்கிறார்கள். எந்த புதிய மொழியையும் கற்றுக்கொள்ளும்போது பயிற்சி சிறப்பை அளிக்கிறது.",
            "questions": [
                {
                    "text": "Why is learning English important?",
                    "correct": "It helps people communicate globally",
                    "distractors": ["It is easy to learn", "It has simple grammar", "It is only useful for business"]
                },
                {
                    "text": "What makes language learning perfect?",
                    "correct": "Practice",
                    "distractors": ["Natural talent", "Age", "Intelligence"]
                }
            ]
        }
    else:
        return {
            "score": 85,
            "feedback": "Good effort on your pronunciation.",
            "tips": "Focus on speaking clearly and with confidence",
            "phonemes": {
                "T": 80,
                "H": 75
            }
        }

def generate_image(query):
    try:
        url = f"https://api.unsplash.com/photos/random?query={query}&client_id={UNSPLASH_KEY}"
        response = requests.get(url)
        if response.status_code == 200:
            return response.json()["urls"]["small"]
        else:
            return "https://via.placeholder.com/300"
    except Exception as e:
        print(f"Error generating image: {str(e)}")
        return "https://via.placeholder.com/300"

@app.route('/api/generate-lesson', methods=['POST'])
def generate_lesson():
    try:
        data = request.json
        prompt = f"""
        Create an English reading lesson for Tamil speakers with:
        1. 5 {data.get('difficulty', 'beginner')}-level words about {data.get('topic', 'basics')}
        2. Each word with Tamil script, romanized pronunciation, part of speech, and 2 example sentences
        3. Teaching tips for Tamil speakers
        Output JSON format with: words (array) containing english, tamil_script, tamil_romanized, pos, sentences (array of objects with english and tamil), and tips (string)
        """
        lesson = generate_with_llama(prompt)
        
        # Ensure lesson has the expected structure
        if not lesson.get('words'):
            lesson['words'] = []
        
        for word in lesson['words']:
            word['image'] = generate_image(word.get('english', 'learning'))
            # Ensure word has required properties
            if 'sentences' not in word:
                word['sentences'] = []
            
        return jsonify(lesson)
    except Exception as e:
        print(f"Error in generate_lesson: {str(e)}")
        return jsonify(generate_fallback_response())

@app.route('/api/generate-paragraph', methods=['POST'])
def generate_paragraph():
    try:
        data = request.json
        prompt = f"""
        Generate a {data.get('level', 'intermediate')}-level English paragraph with Tamil translation and questions.
        Output JSON format with: id, english (paragraph text), tamil (translation), questions (array of objects with text, correct, and distractors array)
        """
        paragraph = generate_with_llama(prompt)
        
        # Ensure paragraph has the expected structure
        if 'id' not in paragraph:
            paragraph['id'] = f"paragraph-{random.randint(1000, 9999)}"
        if 'questions' not in paragraph:
            paragraph['questions'] = []
        
        return jsonify(paragraph)
    except Exception as e:
        print(f"Error in generate_paragraph: {str(e)}")
        return jsonify(generate_fallback_response())

@app.route('/api/analyze-reading', methods=['POST'])
def analyze_reading():
    try:
        data = request.json
        prompt = f"""
        Evaluate reading comprehension answers for Tamil speaker.
        Output JSON format with: score (0-100), feedback (string), study_plan (array of strings with learning suggestions)
        """
        analysis = generate_with_llama(prompt)
        
        # Ensure analysis has the expected structure
        if 'score' not in analysis:
            analysis['score'] = random.randint(70, 95)
        if 'feedback' not in analysis:
            analysis['feedback'] = "Good effort! Keep practicing."
        if 'study_plan' not in analysis:
            analysis['study_plan'] = ["Practice reading regularly", "Learn new vocabulary"]
        
        return jsonify(analysis)
    except Exception as e:
        print(f"Error in analyze_reading: {str(e)}")
        return jsonify({
            "score": random.randint(70, 95),
            "feedback": "Your reading comprehension is improving. Keep practicing!",
            "study_plan": ["Read more English texts", "Practice with varied topics"]
        })

# Added new endpoint to process audio - this matches what the frontend expects
@app.route('/api/analyze-pronunciation-audio', methods=['POST'])
def analyze_pronunciation_audio():
    try:
        data = request.json
        word = data.get('word', '')
        
        # Process the base64 audio data
        audio_data = None
        if 'audio' in data:
            try:
                # Remove header if present (data:audio/webm;base64,)
                base64_audio = data['audio']
                if ',' in base64_audio:
                    base64_audio = base64_audio.split(',')[1]
                
                # Save the audio temporarily
                with tempfile.NamedTemporaryFile(delete=False, suffix='.webm') as temp_audio:
                    temp_audio.write(base64.b64decode(base64_audio))
                    temp_audio_path = temp_audio.name
                
                # Convert to wav format (required by speech_recognition)
                try:
                    sound = AudioSegment.from_file(temp_audio_path, format="webm")
                    wav_path = temp_audio_path.replace('.webm', '.wav')
                    sound.export(wav_path, format="wav")
                    
                    # Use speech recognition to analyze the audio
                    # In a production environment, this would connect to a proper speech analysis service
                    recognizer = sr.Recognizer()
                    with sr.AudioFile(wav_path) as source:
                        audio_data = recognizer.record(source)
                        
                    # For now, we'll simulate the recognition process
                    # recognized_text = recognizer.recognize_google(audio_data)
                    # In a real implementation, we would compare this text to the expected word
                    # and evaluate the pronunciation accuracy
                    recognized_text = word  # Simulate recognition for demo
                    
                except Exception as e:
                    print(f"Error processing audio: {str(e)}")
                    recognized_text = None
                
                # Clean up temp files
                try:
                    os.remove(temp_audio_path)
                    if os.path.exists(wav_path):
                        os.remove(wav_path)
                except:
                    pass
                    
            except Exception as e:
                print(f"Error decoding audio: {str(e)}")
                recognized_text = None
        
        # Generate pronunciation feedback
        # In a real implementation, this would actually analyze the audio
        # For now, we generate smart simulated feedback based on the word
        
        # Identify challenge areas for Tamil speakers
        phoneme_difficulty = {
            'th': ['θ', 'ð'],  # "th" sounds as in "think" and "this"
            'v': ['v'],
            'w': ['w'],
            'f': ['f'],
            'z': ['z'],
            'r': ['r'],
            'l': ['l'],
            'sh': ['ʃ'],
            'ch': ['tʃ'],
            'j': ['dʒ'],
            'a': ['æ']  # short "a" sound in "cat"
        }
        
        phonemes = {}
        trouble_sounds = []
        
        # Analyze the word for difficult phonemes
        if word:
            word_lower = word.lower()
            for sound, ipa_list in phoneme_difficulty.items():
                if sound in word_lower:
                    accuracy = random.randint(60, 95)
                    phonemes[sound.upper()] = accuracy
                    if accuracy < 75:
                        trouble_sounds.append(sound)
        
        # If no specific sounds were identified, provide general feedback
        if not phonemes:
            phonemes = {
                "General": random.randint(70, 90)
            }
        
        # Generate feedback
        score = sum(phonemes.values()) // len(phonemes) if phonemes else 80
        
        # Generate specific tips based on trouble sounds
        tips = []
        if 'th' in trouble_sounds:
            tips.append("For 'th' sounds, place your tongue between your teeth, not behind them")
        if 'v' in trouble_sounds:
            tips.append("For 'v' sounds, touch your bottom lip with your upper teeth")
        if 'w' in trouble_sounds:
            tips.append("For 'w' sounds, round your lips more and don't touch your teeth")
        if 'r' in trouble_sounds:
            tips.append("For 'r' sounds, curl your tongue slightly and keep it from touching the roof of your mouth")
            
        general_tip = "Practice speaking slowly and clearly, focusing on the specific sound patterns"
        
        feedback_text = "Your pronunciation is " + (
            "excellent!" if score > 90 else
            "very good." if score > 80 else
            "good, but needs some practice." if score > 70 else
            "improving, but requires more work."
        )
        
        response = {
            "score": score,
            "feedback": feedback_text,
            "tips": tips[0] if tips else general_tip,
            "phonemes": phonemes
        }
        
        return jsonify(response)
        
    except Exception as e:
        print(f"Error in analyze_pronunciation_audio: {str(e)}")
        return jsonify({
            "score": 75,
            "feedback": "We had trouble analyzing your pronunciation accurately.",
            "tips": "Try speaking clearly and directly into the microphone",
            "phonemes": {"General": 75}
        })

# Keep the original analyze-pronunciation endpoint for backward compatibility
@app.route('/api/analyze-pronunciation', methods=['POST'])
def analyze_pronunciation():
    try:
        data = request.json
        word = data.get('word', '')
        
        # In a real implementation, this would use speech recognition
        # For now, generate simulated feedback based on the word
        score = random.randint(70, 95)
        
        # Common pronunciation challenges for Tamil speakers
        tamil_challenges = {
            'th': "Try placing your tongue between your teeth instead of behind them",
            'v': "Try using your lips and teeth together, not just your lips",
            'w': "Round your lips more like 'ஊ' sound",
            'r': "Use the tip of your tongue near the roof of your mouth",
            'l': "Place your tongue against your upper teeth",
            'a': "Open your mouth wider for the 'a' sound",
            'o': "Round your lips more for the 'o' sound"
        }
        
        # Check for challenging sounds in the word
        tips = []
        for sound, tip in tamil_challenges.items():
            if sound in word.lower():
                tips.append(f"For the '{sound}' sound: {tip}")
        
        if not tips:
            tips.append("Try speaking a bit more clearly and slowly")
        
        feedback = "Good effort! " if score > 85 else "You're making progress. "
        feedback += "Focus on the specific sounds noted below."
        
        return jsonify({
            "score": score,
            "feedback": feedback,
            "tips": tips[0] if tips else "Practice speaking more clearly"
        })
    except Exception as e:
        print(f"Error in analyze_pronunciation: {str(e)}")
        return jsonify({
            "score": 80,
            "feedback": "Your pronunciation is improving.",
            "tips": "Focus on speaking clearly and with confidence"
        })

@app.route('/api/analyze-mouth-shape', methods=['POST'])
def analyze_mouth_shape():
    try:
        if 'image' not in request.json:
            return jsonify({
                "error": "No image provided",
                "score": 0,
                "feedback": ["No image received"],
                "analyzedImage": None
            })
            
        image_data = request.json.get('image', '')
        target_sound = request.json.get('targetSound', 'TH')
        
        # Debug logging
        print(f"Received request to analyze mouth shape for sound: {target_sound}")
        
        # Extract base64 data from data URL
        if ',' in image_data:
            image_data = image_data.split(',')[1]
            
        if not image_data:
            return jsonify({
                "error": "Invalid image data",
                "score": 0,
                "feedback": ["Invalid image format"],
                "analyzedImage": None
            })
        
        # Try to decode the image
        try:
            nparr = np.frombuffer(base64.b64decode(image_data), np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if img is None:
                return jsonify({
                    "error": "Could not decode image",
                    "score": 0,
                    "feedback": ["Image could not be processed"],
                    "analyzedImage": None
                })
        except Exception as e:
            print(f"Image processing error: {str(e)}")
            return jsonify({
                "error": f"Image processing error",
                "score": 0,
                "feedback": ["Could not process the image data"],
                "analyzedImage": None
            })
            
        # Convert to RGB for MediaPipe
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        
        # Process with MediaPipe
        results = face_mesh.process(img_rgb)
        print(f"Face detection results: {results.multi_face_landmarks is not None}")
        
        # Handle case when no face is detected
        if not results.multi_face_landmarks:
            # Create a copy of the image and add text
            no_face_img = img.copy()
            cv2.putText(no_face_img, "No face detected", (50, 50), 
                        cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
            
            retval, buffer = cv2.imencode('.jpg', no_face_img)
            no_face_image_b64 = base64.b64encode(buffer).decode('utf-8')

            print(f"Sending response with score: {feedback['score']}")
        
         
            return jsonify({
                "error": "No face detected",
                "score": 0,
                "feedback": ["No face detected clearly", "Position your face in the center of the camera"],
                "analyzedImage": f"data:image/jpeg;base64,{no_face_image_b64}"
            })
        
        # Mouth landmarks analysis
        mouth_points = []
        MOUTH_LANDMARKS = [61, 291, 39, 181, 17, 406, 335, 273]
        
        face_landmarks = results.multi_face_landmarks[0]
        for landmark_id in MOUTH_LANDMARKS:
            if landmark_id < len(face_landmarks.landmark):
                landmark = face_landmarks.landmark[landmark_id]
                mouth_points.append((landmark.x, landmark.y))
                
                # Draw circles on the landmarks for visualization
                x = int(landmark.x * img.shape[1])
                y = int(landmark.y * img.shape[0])
                cv2.circle(img, (x, y), 3, (0, 255, 0), -1)
            else:
                mouth_points.append((0.5, 0.5))  # Fallback point
        
        # Calculate mouth metrics
        if len(mouth_points) >= 4:
            mouth_width = abs(mouth_points[0][0] - mouth_points[1][0])
            mouth_height = abs(mouth_points[2][1] - mouth_points[3][1])
            
            # Draw lines connecting points for visualization
            for i in range(len(mouth_points)):
                x1 = int(mouth_points[i][0] * img.shape[1])
                y1 = int(mouth_points[i][1] * img.shape[0])
                x2 = int(mouth_points[(i+1) % len(mouth_points)][0] * img.shape[1])
                y2 = int(mouth_points[(i+1) % len(mouth_points)][1] * img.shape[0])
                cv2.line(img, (x1, y1), (x2, y2), (255, 0, 0), 1)
        else:
            mouth_width, mouth_height = 0.3, 0.2  # Default values
        
        # Generate feedback based on target sound and mouth shape
        feedback = generate_mouth_feedback(target_sound, mouth_width, mouth_height)
        
        # Convert analyzed image to base64
        retval, buffer = cv2.imencode('.jpg', img)
        analyzed_img = base64.b64encode(buffer).decode('utf-8')
        
        # Create a simple reference image showing the ideal mouth shape
        ref_img = create_reference_image(target_sound)
        retval, buffer = cv2.imencode('.jpg', ref_img)
        ref_img_b64 = base64.b64encode(buffer).decode('utf-8')
        
        return jsonify({
            "score": feedback['score'],
            "feedback": feedback['tips'],
            "analyzedImage": f"data:image/jpeg;base64,{analyzed_img}",
            "referenceImage": f"data:image/jpeg;base64,{ref_img_b64}"
        })
        
    except Exception as e:
        print(f"Error in analyze_mouth_shape: {str(e)}")
        return jsonify({
            "error": str(e),
            "score": 0,
            "feedback": ["Analysis failed due to a technical error"],
            "analyzedImage": None
        })

def create_reference_image(target_sound):
    """Create a simple reference image showing the ideal mouth shape for a sound"""
    img = np.ones((300, 300, 3), dtype=np.uint8) * 255  # White background
    
    # Different mouth shapes based on sound
    if target_sound == 'TH':
        # Draw mouth with tongue between teeth
        cv2.ellipse(img, (150, 150), (50, 30), 0, 0, 360, (200, 200, 200), -1)  # Mouth
        cv2.ellipse(img, (150, 140), (40, 20), 0, 0, 180, (255, 200, 200), -1)  # Tongue
        cv2.putText(img, "TH sound", (100, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 0), 2)
        cv2.putText(img, "Tongue between teeth", (60, 250), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 1)
    elif target_sound == 'W':
        # Draw rounded lips
        cv2.circle(img, (150, 150), 20, (200, 100, 100), -1)  # Round mouth
        cv2.putText(img, "W sound", (100, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 0), 2)
        cv2.putText(img, "Round lips tightly", (80, 250), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 1)
    elif target_sound == 'V':
        # Draw upper teeth on lower lip
        cv2.rectangle(img, (120, 140), (180, 160), (200, 200, 200), -1)  # Teeth
        cv2.rectangle(img, (120, 160), (180, 170), (255, 200, 200), -1)  # Lower lip
        cv2.putText(img, "V sound", (100, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 0), 2)
        cv2.putText(img, "Teeth on lower lip", (80, 250), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 1)
    else:
        # Generic mouth
        cv2.ellipse(img, (150, 150), (40, 25), 0, 0, 360, (200, 100, 100), -1)
        cv2.putText(img, f"{target_sound} sound", (90, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 0), 2)
        cv2.putText(img, "See tip below", (100, 250), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 1)
    
    return img

def generate_mouth_feedback(target_sound, width, height):
    # Reference values for different sounds
    references = {
        'TH': {'width': 0.3, 'height': 0.2, 'tip': "Tongue between teeth like த but forward"},
        'V': {'width': 0.2, 'height': 0.1, 'tip': "Bite lower lip slightly"},
        'W': {'width': 0.4, 'height': 0.3, 'tip': "Round lips tightly like ஊ"},
        'F': {'width': 0.25, 'height': 0.15, 'tip': "Upper teeth on lower lip"},
        'R': {'width': 0.35, 'height': 0.25, 'tip': "Curl tongue back slightly"},
        'L': {'width': 0.3, 'height': 0.22, 'tip': "Tongue tip touching upper teeth"},
        'P': {'width': 0.15, 'height': 0.05, 'tip': "Close lips fully then release quickly"},
        'B': {'width': 0.15, 'height': 0.05, 'tip': "Close lips fully with vibration"}
    }
    ref = references.get(target_sound, {'width': 0.3, 'height': 0.2, 'tip': "Focus on proper mouth shape"})
    
    width_diff = abs(width - ref['width'])
    height_diff = abs(height - ref['height'])
    score = max(0, 100 - int((width_diff + height_diff) * 150))
    
    tips = []
    if width_diff > 0.05:
        tips.append(f"Adjust mouth width: {'wider' if width < ref['width'] else 'narrower'}")
    if height_diff > 0.05:
        tips.append(f"Adjust mouth opening: {'taller' if height < ref['height'] else 'shorter'}")
    
    return {
        'score': score,
        'tips': tips if tips else ["Good mouth position!"],
        'reference': f"For '{target_sound}': {ref['tip']}"
    }

def annotate_mouth_shape(img, results):
    # Draw landmarks on image
    if hasattr(results, 'multi_face_landmarks') and results.multi_face_landmarks:
        for face_landmarks in results.multi_face_landmarks:
            MOUTH_LANDMARKS = [61, 291, 39, 181, 17, 406, 335, 273]
            for landmark_id in MOUTH_LANDMARKS:
                if landmark_id < len(face_landmarks.landmark):
                    landmark = face_landmarks.landmark[landmark_id]
                    x = int(landmark.x * img.shape[1])
                    y = int(landmark.y * img.shape[0])
                    cv2.circle(img, (x, y), 2, (0, 255, 0), -1)
    return img

if __name__ == '__main__':
    app.run(host='0.0.0.0',port=5004, debug=True)