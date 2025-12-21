import sqlite3
from flask import Flask, request, jsonify
from datetime import datetime

app = Flask(__name__)
DB_NAME = "plant_data.db"

# --- CONFIGURATION ---
DRY_THRESHOLD = 500 

# --- DATABASE SETUP ---
def get_db_connection():
    """Helper to open a connection to the DB file."""
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row 
    return conn

def init_db():
    """Creates the database table if it doesn't exist yet."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Note: If this table already exists from an old project version, 
    # new columns (batt_volts) might be missing. 
    # If you get errors, delete 'plant_data.db' and restart the server.
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS readings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            air_temp_f REAL,
            humidity REAL,
            lux REAL,
            soil_temp_f REAL,
            soil_moisture INTEGER,
            batt_volts REAL,
            batt_pct REAL
        )
    ''')
    conn.commit()
    conn.close()

# Initialize the DB immediately
init_db()

@app.route('/')
def home():
    return "<h1>Plant Server (Battery Edition) is Online!</h1>"

# --- 1. RECEIVE DATA (POST) ---
@app.route('/api/data', methods=['POST'])
def receive_data():
    data = request.json
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    print(f"[{timestamp}] Batt: {data.get('batt_pct', 0)}% | Moisture: {data.get('soil_moisture')}")

    conn = get_db_connection()
    try:
        conn.execute('''
            INSERT INTO readings (
                timestamp, air_temp_f, humidity, lux, 
                soil_temp_f, soil_moisture, batt_volts, batt_pct
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            timestamp,
            data.get('air_temp_f'),
            data.get('humidity'),
            data.get('lux'),
            data.get('soil_temp_f'),
            data.get('soil_moisture'),
            data.get('batt_volts'),
            data.get('batt_pct')
        ))
        conn.commit()
    except sqlite3.OperationalError as e:
        print(f"❌ DATABASE ERROR: {e}")
        print("💡 TIP: If the error says 'no such column', delete plant_data.db and restart.")
    finally:
        conn.close()

    # Watering Logic
    response_command = "SLEEP"
    if 'soil_moisture' in data:
        if data['soil_moisture'] < DRY_THRESHOLD:
            response_command = "WATER"
            print("   >>> ALERT: Soil is DRY. Commanding WATER! <<<")

    return jsonify({"status": "success", "command": response_command})

# --- 2. GET LATEST READING (New! Efficient for Home Screen) ---
@app.route('/api/latest', methods=['GET'])
def get_latest():
    conn = get_db_connection()
    row = conn.execute('''
        SELECT timestamp, air_temp_f, humidity, lux, 
               soil_moisture, soil_temp_f, batt_volts, batt_pct 
        FROM readings 
        ORDER BY id DESC LIMIT 1
    ''').fetchone()
    conn.close()
    
    if row is None:
        return jsonify({})
        
    return jsonify(dict(row))

# --- 3. GET HISTORY (Last 50) ---
@app.route('/api/history', methods=['GET'])
def get_history():
    conn = get_db_connection()
    readings = conn.execute('''
        SELECT timestamp, air_temp_f, humidity, lux, 
               soil_moisture, soil_temp_f, batt_volts, batt_pct 
        FROM readings 
        ORDER BY id DESC LIMIT 50
    ''').fetchall()
    conn.close()
    
    return jsonify([dict(row) for row in readings])

if __name__ == '__main__':
    # Using port 5001 to avoid MacOS AirPlay conflicts
    app.run(host='0.0.0.0', port=5001)