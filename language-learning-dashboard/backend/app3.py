from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import os
import random
import hashlib
from groq import Groq
from gtts import gTTS
import os
from flask import send_from_directory

app = Flask(__name__)
CORS(app)

# Initialize Groq client
api_key = os.getenv("GROQ_API_KEY") 

# Q-learning parameters
alpha = 0.1  # Learning rate
gamma = 0.6  # Discount factor
epsilon = 0.3  # Exploration rate

AUDIO_FOLDER = 'static/audio'
if not os.path.exists(AUDIO_FOLDER):
    os.makedirs(AUDIO_FOLDER)

def generate_audio(text, filename):
    """Generate audio file using gTTS with improved error handling"""
    try:
        # Always use English for the audio generation
        tts = gTTS(text=text, lang='en', slow=False)
        filepath = os.path.join(AUDIO_FOLDER, filename)
        tts.save(filepath)
        
        # Verify the file exists and has content
        if os.path.exists(filepath) and os.path.getsize(filepath) > 0:
            return f"/static/audio/{filename}"
        else:
            print(f"Generated audio file is empty or missing: {filepath}")
            return None
    except Exception as e:
        print(f"Error generating audio: {e}")
        return None

@app.route('/static/audio/<path:filename>')
def serve_audio(filename):
    """Serve audio files with improved error handling"""
    try:
        return send_from_directory(AUDIO_FOLDER, filename)
    except FileNotFoundError:
        # Extract the word from the filename (format: type_difficulty_hash.mp3)
        parts = filename.split('_')
        if len(parts) >= 3:
            try:
                word = ' '.join(parts[2:]).replace('.mp3', '')
                generated = generate_audio(word, filename)
                if generated:
                    return send_from_directory(AUDIO_FOLDER, filename)
            except Exception as e:
                print(f"Error regenerating audio: {e}")
        return "Audio file not found", 404

# Difficulty levels with descriptions
DIFFICULTY_LEVELS = {
    1: {"description": "Single words with audio and Tamil support", "types": ["speaking_word", "listening", "writing"]},
    2: {"description": "2-word phrases with images", "types": ["speaking_word", "listening", "writing"]},
    3: {"description": "Simple sentences", "types": ["speaking_sentence", "listening", "writing"]},
    4: {"description": "Questions & answers", "types": ["speaking_sentence", "listening", "writing"]},
    5: {"description": "Short conversations", "types": ["speaking_sentence", "listening", "writing"]}
}

# In-memory cache to avoid repeated questions
question_cache = {}

# Initialize Q-table
q_table = {}
if os.path.exists('qtable.json'):
    with open('qtable.json', 'r') as f:
        q_table = json.load(f)

def hash_text(text):
    return hashlib.md5(text.encode()).hexdigest()

def update_q_table(user_id, difficulty, exercise_type, reward):
    """Updates the Q-table based on the reward received"""
    state = f"{user_id}-{difficulty}-{exercise_type}"
    
    if state not in q_table:
        q_table[state] = [0] * len(DIFFICULTY_LEVELS)
    
    old_value = q_table[state][difficulty - 1]
    next_max = max(q_table[state])
    new_value = (1 - alpha) * old_value + alpha * (reward + gamma * next_max)
    q_table[state][difficulty - 1] = new_value
    
    with open('qtable.json', 'w') as f:
        json.dump(q_table, f)
    
    return new_value

def determine_next_exercise(user_id, last_correct, current_difficulty, force_type=None):
    """Q-learning based decision with adaptive difficulty and exercise type enforcement"""
    states = [key for key in q_table.keys() if key.startswith(user_id)]
    
    # Adjust difficulty based on last answer
    new_difficulty = current_difficulty
    if last_correct:
        new_difficulty = min(current_difficulty + 1, max(DIFFICULTY_LEVELS.keys()))
    else:
        new_difficulty = max(current_difficulty - 1, min(DIFFICULTY_LEVELS.keys()))
    
    # If exercise type is forced, use it
    if force_type and (force_type in DIFFICULTY_LEVELS[new_difficulty]["types"] or 
                      (force_type in ["speaking_word", "speaking_sentence"] and 
                       "speaking" in DIFFICULTY_LEVELS[new_difficulty]["types"])):
        return new_difficulty, force_type
    
    # Exploration vs Exploitation
    if not states or random.random() < epsilon:
        return new_difficulty, random.choice(DIFFICULTY_LEVELS[new_difficulty]["types"])
    
    # Exploitation
    possible_states = [s for s in states if s.split('-')[1] == str(new_difficulty)]
    if possible_states:
        best_state = max(possible_states, key=lambda x: max(q_table[x]))
        _, difficulty, ex_type = best_state.split('-')
        return int(difficulty), ex_type
    
    return new_difficulty, random.choice(DIFFICULTY_LEVELS[new_difficulty]["types"])

