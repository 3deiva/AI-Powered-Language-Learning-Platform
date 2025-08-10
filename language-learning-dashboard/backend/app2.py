from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)

# SQLite Database Configuration
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///language_learning.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# User Model
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    phone_number = db.Column(db.String(20))
    reading_progress = db.Column(db.Integer, default=0)
    writing_progress = db.Column(db.Integer, default=0)
    speaking_progress = db.Column(db.Integer, default=0)
    listening_progress = db.Column(db.Integer, default=0)

# Create tables
with app.app_context():
    db.create_all()

# Updated Signup Endpoint
@app.route('/api/signup', methods=['POST'])
def signup():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    phone_number = data.get('phoneNumber')

    if not username or not password or not phone_number:
        return jsonify({"error": "All fields are required"}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({"error": "Username already exists"}), 400

    new_user = User(
        username=username,
        password=generate_password_hash(password),
        phone_number=phone_number
    )
    db.session.add(new_user)
    db.session.commit()

    return jsonify({"message": "Account created successfully!"}), 201

# Updated Login Endpoint
@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    user = User.query.filter_by(username=username).first()

    if not user or not check_password_hash(user.password, password):
        return jsonify({"error": "Invalid username or password"}), 401

    user_data = {
        "username": user.username,
        "phone_number": user.phone_number,
        "progress": {
            "reading": user.reading_progress,
            "writing": user.writing_progress,
            "speaking": user.speaking_progress,
            "listening": user.listening_progress
        }
    }

    return jsonify({"message": "Login successful", "user": user_data}), 200

# Run the app
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5002, debug=True)