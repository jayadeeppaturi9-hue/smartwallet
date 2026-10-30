"""
Interactive SQLite CLI and Query Runner for the AD-PROJECT-2 database.
Usage:
    python sql_shell.py                       # Opens interactive SQL prompt
    python sql_shell.py .tables               # Lists all database tables
    python sql_shell.py .schema <table_name>  # Shows table schema
    python sql_shell.py "SELECT * FROM ..."   # Runs a single SQL query
"""

import sys
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "db.sqlite3"


def print_table(cursor, headers=True):
    rows = cursor.fetchall()
    if not rows:
        print("(0 rows returned)")
        return

    col_names = [d[0] for d in cursor.description]
    # Calculate column widths
    widths = [len(c) for c in col_names]
    for row in rows:
        for i, val in enumerate(row):
            widths[i] = max(widths[i], len(str(val) if val is not None else "NULL"))

    sep = "+-" + "-+-".join("-" * w for w in widths) + "-+"
    header_str = "| " + " | ".join(c.ljust(widths[i]) for i, c in enumerate(col_names)) + " |"

    print(sep)
    print(header_str)
    print(sep)
    for row in rows:
        row_str = "| " + " | ".join((str(val) if val is not None else "NULL").ljust(widths[i]) for i, val in enumerate(row)) + " |"
        print(row_str)
    print(sep)
    print(f"({len(rows)} row{'s' if len(rows) != 1 else ''})")


def run_command(con, cmd):
    cmd = cmd.strip()
    if not cmd:
        return

    cur = con.cursor()

    if cmd == ".tables":
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
        tables = [r[0] for r in cur.fetchall()]
        print("Tables in db.sqlite3:")
        for t in tables:
            print(f"  - {t}")
        return

    if cmd.startswith(".schema"):
        parts = cmd.split(maxsplit=1)
        if len(parts) > 1:
            table_name = parts[1].strip()
            cur.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name=?", (table_name,))
        else:
            cur.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
        for row in cur.fetchall():
            if row[0]:
                print(row[0] + ";\n")
        return

    if cmd.lower() in ("exit", "quit", ".exit", ".quit"):
        sys.exit(0)

    try:
        cur.execute(cmd)
        if cur.description:
            print_table(cur)
        else:
            con.commit()
            print(f"Query OK, {cur.rowcount} row(s) affected.")
    except Exception as e:
        print(f"Error: {e}")


def main():
    if not DB_PATH.exists():
        print(f"Error: Database file not found at {DB_PATH}")
        sys.exit(1)

    con = sqlite3.connect(str(DB_PATH))

    # Single-command mode
    if len(sys.argv) > 1:
        query = " ".join(sys.argv[1:])
        run_command(con, query)
        return

    # Interactive mode
    print(f"Connected to SQLite database: {DB_PATH.name}")
    print("Commands:")
    print("  .tables              List all tables")
    print("  .schema <table_name> Show table schema")
    print("  SELECT ... ;         Execute SQL query")
    print("  exit / quit          Exit prompt\n")

    while True:
        try:
            line = input("sqlite> ").strip()
            if not line:
                continue
            run_command(con, line)
        except (KeyboardInterrupt, EOFError):
            print("\nBye.")
            break


if __name__ == "__main__":
    main()
