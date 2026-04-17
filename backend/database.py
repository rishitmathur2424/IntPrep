# database.py - MySQL connection pool
# Supports both local MySQL and cloud providers (Railway, PlanetScale, Aiven).
# Set DB_SSL=true in .env when using a cloud database that requires SSL.

import mysql.connector
from mysql.connector import pooling
import os
from dotenv import load_dotenv

load_dotenv()

db_config = {
    "host":        os.getenv("DB_HOST", "localhost"),
    "port":        int(os.getenv("DB_PORT", 3306)),
    "user":        os.getenv("DB_USER", "root"),
    "password":    os.getenv("DB_PASSWORD", ""),
    "database":    os.getenv("DB_NAME", "interview_tool"),
    "autocommit":  True,
    "connection_timeout": 30,
}

# Add SSL for cloud databases that require it (Railway, Aiven, etc.)
if os.getenv("DB_SSL", "false").lower() == "true":
    db_config["ssl_disabled"] = False

connection_pool = pooling.MySQLConnectionPool(
    pool_name="intprep_pool",
    pool_size=5,   # conservative — works on free-tier cloud DB plans
    **db_config
)


def get_connection():
    return connection_pool.get_connection()


def execute_query(query: str, params: tuple = None, fetch: bool = False):
    conn   = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(query, params or ())
        if fetch:
            return cursor.fetchall()
        else:
            conn.commit()
            return cursor.lastrowid
    finally:
        cursor.close()
        conn.close()