def generate_question(ex_type, difficulty, native_language="tamil", past_question_ids=None):
    """Generate a question with enhanced audio handling"""
    if past_question_ids is None:
        past_question_ids = []
    
    # First check cache
    cache_key = f"{ex_type}_{difficulty}"
    if cache_key in question_cache:
        cached_questions = [q for q in question_cache[cache_key] 
                          if hash_text(q["question"]) not in past_question_ids]
        if cached_questions:
            question = random.choice(cached_questions)
            question["question_id"] = hash_text(question["question"])
            return question
    
    # Generate new question
    try:
        # Create the prompt based on exercise type and difficulty
        prompt = f"""
        Generate a {ex_type} question for English learning at difficulty level {difficulty}.
        The user's native language is {native_language}.
        
        Provide the question in {native_language}, but provide the correct_answer in English.
        
        For listening exercises, the question should be in {native_language} asking what English word/phrase they hear, 
        and the correct_answer should be the English word/phrase that will be played in the audio.
        Also provide 3 plausible but incorrect English options that are similar to the correct answer.
        
        For speaking exercises, the question should be in {native_language} asking them to speak an English word/phrase, 
        and the correct_answer should be the English word/phrase they need to say.
        
        For writing exercises, the question should be in {native_language} asking them to write an English word/phrase,
        and the correct_answer should be the English word/phrase they need to write.
        
        All explanations should be in {native_language} to help the user understand.
        
        Return the response as a JSON object with these keys:
        - question
        - correct_answer
        - explanation
        - options (for listening exercises, provide an array with 4 options: the correct answer and 3 incorrect options)
        """
        
        # Make the API call to Groq
        chat_completion = groq_client.chat.completions.create(
            messages=[
                {
                    "role": "user",
                    "content": prompt,
                }
            ],
            model="llama3-70b-8192",
            response_format={"type": "json_object"}
        )
        
        # Parse the response
        question_data = json.loads(chat_completion.choices[0].message.content)
        
        # Validate and format the response
        question_data["difficulty"] = difficulty
        question_data["exercise_type"] = ex_type
        question_data["question_id"] = hash_text(question_data["question"])
        
        # Generate audio for speaking/listening exercises - ALWAYS in English
        if ex_type in ["speaking_word", "speaking_sentence", "listening"]:
            audio_text = question_data["correct_answer"]  # This should be English
            audio_filename = f"{ex_type}_{difficulty}_{hash_text(audio_text)}.mp3"
            audio_url = generate_audio(audio_text, audio_filename)
            question_data["audio_url"] = audio_url or ""
        
        # Handle listening options - ensure options are in English
        if ex_type == "listening":
            if "options" not in question_data or not question_data["options"] or len(question_data["options"]) < 4:
                # Generate backup options if the LLM didn't provide proper ones
                correct = question_data["correct_answer"]
                
                # Create more natural distractor options
                if difficulty <= 2:  # For words or short phrases
                    # For single words, create options with similar sounds or meanings
                    if len(correct.split()) <= 2:
                        similar_words = [
                            correct,
                            correct[0] + "".join(random.sample(correct[1:], len(correct)-1)) if len(correct) > 3 else correct + "s",
                            correct[:-1] + random.choice("aeiou") if len(correct) > 3 else correct + "ing",
                            "".join(random.sample(correct, len(correct))) if len(correct) > 3 else "the " + correct
                        ]
                    else:
                        # For phrases, modify one word
                        words = correct.split()
                        similar_words = [
                            correct,
                            " ".join(words[:-1] + [words[-1] + "s"]),
                            " ".join([words[0] + "ing"] + words[1:]),
                            " ".join(["the"] + words)
                        ]
                else:  # For sentences
                    words = correct.split()
                    similar_words = [
                        correct,
                        " ".join(words[:len(words)//2] + ["is"] + words[len(words)//2+1:]) if len(words) > 2 else correct + " please",
                        " ".join(words[:1] + ["don't"] + words[1:]) if len(words) > 2 else "I " + correct,
                        " ".join(["Can"] + words) if len(words) > 2 else correct + " now"
                    ]
                
                question_data["options"] = similar_words
            
            # Ensure options are strings and correct answer is included
            question_data["options"] = [str(opt) for opt in question_data["options"]]
            if question_data["correct_answer"] not in question_data["options"]:
                question_data["options"][0] = question_data["correct_answer"]
            
            # Limit to 4 options maximum
            if len(question_data["options"]) > 4:
                # Keep the correct answer and 3 other options
                correct_answer = question_data["correct_answer"]
                other_options = [opt for opt in question_data["options"] if opt != correct_answer]
                question_data["options"] = [correct_answer] + random.sample(other_options, min(3, len(other_options)))
            
            # If we still don't have enough options, add some
            while len(question_data["options"]) < 4:
                # Add variations of the correct answer
                correct = question_data["correct_answer"]
                if len(correct.split()) <= 1:  # Single word
                    question_data["options"].append(correct + random.choice(["s", "ed", "ing"]))
                else:  # Phrase or sentence
                    words = correct.split()
                    question_data["options"].append(" ".join(words[:-1] + [words[-1] + random.choice(["s", "ed"])]))
            
            # Make sure options are unique
            question_data["options"] = list(dict.fromkeys(question_data["options"]))
            
            # Ensure we have exactly 4 options
            while len(question_data["options"]) < 4:
                question_data["options"].append(f"Option {len(question_data['options']) + 1}")
            
            # Keep only 4 options if we have more
            if len(question_data["options"]) > 4:
                # Make sure correct answer is included
                correct_answer = question_data["correct_answer"]
                other_options = [opt for opt in question_data["options"] if opt != correct_answer]
                question_data["options"] = [correct_answer] + random.sample(other_options, 3)
            
            # Always shuffle the options
            random.shuffle(question_data["options"])
        
        # Cache the question
        if cache_key not in question_cache:
            question_cache[cache_key] = []
        if len(question_cache[cache_key]) >= 10:
            question_cache[cache_key].pop(0)  
        question_cache[cache_key].append(question_data)
        
        return question_data
        
    except Exception as e:
        print(f"Error generating question: {e}")
        # Return backup question with fallback audio
        backup_question = {
            "question": f"Sample {ex_type} question ({difficulty})",
            "correct_answer": "sample answer",
            "explanation": "இது ஒரு மாதிரி கேள்வி",
            "difficulty": difficulty,
            "exercise_type": ex_type,
            "audio_url": "",
            "question_id": f"backup_{random.randint(1000, 9999)}"
        }
        
        # Add options for listening exercises
        if ex_type == "listening":
            backup_question["options"] = [
                "sample answer", 
                "option one", 
                "option two", 
                "option three"
            ]
            random.shuffle(backup_question["options"])
            
        return backup_question

@app.route('/api/get_question', methods=['POST'])
def get_question():
    """Get a question from Groq with enhanced exercise type management"""
    data = request.json
    user_id = data.get('user_id')
    past_question_ids = data.get('past_question_ids', [])
    
    try:
        # Determine next exercise
        difficulty, ex_type = determine_next_exercise(
            user_id,
            data.get('last_correct', False),
            data.get('current_difficulty', 1),
            data.get('force_exercise_type')
        )
        
        # For sentence exercises, ensure minimum difficulty level
        if ex_type == "speaking_sentence" or (ex_type == "writing" and data.get('questionsCompleted', 0) >= 5):
            difficulty = max(difficulty, 3)  # Minimum difficulty 3 for sentences
            
        # Generate question with past questions to avoid repetition
        question = generate_question(
            ex_type, 
            difficulty, 
            data.get('native_language', 'tamil'),
            past_question_ids
        )
        
        return jsonify(question)
        
    except Exception as e:
        print(f"Error generating question: {e}")
        return jsonify({
            "error": str(e),
            "message": "Failed to generate question. Please try again."
        }), 500

@app.route('/api/submit_answer', methods=['POST'])
def submit_answer():
    """Process user answer and update Q-learning model"""
    data = request.json
    user_id = data['user_id']
    difficulty = data['difficulty']
    exercise_type = data['exercise_type']
    is_correct = data['is_correct']
    
    # Calculate reward
    reward = 2 if is_correct else -1
    
    # Higher reward for sentence exercises and higher difficulties
    if exercise_type == "speaking_sentence":
        reward *= 1.5
    elif exercise_type == "writing" and difficulty >= 3:
        reward *= 1.3
        
    reward += difficulty * 0.5  # Higher reward for higher difficulty
    
    # Update Q-table
    update_q_table(user_id, difficulty, exercise_type, reward)
    
    # Determine new difficulty
    new_difficulty = difficulty
    if is_correct and difficulty < max(DIFFICULTY_LEVELS.keys()):
        # Increase difficulty more aggressively for sustained correct answers
        streak = data.get('streak', 0)
        if streak >= 3:
            new_difficulty = min(difficulty + 2, max(DIFFICULTY_LEVELS.keys()))
        else:
            new_difficulty += 1
    elif not is_correct and difficulty > min(DIFFICULTY_LEVELS.keys()):
        new_difficulty -= 1
    
    return jsonify({
        "status": "success",
        "new_difficulty": new_difficulty,
        "reward": reward
    })

# Simple caching middleware to prevent duplicate questions
@app.before_request
def before_request():
    # Only apply to get_question endpoint
    if request.path == '/api/get_question' and request.method == 'POST':
        try:
            data = request.get_json()
            if not data or not isinstance(data, dict):
                return
                
            # Remember recent questions by user to prevent repetition
            user_id = data.get('user_id')
            if user_id:
                cache_key = f"user_{user_id}_recent"
                if cache_key not in question_cache:
                    question_cache[cache_key] = []
                # We'll use this in generate_question to avoid duplicates
        except:
            pass

if __name__ == '__main__':
    app.run(host='0.0.0.0',debug=True, port=5003)