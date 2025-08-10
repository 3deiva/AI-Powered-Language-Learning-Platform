
# Global variablesfrom flask import Flask, request, jsonify
from flask_cors import CORS
import os
import threading
import time
import json
import pygame
import spacy
import random
from gtts import gTTS
import uuid
import requests
import speech_recognition as sr
from deep_translator import GoogleTranslator
from sentence_transformers import SentenceTransformer, util
from flask import Flask
app = Flask(__name__) 
story_text = ""
current_position = 0
is_speaking = False
is_listening = False
story_completed = False
api_key = os.getenv("GROQ_API_KEY")  # Replace with your actual key
TEMP_AUDIO_FILE = "temp_speech.mp3"

# User preferences
speech_speed = 1.0  # Default speed (1.0 = normal, 0.8 = slower, 1.2 = faster)
target_language = "ta"  # Default target language (Tamil)
difficulty_level = "beginner"  # Default difficulty level

# Language options
LANGUAGE_CODES = {
    "tamil": "ta",
    "hindi": "hi",
    "spanish": "es",
    "french": "fr",
    "german": "de",
    "chinese": "zh-CN",
    "japanese": "ja",
    "korean": "ko"
}

# Load models
bert_model = SentenceTransformer('all-MiniLM-L6-v2')
nlp = spacy.load("en_core_web_sm")

# User progress tracking
user_progress = {
    "stories_completed": 0,
    "listening_time": 0,
    "difficult_words": set(),
    "quiz_scores": []
}

# Difficulty settings
DIFFICULTY_SETTINGS = {
    "beginner": {"chunk_size": 1, "speed": 0.8, "vocabulary_level": "simple"},
    "intermediate": {"chunk_size": 2, "speed": 1.0, "vocabulary_level": "moderate"},
    "advanced": {"chunk_size": 3, "speed": 1.2, "vocabulary_level": "advanced"}
}

# Enhanced stories with cultural notes and difficulty levels
STORIES = {
    "horror": {
        "text": """
        The old house at the end of the street had been empty for years. One night, Sarah heard strange noises coming from inside. The windows seemed to glow with an eerie blue light. She decided to investigate with her flashlight. 
        As she approached the front door, it slowly opened by itself. Sarah's heart was beating fast. 
        Inside, she found dusty furniture and cobwebs everywhere. Suddenly, the temperature dropped and she felt a cold hand on her shoulder. 
        When she turned around, nobody was there. Just a small music box playing on its own. 
        Sarah ran home and never went back to the old house again.
        """,
        "difficulty": "beginner",
        "cultural_notes": {
            "haunted house": "Stories about haunted houses are common in Western folklore and entertainment.",
            "music box": "Music boxes are often used in horror stories as creepy objects that play mysteriously."
        },
        "key_vocabulary": ["eerie", "investigate", "approach", "cobwebs", "temperature"]
    },
    
    "space": {
        "text": """
        Captain Lee and her crew were on a mission to explore a new planet. Their spaceship, the Voyager, had been traveling for six months. 
        The planet looked beautiful from space, with blue oceans and green lands. As they landed, they saw strange plants and purple skies.
        The air was breathable, which was a surprise. They collected samples of rocks and plants for research.
        Suddenly, they discovered footprints that looked almost human. Could there be other intelligent life on this planet?
        The crew followed the tracks to a cave entrance. Inside, they found wall paintings showing the stars and planets.
        Someone or something on this planet understood the universe. Captain Lee knew this was the most important discovery in human history.
        """,
        "difficulty": "intermediate",
        "cultural_notes": {
            "space exploration": "Space exploration is a major theme in science fiction and represents humanity's curiosity.",
            "first contact": "The concept of first contact with alien intelligence is a significant theme in science fiction."
        },
        "key_vocabulary": ["mission", "breathable", "samples", "intelligent", "discovery"]
    },
    
    "festival": {
        "text": """
        The annual Lantern Festival was the highlight of the year in Lin's village. For weeks, everyone prepared colorful paper lanterns in various shapes and sizes.
        On the night of the full moon, the entire village gathered in the central square. Lin brought her butterfly-shaped lantern that she had worked on for days.
        As darkness fell, hundreds of lanterns were lit simultaneously, creating a magical atmosphere. The elders told traditional stories about the origins of the festival.
        Lin's grandmother explained how the lanterns symbolized hope and guidance, helping ancestral spirits find their way back to heaven.
        After the ceremony, everyone released their lanterns into the night sky. Lin watched as her butterfly lantern joined the others, floating upward like a constellation of stars.
        The festival ended with a community feast featuring special moon cakes and sweet rice balls, celebrating togetherness and continuity.
        """,
        "difficulty": "advanced",
        "cultural_notes": {
            "Lantern Festival": "The Lantern Festival is celebrated in many Asian countries to mark the end of lunar new year celebrations.",
            "moon cakes": "Traditional pastries often filled with lotus seed paste, symbolizing completeness and reunion."
        },
        "key_vocabulary": ["annual", "simultaneously", "ancestral", "symbolized", "constellation"]
    }
}

