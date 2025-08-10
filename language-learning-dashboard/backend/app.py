from flask import Flask, request, jsonify
from flask_cors import CORS
import easyocr
import cv2
import numpy as np
import os
import torch
from spellchecker import SpellChecker
import difflib
import random
import base64
import io
from PIL import Image
import re
import pytesseract 
from collections import defaultdict, Counter
from pymongo import MongoClient
from datetime import datetime

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Initialize EasyOCR reader with optimized settings
cuda_available = torch.cuda.is_available()
reader = easyocr.Reader(
    ['en'],
    gpu=cuda_available,
    verbose=False,
    model_storage_directory='./easyocr_models',
    recog_network='english_g2',
    download_enabled=True
)
def test_mongo_connection():
    try:
        client = MongoClient('mongodb://localhost:27017/', serverSelectionTimeoutMS=5000)
        client.server_info()  # Force connection to check if server is available

        db = client['language_learning_db']

        # Check and create collections if they don't exist
        if 'writing' not in db.list_collection_names():
            db['writing'].insert_one({'init': True, 'timestamp': datetime.now()})
            print("Created 'writing' collection")

        if 'overall' not in db.list_collection_names():
            db['overall'].insert_one({'init': True, 'timestamp': datetime.now()})
            print("Created 'overall' collection")

        return "Collections checked and created if necessary."
    except Exception as e:
        return f"Error: {e}"

print(test_mongo_connection())
# Enhanced practice content
letters = list("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz")
words = [
    "apple", "book", "cat", "dog", "elephant", "flower", "guitar", "house",
    "ice", "juice", "kite", "lion", "monkey", "notebook", "orange", "pencil",
    "queen", "rainbow", "sun", "tree", "umbrella", "violin", "water",
    "xylophone", "yellow", "zebra", "basket", "candle", "dolphin", "engine"
]
sentences = [
    "The quick brown fox jumps over the lazy dog.",
    "Pack my box with five dozen liquor jugs.",
    "How vexingly quick daft zebras jump!",
    "Bright vixens jump; dozy fowl quack.",
    "Sphinx of black quartz, judge my vow.",
    "The five boxing wizards jump quickly.",
    "Crazy Fredrick bought many very exquisite opal jewels.",
    "Jinxed wizards pluck ivy from the big quilt.",
    "Few black taxis drive up major roads on quiet hazy nights.",
    "Amazingly few discotheques provide jukeboxes."
]

# Initialize spell checker
spell = SpellChecker()
spell.word_frequency.load_words(words + [word.lower() for word in words])

