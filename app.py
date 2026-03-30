from flask import Flask, request, jsonify, send_from_directory
import sqlite3
import random
import os

app = Flask(__name__, static_folder='static')
DB_FILE = "hangman.db"

def get_db_connection():
    try:
        conn = sqlite3.connect(DB_FILE)
        return conn
    except Exception as e:
        print(f"DB Error: {e}")
        return None

def init_db():
    try:
        conn = get_db_connection()
        if conn is None: return
        mc = conn.cursor()
        mc.execute("CREATE TABLE IF NOT EXISTS List (word TEXT);")
        mc.execute("CREATE TABLE IF NOT EXISTS Player (Name TEXT, Points INTEGER, Words INTEGER);")
        
        mc.execute("SELECT count(*) FROM List;")
        if mc.fetchone()[0] == 0:
            default_words = ["apple", "banana", "orange", "grape", "mango", "strawberry", "pineapple", "watermelon", "peach", "cherry"]
            for w in default_words:
                mc.execute("INSERT INTO List (word) VALUES (?);", (w,))

        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Init DB Error: {e}")

init_db()

def check_auth(password):
    return password == "D@rkc0der"

@app.route('/')
def serve_index():
    return send_from_directory('static', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('static', path)

@app.route('/api/words', methods=['GET', 'POST', 'DELETE'])
def manage_words():
    password = request.headers.get("Authorization")
    if not check_auth(password):
        return jsonify({"error": "Unauthorized"}), 401

    conn = get_db_connection()
    if not conn: return jsonify({"error": "Database error"}), 500
    mc = conn.cursor()

    if request.method == 'GET':
        mc.execute("SELECT word FROM List;")
        words = [row[0] for row in mc.fetchall()]
        conn.close()
        return jsonify({"words": words})

    elif request.method == 'POST':
        data = request.json
        word = data.get("word", "").strip().lower()
        if not word:
            return jsonify({"error": "Word cannot be empty"}), 400
        mc.execute("SELECT word FROM List WHERE word=?;", (word,))
        if mc.fetchone():
            return jsonify({"error": "Word already in list"}), 400
        mc.execute("INSERT INTO List (word) VALUES (?);", (word,))
        conn.commit()
        conn.close()
        return jsonify({"message": "Word added"})

    elif request.method == 'DELETE':
        data = request.json
        word = data.get("word", "").strip().lower()
        mc.execute("DELETE FROM List WHERE word=?;", (word,))
        conn.commit()
        conn.close()
        return jsonify({"message": "Word deleted"})

@app.route('/api/random_word', methods=['GET'])
def get_random_word():
    conn = get_db_connection()
    if not conn: return jsonify({"error": "Database error"}), 500
    mc = conn.cursor()
    mc.execute("SELECT word FROM List;")
    words = [row[0] for row in mc.fetchall()]
    conn.close()
    if not words:
        return jsonify({"error": "No words in list. Ask admin to add some."}), 404
    return jsonify({"word": random.choice(words)})

@app.route('/api/scores', methods=['GET', 'POST', 'DELETE'])
def manage_scores():
    conn = get_db_connection()
    if not conn: return jsonify({"error": "Database error"}), 500
    mc = conn.cursor()

    if request.method == 'GET':
        mc.execute("SELECT Name, Points, Words FROM Player ORDER BY Points DESC;")
        players = [{"name": row[0], "points": row[1], "words": row[2]} for row in mc.fetchall()]
        conn.close()
        return jsonify({"players": players})

    elif request.method == 'POST':
        data = request.json
        name = data.get("name", "").strip().upper()
        points = int(data.get("points", 0))
        words_won = int(data.get("words", 0))
        if not name:
            return jsonify({"error": "Name cannot be empty"}), 400

        mc.execute("SELECT Name FROM Player WHERE Name=?;", (name,))
        if mc.fetchone():
            mc.execute("UPDATE Player SET Points = Points + ?, Words = Words + ? WHERE Name = ?;", (points, words_won, name))
        else:
            mc.execute("INSERT INTO Player (Name, Points, Words) VALUES (?, ?, ?);", (name, points, words_won))
        conn.commit()
        conn.close()
        return jsonify({"message": "Score updated"})

    elif request.method == 'DELETE':
        password = request.headers.get("Authorization")
        if not check_auth(password):
            return jsonify({"error": "Unauthorized"}), 401
        
        data = request.json
        name = data.get("name", "").strip().upper()
        mc.execute("SELECT Name FROM Player WHERE Name=?;", (name,))
        if not mc.fetchone():
            return jsonify({"error": "No player found"}), 404
            
        mc.execute("DELETE FROM Player WHERE Name=?;", (name,))
        conn.commit()
        conn.close()
        return jsonify({"message": "Player deleted"})

if __name__ == '__main__':
    app.run(debug=True, port=5000)