# Speech recognizer for pronunciation practice
recognizer = sr.Recognizer()

def translate_text(text, target_lang=None):
    """Translate text to target language"""
    if not target_lang:
        target_lang = target_language
        
    try:
        return GoogleTranslator(source="en", target=target_lang).translate(text)
    except Exception as e:
        print(f"Translation error: {e}")
        return text  # Return original if translation fails

def get_word_difficulty(word):
    """Determine if a word should be highlighted as difficult"""
    # Simple implementation based on word length and common words
    common_words = {"the", "and", "of", "to", "a", "in", "that", "is", "was", "for", "with", "as", "on", "at", "by", "be"}
    if word.lower() in common_words:
        return "easy"
    if len(word) > 8:
        return "difficult"
    return "medium"

def get_word_definition(word):
    """Get simple definition for a word"""
    # In a real app, this would call a dictionary API
    # Mock implementation for demonstration
    definitions = {
        "eerie": "strange and frightening",
        "investigate": "to examine something carefully",
        "breathable": "air that can be breathed",
        "mission": "an important task or job",
        "cobwebs": "spider webs that collect dust",
        "simultaneously": "at the same time",
        "ancestral": "relating to ancestors or family history"
    }
    return definitions.get(word.lower(), "Definition not available")

def speak_text(text, stop_event=None):
    global is_speaking
    try:
        is_speaking = True
        temp_file = f"temp_speech_{uuid.uuid4().hex}.mp3"  # Unique filename
        
        # Use speech speed setting
        slow_setting = speech_speed < 1.0
        
        # Enhanced TTS with human-like parameters
        tts = gTTS(
            text=text,
            lang='en',
            tld='com',  # Use 'com' domain for American English
            slow=slow_setting,
            lang_check=False  # Bypass strict language checking
        )
        
        tts.save(temp_file)
        
        # Initialize pygame mixer with error handling
        try:
            if not pygame.mixer.get_init():
                pygame.mixer.init(frequency=44100, size=-16, channels=2, buffer=4096)
        except Exception as e:
            print(f"Mixer initialization error: {e}")
            # Try with different parameters
            try:
                pygame.mixer.init(frequency=22050, size=-16, channels=1, buffer=1024)
            except Exception as e:
                print(f"Fallback mixer initialization failed: {e}")
                raise
        
        # Load and play the audio
        try:
            pygame.mixer.music.load(temp_file)
            pygame.mixer.music.set_volume(1.0)
            pygame.mixer.music.play()
            
            # Adjust playback rate if supported
            try:
                if speech_speed != 1.0:
                    pygame.mixer.music.set_pos(1.0 / speech_speed * 0.01)
            except:
                pass
            
            # Track listening time
            start_time = time.time()
            
            # Wait for playback to complete
            clock = pygame.time.Clock()
            while pygame.mixer.music.get_busy():
                clock.tick(10)
                if stop_event and stop_event.is_set():
                    pygame.mixer.music.stop()
                    break
            
            # Update listening time
            if not stop_event or not stop_event.is_set():
                user_progress["listening_time"] += (time.time() - start_time)
                
        finally:
            # Clean up resources
            pygame.mixer.music.stop()
            pygame.mixer.music.unload()
            
    except Exception as e:
        print(f"Error in speech: {e}")
    finally:
        # Ensure cleanup happens
        if pygame.mixer.get_init():
            pygame.mixer.quit()
        if os.path.exists(temp_file):
            try:
                os.remove(temp_file)
            except:
                pass
        is_speaking = False