def preprocess_image(image, is_single_char=False):
    """Enhanced preprocessing with case preservation"""
    # Convert to grayscale
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # Contrast enhancement
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)
    
    if is_single_char:
        # Special handling for single characters
        _, binary = cv2.threshold(enhanced, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        adaptive = cv2.adaptiveThreshold(enhanced, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                                       cv2.THRESH_BINARY_INV, 11, 2)
        combined = cv2.bitwise_or(binary, adaptive)
        
        # Gentle morphology to preserve thin strokes
        kernel = np.ones((1, 1), np.uint8)
        processed = cv2.morphologyEx(combined, cv2.MORPH_OPEN, kernel)
    else:
        # For words and sentences
        _, binary = cv2.threshold(enhanced, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        adaptive = cv2.adaptiveThreshold(enhanced, 255, cv2.ADAPTIVE_THRESH_MEAN_C,
                                       cv2.THRESH_BINARY_INV, 15, 5)
        combined = cv2.bitwise_or(binary, adaptive)
        
        # More aggressive cleaning for longer text
        kernel = np.ones((2, 2), np.uint8)
        processed = cv2.morphologyEx(combined, cv2.MORPH_CLOSE, kernel)
    
    return processed

def extract_text(image_data, is_single_char=False):
    """Enhanced text extraction with case preservation"""
    try:
        # Handle image data
        if isinstance(image_data, str):
            if image_data.startswith('data:image'):
                image_data = image_data.split(',')[1]
            image_bytes = base64.b64decode(image_data)
            nparr = np.frombuffer(image_bytes, np.uint8)
        else:
            nparr = np.frombuffer(image_data, np.uint8)
            
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if image is None:
            return None, "Could not decode image"
        
        # Preprocess based on content type
        processed = preprocess_image(image, is_single_char)
        
        # Multi-engine OCR approach
        texts = []
        confidences = []
        
        # EasyOCR configuration
        easy_results = reader.readtext(
            processed,
            paragraph=False,
            decoder='beamsearch',
            beamWidth=10,
            batch_size=4,
            min_size=10,
            text_threshold=0.4,
            low_text=0.3,
            link_threshold=0.3,
            contrast_ths=0.1,
            adjust_contrast=0.5,
            add_margin=0.1
        )
        
        if easy_results:
            result_text = ' '.join([r[1] for r in easy_results])
            avg_confidence = sum([r[2] for r in easy_results]) / len(easy_results) if easy_results else 0
            texts.append(result_text)
            confidences.append(avg_confidence)
        
        # Tesseract configuration
        try:
            config = '--psm 6 --oem 3 -c preserve_interword_spaces=1'
            if is_single_char:
                config = '--psm 10 --oem 3 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
            
            tess_text = pytesseract.image_to_string(processed, config=config).strip()
            
            if tess_text:
                texts.append(tess_text)
                data = pytesseract.image_to_data(processed, config=config, output_type=pytesseract.Output.DICT)
                if data['conf']:
                    valid_confs = [c for c in data['conf'] if c != -1]
                    avg_tess_conf = sum(valid_confs) / len(valid_confs) if valid_confs else 0
                    confidences.append(avg_tess_conf / 100)
        except Exception:
            pass
        
        # Select best result
        if texts:
            if confidences:
                best_idx = confidences.index(max(confidences))
                extracted_text = texts[best_idx]
            else:
                extracted_text = max(texts, key=len)
            
            # Clean text while preserving case
            extracted_text = clean_text(extracted_text)
            
            # Apply spell correction only for words/sentences
            if not is_single_char and (len(extracted_text.split()) > 1 or len(extracted_text) > 1):
                corrected_text = correct_text(extracted_text)
            else:
                corrected_text = extracted_text
            
            return corrected_text.strip(), None
        else:
            return None, "No text detected"
    
    except Exception as e:
        return None, f"Error processing image: {str(e)}"

def clean_text(text):
    """Clean while preserving case and basic punctuation"""
    # Remove special characters except basic punctuation and letters
    text = re.sub(r'[^\w\s.,!?\']', '', text)
    # Normalize whitespace but preserve case
    text = ' '.join(text.split())
    return text

def correct_text(text):
    """Case-aware spell correction"""
    words = text.split()
    corrected_words = []
    
    for word in words:
        # Skip correction for proper nouns and mixed case words
        if (word != word.lower() and word != word.upper()) or len(word) == 1:
            corrected_words.append(word)
            continue
            
        # Get candidates
        candidates = spell.candidates(word)
        if candidates:
            best_candidate = spell.correction(word)
            
            # Only apply if correction matches case pattern
            if best_candidate:
                if word.isupper():
                    corrected_words.append(best_candidate.upper())
                elif word[0].isupper():
                    corrected_words.append(best_candidate.capitalize())
                elif best_candidate.lower() == word.lower():
                    corrected_words.append(best_candidate.lower())
                else:
                    corrected_words.append(word)
            else:
                corrected_words.append(word)
        else:
            corrected_words.append(word)
    
    return ' '.join(corrected_words)

def calculate_similarity(text1, text2):
    """Enhanced similarity calculation with case awareness"""
    # Exact match with case
    if text1 == text2:
        return 1.0
    
    # Case-insensitive exact match
    if text1.lower() == text2.lower():
        return 0.95
    
    # Sequence matching
    sequence_ratio = difflib.SequenceMatcher(None, text1.lower(), text2.lower()).ratio()
    
    # Token-based similarity
    tokens1 = set(text1.lower().split())
    tokens2 = set(text2.lower().split())
    token_ratio = len(tokens1 & tokens2) / len(tokens1 | tokens2) if (tokens1 or tokens2) else 0
    
    # Weighted average
    return 0.8 * sequence_ratio + 0.2 * token_ratio

@app.route('/api/practice', methods=['GET'])
def get_practice_content():
    """Get practice content based on type"""
    content_type = request.args.get('type', 'word')
    
    if content_type == 'letter':
        content = random.choice(letters)
    elif content_type == 'word':
        content = random.choice(words)
    else:  # sentence
        content = random.choice(sentences)
    
    return jsonify({
        'content': content,
        'type': content_type
    })

@app.route('/api/evaluate', methods=['POST'])
def evaluate_writing():
    """Evaluate user's writing against target"""
    try:
        if request.is_json:
            data = request.json
            target = data.get('target', '')
            image_data = data.get('image', None)
            content_type = data.get('type', 'word')
        else:
            target = request.form.get('target', '')
            image_file = request.files.get('image')
            content_type = request.form.get('type', 'word')
            image_data = image_file.read() if image_file else None
        
        if not image_data:
            return jsonify({'error': 'No image data provided'}), 400
        
        is_single_char = content_type == 'letter'
        extracted_text, error = extract_text(image_data, is_single_char)
        
        if error:
            return jsonify({'error': error}), 500
        
        accuracy = calculate_similarity(extracted_text, target)
        score = min(100, int(accuracy * 100))
        is_correct = score >= 70
        
        # Generate feedback
        feedback = generate_feedback(extracted_text, target, score, content_type)
        
        return jsonify({
            'extracted_text': extracted_text,
            'target': target,
            'accuracy': score,
            'is_correct': is_correct,
            'feedback': feedback
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def generate_feedback(extracted, target, score, content_type):
    """Generate detailed feedback based on content type"""
    if score >= 90:
        return "Excellent! Your handwriting is very clear and accurate."
    elif score >= 70:
        return "Good job! Your writing is legible with minor differences."
    
    # Specific feedback for different content types
    if content_type == 'letter':
        if extracted and target:
            if extracted.lower() == target.lower():
                return "Close! Check your letter case - is it uppercase or lowercase?"
            else:
                return f"Try again. Focus on forming the letter '{target}' correctly."
    elif content_type == 'word':
        diff = list(difflib.ndiff(target.lower().split(), extracted.lower().split()))
        errors = [d for d in diff if d.startswith('- ') or d.startswith('+ ')]
        if errors:
            return f"Almost there! Pay attention to: {', '.join(errors[:3])}"
    else:  # sentence
        return "Try writing again. Focus on spacing between words and punctuation."
    
    return "Try again. Focus on forming each character carefully."

@app.route('/api/ocr/convert', methods=['POST'])
def convert_letter():
    """Enhanced single character recognition"""
    try:
        data = request.json
        image_data = base64.b64decode(data['image'])
        
        # Convert to OpenCV image
        nparr = np.frombuffer(image_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        # Special preprocessing for single character
        processed = preprocess_image(img, is_single_char=True)
        
        # Resize to square while maintaining aspect ratio
        height, width = processed.shape
        max_dim = max(height, width, 64)
        square = np.zeros((max_dim, max_dim), dtype=np.uint8)
        start_y = (max_dim - height) // 2
        start_x = (max_dim - width) // 2
        square[start_y:start_y+height, start_x:start_x+width] = processed
        resized = cv2.resize(square, (64, 64), interpolation=cv2.INTER_CUBIC)
        
        # Multi-engine recognition
        results = []
        confidences = []
        
        # Tesseract with different configurations
        for psm in [10, 6, 8]:  # Try single char first, then other modes
            config = f'--psm {psm} --oem 3 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
            text = pytesseract.image_to_string(resized, config=config).strip()
            if text:
                results.append(text[0])
                data = pytesseract.image_to_data(resized, config=config, output_type=pytesseract.Output.DICT)
                if data['conf']:
                    confidences.append(float(data['conf'][0]) if data['conf'] else 0)
                else:
                    confidences.append(0)
        
        # EasyOCR for single character
        easy_result = reader.readtext(
            resized,
            detail=1,
            paragraph=False,
            min_size=10,
            text_threshold=0.2,
            low_text=0.1,
            link_threshold=0.2,
        )
        
        if easy_result and easy_result[0][1]:
            results.append(easy_result[0][1][0])
            confidences.append(float(easy_result[0][2]) if len(easy_result[0]) > 2 else 0)
        
        # Decision logic with confidence threshold
        final_char = ""
        max_conf = 0
        
        if results:
            # Group results by character with confidence
            char_groups = defaultdict(list)
            for r, c in zip(results, confidences):
                char_groups[r].append(c)
            
            # Get average confidence per character
            avg_confs = {k: sum(v)/len(v) for k, v in char_groups.items()}
            
            # Apply confidence threshold (60)
            good_chars = {k: v for k, v in avg_confs.items() if v >= 60}
            
            if good_chars:
                final_char, max_conf = max(good_chars.items(), key=lambda x: x[1])
            else:
                # Fallback to most common character with some confidence
                counts = Counter(results)
                final_char = counts.most_common(1)[0][0]
                max_conf = 50  # Default confidence for fallback
        
        return jsonify({
            'success': True,
            'text': final_char,
            'confidence': max_conf,
            'all_detected': ''.join(set(results)) if results else ""
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        })

@app.route('/api/generate/letters', methods=['GET'])
def generate_letter_questions():
    """Generate letter practice questions"""
    selected = random.sample(letters, min(10, len(letters)))
    questions = [{
        'id': i+1,
        'type': 'letter',
        'content': letter,
        'question': f"Write the letter: {letter}"
    } for i, letter in enumerate(selected)]
    
    return jsonify({
        'questions': questions,
        'count': len(questions)
    })

@app.route('/api/generate/words', methods=['GET'])
def generate_word_questions():
    """Generate word practice questions"""
    selected = random.sample(words, min(10, len(words))) if len(words) >= 10 else random.choices(words, k=10)
    questions = [{
        'id': i+1,
        'type': 'word',
        'content': word,
        'question': f"Write the word: {word}"
    } for i, word in enumerate(selected)]
    
    return jsonify({
        'questions': questions,
        'count': len(questions)
    })

@app.route('/api/generate/sentences', methods=['GET'])
def generate_sentence_questions():
    """Generate sentence practice questions"""
    selected = random.sample(sentences, min(10, len(sentences))) if len(sentences) >= 10 else random.choices(sentences, k=10)
    questions = [{
        'id': i+1,
        'type': 'sentence',
        'content': sentence,
        'question': f"Write the sentence: {sentence}"
    } for i, sentence in enumerate(selected)]
    
    return jsonify({
        'questions': questions,
        'count': len(questions)
    })
@app.route('/api/test/evaluate-single', methods=['POST'])
def evaluate_single_test_answer():
    try:
        data = request.json
        target = data.get('target', '')
        image_data = data.get('image', None)
        extracted_text = data.get('extracted_text', '')
        content_type = 'letter'  # Force letter type for this endpoint
        username = data.get('username', 'User')

        # If we have both image and extracted text, prioritize the extracted text
        if extracted_text:
            # Clean the extracted text
            cleaned_text = clean_text(extracted_text)
            
            # For letters, compare first character only and be case-sensitive
            if len(target) == 1 and len(cleaned_text) >= 1:
                accuracy = 1.0 if cleaned_text[0] == target else 0.0
            else:
                accuracy = calculate_similarity(cleaned_text, target)
        elif image_data:
            # Fall back to OCR if no extracted text provided
            extracted_text, error = extract_text(image_data, is_single_char=True)
            if error:
                return jsonify({'error': error}), 500
            
            if len(target) == 1 and len(extracted_text) >= 1:
                accuracy = 1.0 if extracted_text[0] == target else 0.0
            else:
                accuracy = calculate_similarity(extracted_text, target)
        else:
            return jsonify({'error': 'No evaluation data provided'}), 400

        score = min(100, int(accuracy * 100))
        is_correct = score >= 70
        feedback = generate_feedback(extracted_text, target, score, content_type)
        
        # MongoDB operations
        try:
            client = MongoClient('mongodb://localhost:27017/')
            db = client['language_learning_db']
            current_time = datetime.now()
            
            # Update cumulative score (+1 only if correct)
            if is_correct:
                result = db.overall.update_one(
                    {'username': username},
                    {
                        '$inc': {'score': 1},  # Always +1 if correct
                        '$setOnInsert': {  # Only set these on new document creation
                            'username': username,
                            'created_at': current_time
                        },
                        '$set': {  # Always update these
                            'last_updated': current_time,
                            'last_activity': content_type
                        }
                    },
                    upsert=True  # Create document if it doesn't exist
                )
            
            # Store individual attempts in writing collection
            db.writing.insert_one({
                'username': username,
                'score': 1 if is_correct else 0,  # Store 1 if correct, 0 otherwise
                'content_type': content_type,
                'timestamp': current_time,
                'accuracy': score,
                'is_correct': is_correct
            })
            
            print(f"Updated cumulative score for {username}")
        
        except Exception as db_error:
            print(f"Database error: {str(db_error)}")
        
        return jsonify({
            'extracted_text': extracted_text,
            'target': target,
            'accuracy': score,
            'is_correct': is_correct,
            'feedback': feedback
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def get_total_score(username):
    """Helper function to get current total score"""
    try:
        client = MongoClient('mongodb://localhost:27017/')
        db = client['language_learning_db']
        record = db.overall.find_one({'username': username})
        return record['score'] if record else 0
    except:
        return 0

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, threaded=True)