def get_next_chunk():
    global current_position, story_text, story_completed
    
    # Parse sentences
    doc = nlp(story_text)
    sentences = [sent.text.strip() for sent in doc.sents]
    
    # Get chunk size based on difficulty level
    chunk_size = DIFFICULTY_SETTINGS.get(difficulty_level, {}).get("chunk_size", 1)
    
    if current_position >= len(sentences):
        story_completed = True
        return None
    
    end_pos = min(current_position + chunk_size, len(sentences))
    chunk = ' '.join(sentences[current_position:end_pos])
    current_position = end_pos
    
    return chunk

def ask_groq(question):
    try:
        headers = {
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json"
        }
        
        # Get difficulty-specific instructions
        vocab_level = DIFFICULTY_SETTINGS.get(difficulty_level, {}).get("vocabulary_level", "simple")
        
        # Enhanced system prompt with story context and difficulty level
        prompt = f"""
        You're an English tutor helping a {difficulty_level} student understand this story:
        {story_text}
        
        Guidelines for your answers:
        1. Focus exclusively on the story content
        2. Explain vocabulary and grammar used in the story
        3. Keep answers under 3 sentences
        4. Use {vocab_level} language appropriate for {difficulty_level} learners
        5. Give examples from the story
        6. For vocabulary explanations, include pronunciation hints
        7. Avoid general English lessons unless directly relevant
        """
        
        data = {
            "model": "llama3-70b-8192",
            "messages": [
                {"role": "system", "content": prompt},
                {"role": "user", "content": question}
            ],
            "temperature": 0.5  # Lower for more focused answers
        }
        
        response = requests.post("https://api.groq.com/openai/v1/chat/completions", 
                              headers=headers, json=data)
        
        if response.status_code == 200:
            answer = response.json()['choices'][0]['message']['content']
            # Post-process to ensure brevity
            if len(answer.split('.')) > 3:
                answer = '.'.join(answer.split('.')[:3]) + '.'
            return answer
        return f"Error: {response.text}"
    
    except Exception as e:
        return f"API error: {str(e)}"

def check_sentence_similarity(user_sentence, correct_sentence):
    similarity = util.pytorch_cos_sim(
        bert_model.encode(user_sentence),
        bert_model.encode(correct_sentence)
    ).item()
    return similarity > 0.7

def check_pronunciation(audio_file, text_to_check):
    """Check pronunciation by comparing speech to text"""
    try:
        with sr.AudioFile(audio_file) as source:
            audio = recognizer.record(source)
            recognized_text = recognizer.recognize_google(audio)
            
            # Calculate similarity between recognized text and expected text
            similarity = check_sentence_similarity(recognized_text.lower(), text_to_check.lower())
            
            if similarity > 0.8:
                return {"success": True, "score": similarity, "recognized": recognized_text}
            else:
                return {"success": False, "score": similarity, "recognized": recognized_text}
    except Exception as e:
        return {"success": False, "error": str(e)}

def generate_quiz():
    """Generate enhanced quiz questions from the story"""
    global story_text
    
    doc = nlp(story_text)
    sentences = [sent.text.strip() for sent in doc.sents]
    words = list(set([token.text.lower() for token in doc if token.is_alpha and len(token.text) > 3]))
    
    quiz = []
    
    # Get key vocabulary based on current story
    story_type = None
    for stype, sdata in STORIES.items():
        if sdata["text"].strip() == story_text.strip():
            story_type = stype
            break
            
    key_vocabulary = []
    if story_type and "key_vocabulary" in STORIES[story_type]:
        key_vocabulary = STORIES[story_type]["key_vocabulary"]
    
    # Add difficult words from user progress
    priority_words = list(user_progress["difficult_words"]) + key_vocabulary
    available_words = [w for w in words if len(w) > 4]
    for word in available_words[:3] + priority_words[:2]:  # Mix regular and difficult words
        if word not in available_words:
            continue
            
        translated_word = translate_text(word)
        options = [word]
        # Add distractor options
        distractors = [w for w in words if w != word]
        options.extend(random.sample(distractors, min(3, len(distractors))))
        random.shuffle(options)
        
        quiz.append({
            "type": "multiple_choice",
            "question": f"What is the English word for '{translated_word}'?",
            "options": options,
            "answer": word
        })
    
    # Sentence translation questions
    if len(sentences) >= 3:
        # Choose sentences based on difficulty
        num_sentences = 3 if difficulty_level == "advanced" else (2 if difficulty_level == "intermediate" else 1)
        selected_sentences = random.sample(sentences, num_sentences)
        for sentence in selected_sentences:
            translation = translate_text(sentence)
            quiz.append({
                "type": "translation",
                "question": f"Translate this sentence into English: '{translation}'",
                "answer": sentence
            })
    
    # Listening comprehension
    if len(sentences) >= 2:
        comprehension_sentences = random.sample(sentences, 2)
        for sentence in comprehension_sentences:
            # Create fill-in-the-blank
            tokens = [t.text for t in nlp(sentence) if t.is_alpha and len(t.text) > 3]
            if tokens:
                word_to_remove = random.choice(tokens)
                blank_sentence = sentence.replace(word_to_remove, "______")
                
                options = [word_to_remove]
                distractors = [w for w in words if w != word_to_remove and len(w) > 3]
                options.extend(random.sample(distractors, min(3, len(distractors))))
                random.shuffle(options)
                
                quiz.append({
                    "type": "fill_blank",
                    "question": f"Listen and complete: {blank_sentence}",
                    "options": options,
                    "answer": word_to_remove,
                    "full_sentence": sentence
                })
    
    return quiz

def analyze_text_for_display():
    """Analyze text to provide word-by-word information for interactive transcript"""
    global story_text
    
    doc = nlp(story_text)
    analyzed_text = []
    
    for token in doc:
        if token.is_alpha:
            difficulty = get_word_difficulty(token.text)
            definition = get_word_definition(token.text) if difficulty != "easy" else ""
            
            analyzed_text.append({
                "word": token.text,
                "difficulty": difficulty,
                "definition": definition,
                "pos": token.pos_,  # Part of speech
                "is_key": token.text.lower() in STORIES.get(get_current_story_type(), {}).get("key_vocabulary", [])
            })
        else:
            analyzed_text.append({
                "word": token.text,
                "is_punctuation": True
            })
    
    return analyzed_text

def get_current_story_type():
    """Get the current story type based on story text"""
    for story_type, story_data in STORIES.items():
        if story_data["text"].strip() == story_text.strip():
            return story_type
    return None

@app.route('/api/get_stories', methods=['GET'])
def get_stories():
    """Return available stories with previews and metadata"""
    story_previews = {}
    
    # Print debug info to server console
    print(f"Available stories: {list(STORIES.keys())}")
    
    for story_type, story_data in STORIES.items():
        # Ensure all necessary fields exist with defaults
        difficulty = story_data.get("difficulty", "beginner")
        text = story_data.get("text", "")
        word_count = len(text.split())
        key_vocabulary = story_data.get("key_vocabulary", [])[:3]
        
        story_previews[story_type] = {
            "preview": text[:100] + "..." if text else "",
            "difficulty": difficulty,
            "word_count": word_count,
            "vocabulary_focus": key_vocabulary + ["..."] if key_vocabulary else []
        }
        
        # Print each story being processed
        print(f"Processed story: {story_type}")
    
    # Debug total stories being returned
    print(f"Returning {len(story_previews)} stories")
    
    return jsonify({"stories": story_previews})

@app.route('/api/get_languages', methods=['GET'])
def get_languages():
    """Return available target languages"""
    return jsonify({"languages": LANGUAGE_CODES})

@app.route('/api/set_preferences', methods=['POST'])
def set_preferences():
    """Set user preferences for speech and difficulty"""
    global speech_speed, target_language, difficulty_level
    
    data = request.json
    if 'speed' in data:
        speech_speed = float(data['speed'])
    
    if 'language' in data:
        if data['language'] in LANGUAGE_CODES.values():
            target_language = data['language']
        elif data['language'] in LANGUAGE_CODES:
            target_language = LANGUAGE_CODES[data['language']]
    
    if 'difficulty' in data:
        difficulty_level = data['difficulty']
    
    return jsonify({
        "status": "success",
        "preferences": {
            "speed": speech_speed,
            "language": target_language,
            "difficulty": difficulty_level
        }
    })

@app.route('/api/select_story', methods=['POST'])
def select_story():
    global story_text, current_position, is_listening, story_completed
    story_type = request.json.get('type', 'horror')
    
    if story_type not in STORIES:
        return jsonify({"error": "Story type not found"}), 400
        
    story_text = STORIES[story_type]["text"]
    current_position = 0
    is_listening = True
    story_completed = False
    
    # Get additional story metadata
    cultural_notes = STORIES[story_type].get("cultural_notes", {})
    key_vocabulary = STORIES[story_type].get("key_vocabulary", [])
    
    # Analyze text for interactive transcript
    analyzed_text = analyze_text_for_display()
    
    # Start narration in a separate thread
    stop_event = threading.Event()
    threading.Thread(target=narrate_story, args=(stop_event,)).start()
    
    return jsonify({
        "status": "started", 
        "story_title": story_type.capitalize() + " Story",
        "full_text": story_text,
        "cultural_notes": cultural_notes,
        "key_vocabulary": key_vocabulary,
        "analyzed_text": analyzed_text,
        "difficulty": STORIES[story_type]["difficulty"]
    })

@app.route('/api/pause_story', methods=['POST'])
def pause_story():
    global is_speaking, is_listening
    is_listening = False
    if pygame.mixer.get_init():
        pygame.mixer.music.stop()
    return jsonify({"status": "paused"})

@app.route('/api/continue_story', methods=['POST'])
def continue_story():
    global is_listening
    is_listening = True
    stop_event = threading.Event()
    threading.Thread(target=narrate_story, args=(stop_event,)).start()
    return jsonify({"status": "continued"})

@app.route('/api/repeat_current', methods=['POST'])
def repeat_current():
    """Repeat the current chunk or sentence"""
    global current_position
    
    # Move position back by chunk size
    chunk_size = DIFFICULTY_SETTINGS.get(difficulty_level, {}).get("chunk_size", 1)
    current_position = max(0, current_position - chunk_size)
    
    # Start narration
    stop_event = threading.Event()
    threading.Thread(target=narrate_story, args=(stop_event,)).start()
    
    return jsonify({"status": "repeating"})

@app.route('/api/pronounce_word', methods=['POST'])
def pronounce_word():
    """Pronounce a specific word"""
    word = request.json.get('word', '')
    
    if not word:
        return jsonify({"error": "No word provided"}), 400
    
    # Get word definition and translation
    definition = get_word_definition(word)
    translation = translate_text(word)
    
    # Speak word in a separate thread
    stop_event = threading.Event()
    speak_thread = threading.Thread(target=speak_text, args=(word, stop_event))
    speak_thread.start()
    
    return jsonify({
        "word": word,
        "definition": definition,
        "translation": translation
    })

@app.route('/api/check_pronunciation', methods=['POST'])
def api_check_pronunciation():
    """Check user's pronunciation of a text"""
    if 'audio' not in request.files:
        return jsonify({"error": "No audio file provided"}), 400
        
    text_to_check = request.form.get('text', '')
    if not text_to_check:
        return jsonify({"error": "No text provided to check against"}), 400
    
    audio_file = request.files['audio']
    temp_audio = f"temp_recording_{uuid.uuid4().hex}.wav"
    audio_file.save(temp_audio)
    
    try:
        result = check_pronunciation(temp_audio, text_to_check)
        os.remove(temp_audio)
        return jsonify(result)
    except Exception as e:
        if os.path.exists(temp_audio):
            os.remove(temp_audio)
        return jsonify({"error": str(e)}), 500

@app.route('/api/ask_question', methods=['POST'])
def ask_question():
    global is_speaking, is_listening
    question = request.json.get('question', '')
    
    # Stop current narration if any
    is_listening = False
    stop_event = threading.Event()
    stop_event.set()
    
    if pygame.mixer.get_init() and pygame.mixer.music.get_busy():
        pygame.mixer.music.stop()
    
    # Get answer
    answer = ask_groq(question)
    translation = translate_text(answer)
    
    # Extract keywords from answer for learning
    doc = nlp(answer)
    keywords = [token.text for token in doc if token.is_alpha and len(token.text) > 3 and not token.is_stop]
    
    # Speak answer in a separate thread
    speak_thread = threading.Thread(target=speak_text, args=(answer, stop_event))
    speak_thread.start()
    
    return jsonify({
        "answer": answer, 
        "translation": translation,
        "story_completed": story_completed,
        "keywords": keywords[:5]  # Top 5 keywords
    })

@app.route('/api/get_story_status', methods=['GET'])
def get_story_status():
    global current_position, story_text, story_completed
    
    # Calculate completion percentage
    doc = nlp(story_text)
    sentences = list(doc.sents)
    total_sentences = len(sentences)
    completion = min(100, int((current_position / max(1, total_sentences)) * 100))
    
    # Get current chunk/sentence being read
    current_sentence = ""
    if current_position > 0 and current_position <= len(sentences):
        # Get the current sentence being processed
        current_sentence = sentences[current_position-1].text.strip()
    
    # Get cultural notes for current sentence
    story_type = get_current_story_type()
    cultural_notes = {}
    if story_type:
        cultural_notes = STORIES[story_type].get("cultural_notes", {})
        
    return jsonify({
        "completion_percentage": completion,
        "is_completed": story_completed,
        "current_sentence": current_sentence,
        "translation": translate_text(current_sentence),
        "relevant_cultural_notes": cultural_notes,
        "current_difficulty": difficulty_level
    })

@app.route('/api/generate_quiz', methods=['GET'])
def get_quiz():
    global story_completed
    
    if not story_completed:
        return jsonify({"error": "Story not yet completed"}), 400
        
    quiz = generate_quiz()
    return jsonify({"quiz": quiz})

@app.route('/api/check_answer', methods=['POST'])
def check_answer():
    data = request.json
    question_type = data.get('type', 'multiple_choice')
    user_answer = data.get('user_answer', '')
    correct_answer = data.get('correct_answer', '')
    
    if question_type == 'multiple_choice':
        is_correct = user_answer == correct_answer
    elif question_type == 'translation':
        is_correct = check_sentence_similarity(user_answer, correct_answer)
    elif question_type == 'fill_blank':
        is_correct = user_answer.lower() == correct_answer.lower()
    else:
        is_correct = False
        
    # Update user progress
    if not is_correct and len(correct_answer) > 0:
        # Add difficult words to user's profile
        words = correct_answer.split()
        for word in words:
            if len(word) > 3 and word.isalpha():
                user_progress["difficult_words"].add(word.lower())
    
    # Record quiz score
    user_progress["quiz_scores"].append(1 if is_correct else 0)
    
    feedback = "Good job!" if is_correct else f"The correct answer is: {correct_answer}"
    
    # Add translation for feedback
    translated_feedback = translate_text(feedback)
    
    return jsonify({
        "correct": is_correct,
        "message": feedback,
        "translation": translated_feedback
    })

@app.route('/api/get_user_progress', methods=['GET'])
def get_user_progress():
    """Get user's learning progress"""
    global user_progress
    
    # Calculate statistics
    total_quizzes = len(user_progress["quiz_scores"])
    correct_answers = sum(user_progress["quiz_scores"])
    accuracy = 0 if total_quizzes == 0 else (correct_answers / total_quizzes * 100)
    
    return jsonify({
        "stories_completed": user_progress["stories_completed"],
        "listening_time_minutes": round(user_progress["listening_time"] / 60, 1),
        "quiz_accuracy": round(accuracy, 1),
        "difficult_words_count": len(user_progress["difficult_words"]),
        "difficult_words": list(user_progress["difficult_words"])[:10]  # Top 10 difficult words
    })

@app.route('/api/get_transcript', methods=['GET'])
def get_transcript():
    """Get interactive transcript of current story"""
    global story_text
    
    # Get analyzed text with word-by-word information
    analyzed_text = analyze_text_for_display()
    
    # Get story type and cultural notes
    story_type = get_current_story_type()
    cultural_notes = {}
    if story_type:
        cultural_notes = STORIES[story_type].get("cultural_notes", {})
    
    return jsonify({
        "transcript": analyzed_text,
        "cultural_notes": cultural_notes
    })

def narrate_story(stop_event):
    global is_speaking, is_listening, story_completed, user_progress
    
    while is_listening and not story_completed and not stop_event.is_set():
        chunk = get_next_chunk()
        if not chunk:
            story_completed = True
            # Update completed stories count
            if story_completed:
                user_progress["stories_completed"] += 1
            break
        
        # Get translation
        translation = translate_text(chunk)
        
        # Speak English if not stopped
        if not stop_event.is_set():
            speak_text(chunk, stop_event)
        
        # Add slight pause between chunks
        time.sleep(0.8)

if __name__ == '__main__':
    pygame.init()
    app.run(host='0.0.0.0', port=5001, threaded=True)