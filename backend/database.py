import psycopg2
from psycopg2 import pool
from psycopg2.extras import execute_values
import os

connection_pool = psycopg2.pool.ThreadedConnectionPool(
    minconn=1,
    maxconn=10,
    dbname=os.getenv("PGDATABASE", "shift_schedule"),
    user=os.getenv("PGUSER", "mattdou"),
    password=os.getenv("PGPASSWORD", ""),
    host=os.getenv("PGHOST", "localhost"),
    port=os.getenv("PGPORT", "5432")
)

def get_connection():
    return connection_pool.getconn()

def release_connection(conn):
    connection_pool.putconn(conn)

# === EMPLOYEES ===

def add_employee(name, desired_hours, manager_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO employees (name, desired_hours, manager_id) VALUES (%s, %s, %s) RETURNING id;",
        (name, desired_hours, manager_id)
    )
    employee_id = cursor.fetchone()[0]
    conn.commit()
    cursor.close()
    release_connection(conn)
    return employee_id

def get_all_employees(manager_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, desired_hours FROM employees WHERE manager_id = %s;", (manager_id,))
    rows = cursor.fetchall()
    cursor.close()
    release_connection(conn)
    return rows

def get_employee_usage(employee_id, manager_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT COUNT(*) FROM schedule WHERE employee_id = %s AND manager_id = %s;",
        (employee_id, manager_id)
    )
    shift_count = cursor.fetchone()[0]
    cursor.execute(
        "SELECT COUNT(*) FROM users WHERE employee_id = %s;",
        (employee_id,)
    )
    has_login = cursor.fetchone()[0] > 0
    cursor.close()
    release_connection(conn)
    return {"shift_count": shift_count, "has_login": has_login}

def delete_employee(employee_id, manager_id):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM shift_trades WHERE requester_id = %s;", (employee_id,))
        cursor.execute("DELETE FROM password_resets WHERE employee_id = %s;", (employee_id,))
        cursor.execute("DELETE FROM schedule WHERE employee_id = %s;", (employee_id,))
        cursor.execute("DELETE FROM ratings WHERE employee_id = %s;", (employee_id,))
        cursor.execute("DELETE FROM availability WHERE employee_id = %s;", (employee_id,))
        cursor.execute("DELETE FROM employee_roles WHERE employee_id = %s;", (employee_id,))
        cursor.execute("DELETE FROM users WHERE employee_id = %s;", (employee_id,))
        cursor.execute("DELETE FROM employees WHERE id = %s AND manager_id = %s;", (employee_id, manager_id))
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        release_connection(conn)

# === SHIFTS ===

def add_shift(day, start_time, end_time, manager_id, role_id=None):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO shifts (day, start_time, end_time, role_id, manager_id) VALUES (%s, %s, %s, %s, %s) RETURNING id;",
        (day, start_time, end_time, role_id, manager_id)
    )
    shift_id = cursor.fetchone()[0]
    conn.commit()
    cursor.close()
    release_connection(conn)
    return shift_id

def get_all_shifts(manager_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT shifts.id, shifts.day, shifts.start_time, shifts.end_time, shifts.role_id, roles.name, shifts.template_id
        FROM shifts
        LEFT JOIN roles ON shifts.role_id = roles.id
        WHERE shifts.manager_id = %s
        ORDER BY shifts.day, shifts.start_time;
    """, (manager_id,))
    rows = cursor.fetchall()
    cursor.close()
    release_connection(conn)
    return rows

def update_shift(shift_id, day, start_time, end_time, manager_id, role_id=None):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE shifts SET day = %s, start_time = %s, end_time = %s, role_id = %s WHERE id = %s AND manager_id = %s;",
        (day, start_time, end_time, role_id, shift_id, manager_id)
    )
    conn.commit()
    cursor.close()
    release_connection(conn)

def delete_shift(shift_id, manager_id):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT day, template_id FROM shifts WHERE id = %s AND manager_id = %s;", (shift_id, manager_id))
    row = cursor.fetchone()
    if row and row[1] is not None:
        day, template_id = row
        cursor.execute(
            "INSERT INTO template_exclusions (template_id, excluded_date) VALUES (%s, %s) ON CONFLICT DO NOTHING;",
            (template_id, day)
        )

    cursor.execute("DELETE FROM schedule WHERE shift_id = %s;", (shift_id,))
    cursor.execute("DELETE FROM shifts WHERE id = %s AND manager_id = %s;", (shift_id, manager_id))
    conn.commit()
    cursor.close()
    release_connection(conn)

# === RATINGS (dependent — scoped via employee_id, no manager_id column needed) ===

def add_rating(employee_id, category, score):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO ratings (employee_id, category, score) VALUES (%s, %s, %s) RETURNING id;",
        (employee_id, category, score)
    )
    rating_id = cursor.fetchone()[0]
    conn.commit()
    cursor.close()
    release_connection(conn)
    return rating_id

def get_ratings_by_employee(employee_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, category, score FROM ratings WHERE employee_id = %s;",
        (employee_id,)
    )
    rows = cursor.fetchall()
    cursor.close()
    release_connection(conn)
    return rows

# === SCHEDULE ===

def save_schedule(shift_id, employee_id, manager_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO schedule (shift_id, employee_id, manager_id) VALUES (%s, %s, %s) RETURNING id;",
        (shift_id, employee_id, manager_id)
    )
    schedule_id = cursor.fetchone()[0]
    conn.commit()
    cursor.close()
    release_connection(conn)
    return schedule_id

def get_schedule(manager_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT schedule.id, employees.name, shifts.day, shifts.start_time, shifts.end_time, roles.name, shifts.id
        FROM schedule
        JOIN employees ON schedule.employee_id = employees.id
        JOIN shifts ON schedule.shift_id = shifts.id
        LEFT JOIN roles ON shifts.role_id = roles.id
        WHERE schedule.manager_id = %s;
    """, (manager_id,))
    rows = cursor.fetchall()
    cursor.close()
    release_connection(conn)
    return rows

def get_day_overview(date_str: str, manager_id: int):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT 
            shifts.id,
            shifts.start_time,
            shifts.end_time,
            roles.name AS role_name,
            employees.name AS assigned_employee,
            schedule.id AS schedule_id,
            schedule.employee_id AS assigned_employee_id
        FROM shifts
        LEFT JOIN roles ON shifts.role_id = roles.id
        LEFT JOIN schedule ON schedule.shift_id = shifts.id
        LEFT JOIN employees ON schedule.employee_id = employees.id
        WHERE shifts.day = %s AND shifts.manager_id = %s
        ORDER BY shifts.start_time;
    """, (date_str, manager_id))
    shifts = []
    for row in cursor.fetchall():
        shifts.append({
            "shift_id": row[0],
            "start_time": str(row[1]),
            "end_time": str(row[2]),
            "role": row[3],
            "assigned_employee": row[4],
            "schedule_id": row[5],
            "assigned_employee_id": row[6]
        })

    cursor.execute("SELECT id, name FROM employees WHERE manager_id = %s ORDER BY name;", (manager_id,))
    all_employees = cursor.fetchall()

    cursor.close()
    release_connection(conn)

    from datetime import datetime
    day_name = datetime.strptime(date_str, "%Y-%m-%d").strftime("%A")

    available_employees = []
    for emp_id, emp_name in all_employees:
        is_available = get_availability_for_date(emp_id, date_str, day_name)

        conn2 = get_connection()
        cursor2 = conn2.cursor()
        cursor2.execute("""
            SELECT roles.name FROM employee_roles
            JOIN roles ON employee_roles.role_id = roles.id
            WHERE employee_roles.employee_id = %s;
        """, (emp_id,))
        emp_roles = [r[0] for r in cursor2.fetchall()]
        cursor2.close()
        release_connection(conn2)

        available_employees.append({
            "id": emp_id,
            "name": emp_name,
            "roles": emp_roles,
            "available": is_available
        })

    return {"shifts": shifts, "available_employees": available_employees}

def clear_schedule(manager_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM schedule WHERE manager_id = %s;", (manager_id,))
    conn.commit()
    cursor.close()
    release_connection(conn)

def clear_schedule_for_week(start_date: str, end_date: str, manager_id: int):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        DELETE FROM schedule
        WHERE manager_id = %s
        AND shift_id IN (
            SELECT id FROM shifts
            WHERE day >= %s AND day <= %s
        );
    """, (manager_id, start_date, end_date))
    conn.commit()
    cursor.close()
    release_connection(conn)

def week_has_schedule(start_date: str, end_date: str, manager_id: int) -> bool:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT COUNT(*) FROM schedule
        JOIN shifts ON schedule.shift_id = shifts.id
        WHERE shifts.day >= %s AND shifts.day <= %s AND schedule.manager_id = %s;
    """, (start_date, end_date, manager_id))
    count = cursor.fetchone()[0]
    cursor.close()
    release_connection(conn)
    return count > 0

def manually_assign_shift(shift_id: int, employee_id: int, manager_id: int):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM schedule WHERE shift_id = %s;", (shift_id,))
    cursor.execute(
        "INSERT INTO schedule (shift_id, employee_id, manager_id) VALUES (%s, %s, %s) RETURNING id;",
        (shift_id, employee_id, manager_id)
    )
    schedule_id = cursor.fetchone()[0]
    conn.commit()
    cursor.close()
    release_connection(conn)
    return schedule_id

def remove_schedule_entry(schedule_id: int, manager_id: int):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM schedule WHERE id = %s AND manager_id = %s;", (schedule_id, manager_id))
    conn.commit()
    cursor.close()
    release_connection(conn)

def get_unassigned_shifts(start_date: str, end_date: str, manager_id: int):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT shifts.id, shifts.day, shifts.start_time, shifts.end_time, roles.name
        FROM shifts
        LEFT JOIN roles ON shifts.role_id = roles.id
        LEFT JOIN schedule ON schedule.shift_id = shifts.id
        WHERE schedule.shift_id IS NULL
        AND shifts.manager_id = %s
        AND shifts.day >= %s AND shifts.day <= %s;
    """, (manager_id, start_date, end_date))
    rows = cursor.fetchall()
    cursor.close()
    release_connection(conn)
    return rows

def get_shift_assignment(shift_id: int):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT employees.name
        FROM schedule
        JOIN employees ON schedule.employee_id = employees.id
        WHERE schedule.shift_id = %s;
    """, (shift_id,))
    row = cursor.fetchone()
    cursor.close()
    release_connection(conn)
    return row[0] if row else None

# === AVAILABILITY — dependent, scoped via employee_id, unchanged ===

def add_recurring_availability(employee_id, day_name, status='available'):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO availability (employee_id, type, day_name, status) VALUES (%s, 'recurring', %s, %s);",
        (employee_id, day_name, status)
    )
    conn.commit()
    cursor.close()
    release_connection(conn)

def add_specific_availability(employee_id, specific_date, status):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO availability (employee_id, type, specific_date, status) VALUES (%s, 'specific', %s, %s) RETURNING id;",
        (employee_id, specific_date, status)
    )
    new_id = cursor.fetchone()[0]
    conn.commit()
    cursor.close()
    release_connection(conn)
    return new_id

def get_availability(employee_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT day_name FROM availability WHERE employee_id = %s AND type = 'recurring' AND status = 'available';",
        (employee_id,)
    )
    recurring_days = [row[0] for row in cursor.fetchall()]

    cursor.execute(
        "SELECT id, specific_date, status FROM availability WHERE employee_id = %s AND type = 'specific' ORDER BY specific_date;",
        (employee_id,)
    )
    specific_overrides = [
        {"id": row[0], "date": str(row[1]), "status": row[2]}
        for row in cursor.fetchall()
    ]

    cursor.close()
    release_connection(conn)
    return {"recurring_days": recurring_days, "specific_overrides": specific_overrides}

def delete_availability(employee_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "DELETE FROM availability WHERE employee_id = %s AND type = 'recurring';",
        (employee_id,)
    )
    conn.commit()
    cursor.close()
    release_connection(conn)

def delete_specific_availability(override_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "DELETE FROM availability WHERE id = %s AND type = 'specific';",
        (override_id,)
    )
    conn.commit()
    cursor.close()
    release_connection(conn)

def get_availability_for_date(employee_id, date_str, day_name):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT status FROM availability WHERE employee_id = %s AND type = 'specific' AND specific_date = %s;",
        (employee_id, date_str)
    )
    specific = cursor.fetchone()
    if specific:
        cursor.close()
        release_connection(conn)
        return specific[0] == 'available'

    cursor.execute(
        "SELECT status FROM availability WHERE employee_id = %s AND type = 'recurring' AND day_name = %s;",
        (employee_id, day_name)
    )
    recurring = cursor.fetchone()
    cursor.close()
    release_connection(conn)
    if recurring:
        return recurring[0] == 'available'
    return False

def get_schedule_conflicts(manager_id):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT schedule.id, schedule.employee_id, shifts.day
        FROM schedule
        JOIN shifts ON schedule.shift_id = shifts.id
        WHERE schedule.manager_id = %s;
    """, (manager_id,))
    rows = cursor.fetchall()
    cursor.close()
    release_connection(conn)

    conflict_ids = set()
    for schedule_id, employee_id, day in rows:
        day_name = day.strftime('%A')
        if not get_availability_for_date(employee_id, day, day_name):
            conflict_ids.add(schedule_id)

    return conflict_ids

# === ROLES ===

def add_role(name, manager_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO roles (name, manager_id) VALUES (%s, %s) RETURNING id;",
        (name, manager_id)
    )
    role_id = cursor.fetchone()[0]
    conn.commit()
    cursor.close()
    release_connection(conn)
    return role_id

def get_all_roles(manager_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name FROM roles WHERE manager_id = %s;", (manager_id,))
    rows = cursor.fetchall()
    cursor.close()
    release_connection(conn)
    return rows

def get_role_usage(role_id: int):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT COUNT(*) FROM employee_roles WHERE role_id = %s;",
        (role_id,)
    )
    employee_count = cursor.fetchone()[0]
    cursor.execute(
        "SELECT COUNT(*) FROM shifts WHERE role_id = %s;",
        (role_id,)
    )
    shift_count = cursor.fetchone()[0]
    cursor.close()
    release_connection(conn)
    return {"employee_count": employee_count, "shift_count": shift_count}

def delete_role(role_id: int, manager_id: int):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM employee_roles WHERE role_id = %s;", (role_id,))
    cursor.execute("UPDATE shifts SET role_id = NULL WHERE role_id = %s;", (role_id,))
    cursor.execute("DELETE FROM roles WHERE id = %s AND manager_id = %s;", (role_id, manager_id))
    conn.commit()
    cursor.close()
    release_connection(conn)

# === EMPLOYEE ROLES — dependent, scoped via employee_id, unchanged ===

def assign_role_to_employee(employee_id, role_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO employee_roles (employee_id, role_id) VALUES (%s, %s);",
        (employee_id, role_id)
    )
    conn.commit()
    cursor.close()
    release_connection(conn)

def get_employee_roles(employee_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT roles.id, roles.name 
        FROM employee_roles 
        JOIN roles ON employee_roles.role_id = roles.id 
        WHERE employee_roles.employee_id = %s;
        """,
        (employee_id,)
    )
    rows = cursor.fetchall()
    cursor.close()
    release_connection(conn)
    return rows

def remove_employee_role(employee_id, role_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "DELETE FROM employee_roles WHERE employee_id = %s AND role_id = %s;",
        (employee_id, role_id)
    )
    conn.commit()
    cursor.close()
    release_connection(conn)

# === USERS / AUTH — untouched, not manager-scoped the same way ===

def create_user(username, password_hash, role, employee_id=None):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO users (username, password_hash, role, employee_id) VALUES (%s, %s, %s, %s) RETURNING id;",
        (username, password_hash, role, employee_id)
    )
    user_id = cursor.fetchone()[0]
    conn.commit()
    cursor.close()
    release_connection(conn)
    return user_id

def reset_user_password(employee_id, new_password_hash):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE users SET password_hash = %s WHERE employee_id = %s;",
        (new_password_hash, employee_id)
    )
    conn.commit()
    cursor.close()
    release_connection(conn)

def get_user_by_username(username):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, username, password_hash, role, employee_id FROM users WHERE username = %s;",
        (username,)
    )
    row = cursor.fetchone()
    cursor.close()
    release_connection(conn)
    return row

def get_user_by_employee_id(employee_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, username, role, employee_id FROM users WHERE employee_id = %s;",
        (employee_id,)
    )
    row = cursor.fetchone()
    cursor.close()
    release_connection(conn)
    return row

def get_schedule_by_employee(employee_id: int):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT schedule.id, employees.name, shifts.day, shifts.start_time, shifts.end_time
        FROM schedule
        JOIN employees ON schedule.employee_id = employees.id
        JOIN shifts ON schedule.shift_id = shifts.id
        WHERE schedule.employee_id = %s;
    """, (employee_id,))
    rows = cursor.fetchall()
    cursor.close()
    release_connection(conn)
    return rows

# === SHIFT TRADES — dependent, scoped via shift/employee, unchanged ===

def create_shift_trade(requester_id: int, shift_id: int, offered_shift_id=None):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO shift_trades (requester_id, shift_id, offered_shift_id) VALUES (%s, %s, %s) RETURNING id;",
        (requester_id, shift_id, offered_shift_id)
    )
    trade_id = cursor.fetchone()[0]
    conn.commit()
    cursor.close()
    release_connection(conn)
    return trade_id

def get_pending_trades(manager_id: int):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT 
            shift_trades.id,
            requester.name AS requester_name,
            shift_trades.requester_id,
            shifts.id AS shift_id,
            shifts.day,
            shifts.start_time,
            shifts.end_time,
            current_employee.name AS current_employee_name,
            shift_trades.offered_shift_id,
            shift_trades.employee_status,
            shift_trades.manager_status,
            shift_trades.created_at
        FROM shift_trades
        JOIN employees AS requester ON shift_trades.requester_id = requester.id
        JOIN shifts ON shift_trades.shift_id = shifts.id
        JOIN schedule ON schedule.shift_id = shifts.id
        JOIN employees AS current_employee ON schedule.employee_id = current_employee.id
        WHERE shift_trades.employee_status != 'denied'
        AND shift_trades.manager_status != 'denied'
        AND shifts.manager_id = %s
        ORDER BY shift_trades.created_at DESC;
    """, (manager_id,))
    rows = cursor.fetchall()
    cursor.close()
    release_connection(conn)
    return rows

def update_trade_employee_status(trade_id: int, status: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE shift_trades SET employee_status = %s WHERE id = %s;",
        (status, trade_id)
    )
    conn.commit()
    cursor.close()
    release_connection(conn)

def update_trade_manager_status(trade_id: int, status: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE shift_trades SET manager_status = %s WHERE id = %s;",
        (status, trade_id)
    )
    if status == "approved":
        cursor.execute(
            "SELECT requester_id, shift_id, offered_shift_id, employee_status FROM shift_trades WHERE id = %s;",
            (trade_id,)
        )
        trade = cursor.fetchone()
        requester_id = trade[0]
        shift_id = trade[1]
        offered_shift_id = trade[2]
        employee_status = trade[3]

        if employee_status == "approved":
            cursor.execute(
                "SELECT employee_id FROM schedule WHERE shift_id = %s;",
                (shift_id,)
            )
            current_owner = cursor.fetchone()[0]
            cursor.execute(
                "UPDATE schedule SET employee_id = %s WHERE shift_id = %s;",
                (requester_id, shift_id)
            )
            if offered_shift_id is not None:
                cursor.execute(
                    "UPDATE schedule SET employee_id = %s WHERE shift_id = %s;",
                    (current_owner, offered_shift_id)
                )
    conn.commit()
    cursor.close()
    release_connection(conn)

def get_trades_for_employee(employee_id: int):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT 
        shift_trades.id,
        requester.name AS requester_name,
        shifts.day,
        shifts.start_time,
        shifts.end_time,
        shift_trades.employee_status,
        shift_trades.manager_status
    FROM shift_trades
    JOIN employees AS requester ON shift_trades.requester_id = requester.id
    JOIN shifts ON shift_trades.shift_id = shifts.id
    JOIN schedule ON schedule.shift_id = shifts.id
    WHERE schedule.employee_id = %s
    AND shift_trades.employee_status = 'pending'
    ORDER BY shift_trades.created_at DESC;
""", (employee_id,))
    rows = cursor.fetchall()
    cursor.close()
    release_connection(conn)
    return rows

def get_employee_weekly_hours(employee_id: int, start_date: str, end_date: str) -> float:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT SUM(
            EXTRACT(EPOCH FROM (shifts.end_time - shifts.start_time)) / 3600
        )
        FROM schedule
        JOIN shifts ON schedule.shift_id = shifts.id
        WHERE schedule.employee_id = %s
        AND shifts.day >= %s AND shifts.day <= %s;
    """, (employee_id, start_date, end_date))
    result = cursor.fetchone()[0]
    cursor.close()
    release_connection(conn)
    return float(result) if result else 0.0

def get_potential_substitutes(shift_id: int):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT DISTINCT employees.id, employees.name, shifts.day
        FROM employees
        JOIN shifts ON shifts.id = %s
        LEFT JOIN employee_roles ON employee_roles.employee_id = employees.id
        LEFT JOIN roles ON employee_roles.role_id = roles.id
        WHERE (shifts.role_id IS NULL OR roles.id = shifts.role_id)
        AND employees.manager_id = shifts.manager_id
        AND employees.id NOT IN (
            SELECT schedule.employee_id
            FROM schedule
            JOIN shifts AS s2 ON schedule.shift_id = s2.id
            WHERE s2.day = shifts.day
        );
    """, (shift_id,))
    candidates = cursor.fetchall()
    cursor.close()
    release_connection(conn)

    day_name = None
    result = []
    for emp_id, emp_name, shift_day in candidates:
        if day_name is None:
            day_name = shift_day.strftime('%A')
        if get_availability_for_date(emp_id, str(shift_day), day_name):
            result.append((emp_id, emp_name))

    return result

# === PASSWORD RESETS — untouched, not manager-scoped ===

def create_password_reset(employee_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO password_resets (employee_id, expires_at, status) VALUES (%s, NOW() + INTERVAL '30 minutes', 'pending') RETURNING id;",
        (employee_id,)
    )
    reset_id = cursor.fetchone()[0]
    conn.commit()
    cursor.close()
    release_connection(conn)
    return reset_id

def check_pending_reset(username):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT password_resets.id
        FROM password_resets
        JOIN users ON users.employee_id = password_resets.employee_id
        WHERE users.username = %s
        AND password_resets.status = 'pending'
        AND password_resets.expires_at > NOW()
        ORDER BY password_resets.requested_at DESC
        LIMIT 1;
    """, (username,))
    row = cursor.fetchone()
    cursor.close()
    release_connection(conn)
    return row[0] if row else None

def complete_password_reset(username, new_password_hash):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT password_resets.id, password_resets.employee_id
        FROM password_resets
        JOIN users ON users.employee_id = password_resets.employee_id
        WHERE users.username = %s
        AND password_resets.status = 'pending'
        AND password_resets.expires_at > NOW()
        ORDER BY password_resets.requested_at DESC
        LIMIT 1;
    """, (username,))
    row = cursor.fetchone()

    if not row:
        cursor.close()
        release_connection(conn)
        return False

    reset_id, employee_id = row

    cursor.execute(
        "UPDATE users SET password_hash = %s WHERE employee_id = %s;",
        (new_password_hash, employee_id)
    )
    cursor.execute(
        "UPDATE password_resets SET status = 'used' WHERE id = %s;",
        (reset_id,)
    )
    conn.commit()
    cursor.close()
    release_connection(conn)
    return True

# === SHIFT TEMPLATES ===

def create_shift_template(day_name, start_time, end_time, manager_id, role_id=None):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id FROM shift_templates
        WHERE day_name = %s AND start_time = %s AND end_time = %s
        AND active = TRUE AND manager_id = %s
        AND (role_id = %s OR (role_id IS NULL AND %s IS NULL));
    """, (day_name, start_time, end_time, manager_id, role_id, role_id))
    existing = cursor.fetchone()
    if existing:
        cursor.close()
        release_connection(conn)
        return None

    cursor.execute(
        "INSERT INTO shift_templates (day_name, start_time, end_time, role_id, manager_id) VALUES (%s, %s, %s, %s, %s) RETURNING id;",
        (day_name, start_time, end_time, role_id, manager_id)
    )
    template_id = cursor.fetchone()[0]
    conn.commit()
    cursor.close()
    release_connection(conn)
    return template_id


def generate_shifts_from_template(template_id, horizon_weeks=1):
    from datetime import datetime, timedelta

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT day_name, start_time, end_time, role_id, active, manager_id FROM shift_templates WHERE id = %s;",
        (template_id,)
    )
    template = cursor.fetchone()
    if not template or not template[4]:
        cursor.close()
        release_connection(conn)
        return []

    day_name, start_time, end_time, role_id, active, manager_id = template

    day_name_to_weekday = {
        'Monday': 0, 'Tuesday': 1, 'Wednesday': 2, 'Thursday': 3,
        'Friday': 4, 'Saturday': 5, 'Sunday': 6
    }
    target_weekday = day_name_to_weekday[day_name]

    today = datetime.utcnow().date()
    horizon_end = today + timedelta(weeks=horizon_weeks)

    dates_to_check = []
    current = today
    while current < horizon_end:
        if current.weekday() == target_weekday:
            dates_to_check.append(current)
        current += timedelta(days=1)

    cursor.execute(
        "SELECT day FROM shifts WHERE template_id = %s AND day >= %s;",
        (template_id, today)
    )
    existing_dates = {row[0] for row in cursor.fetchall()}

    cursor.execute(
        "SELECT excluded_date FROM template_exclusions WHERE template_id = %s;",
        (template_id,)
    )
    excluded_dates = {row[0] for row in cursor.fetchall()}

    created_ids = []
    for date in dates_to_check:
        if date not in existing_dates and date not in excluded_dates:
            cursor.execute(
                "INSERT INTO shifts (day, start_time, end_time, role_id, template_id, manager_id) VALUES (%s, %s, %s, %s, %s, %s) RETURNING id;",
                (date, start_time, end_time, role_id, template_id, manager_id)
            )
            created_ids.append(cursor.fetchone()[0])

    conn.commit()
    cursor.close()
    release_connection(conn)
    return created_ids

def get_all_shift_templates(manager_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT shift_templates.id, shift_templates.day_name, shift_templates.start_time,
               shift_templates.end_time, shift_templates.role_id, roles.name, shift_templates.active
        FROM shift_templates
        LEFT JOIN roles ON shift_templates.role_id = roles.id
        WHERE shift_templates.manager_id = %s
        ORDER BY shift_templates.day_name;
    """, (manager_id,))
    rows = cursor.fetchall()
    cursor.close()
    release_connection(conn)
    return rows

def signup_new_manager(manager_id):
    conn = get_connection()
    cursor = conn.cursor()

    role_ids = {}
    for role_name in ['Host', 'Server', 'Cook']:
        cursor.execute(
            "INSERT INTO roles (name, manager_id) VALUES (%s, %s) RETURNING id;",
            (role_name, manager_id)
        )
        role_ids[role_name] = cursor.fetchone()[0]

    roster = []
    for role_name, count in [('Host', 2), ('Server', 5), ('Cook', 4)]:
        cursor.execute(
            "SELECT name, role_name, starting_rating, desired_hours FROM employee_pool WHERE role_name = %s ORDER BY RANDOM() LIMIT %s;",
            (role_name, count)
        )
        roster.extend(cursor.fetchall())

    categories = ['Punctuality', 'Reliability', 'Speed', 'Customer Attitude', 'Teamwork']
    weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

    # step 1: insert all 10 employees, one at a time — we need each new id back,
    # so this part can't be batched the same way
    employee_ids = []
    employee_role_pairs = []
    for name, role_name, starting_rating, desired_hours in roster:
        cursor.execute(
            "INSERT INTO employees (name, desired_hours, manager_id) VALUES (%s, %s, %s) RETURNING id;",
            (name, desired_hours, manager_id)
        )
        employee_id = cursor.fetchone()[0]
        employee_ids.append((employee_id, role_name, starting_rating))
        employee_role_pairs.append((employee_id, role_ids[role_name]))

    # step 2: batch-insert all employee_roles in one round-trip instead of 10
    execute_values(
        cursor,
        "INSERT INTO employee_roles (employee_id, role_id) VALUES %s;",
        employee_role_pairs
    )

    # step 3: batch-insert all ratings in one round-trip instead of 50
    rating_rows = [
        (employee_id, category, starting_rating)
        for employee_id, role_name, starting_rating in employee_ids
        for category in categories
    ]
    execute_values(
        cursor,
        "INSERT INTO ratings (employee_id, category, score) VALUES %s;",
        rating_rows
    )

    # step 4: batch-insert all availability rows in one round-trip instead of 50
    availability_rows = [
        (employee_id, 'recurring', day, 'available')
        for employee_id, role_name, starting_rating in employee_ids
        for day in weekdays
    ]
    execute_values(
        cursor,
        "INSERT INTO availability (employee_id, type, day_name, status) VALUES %s;",
        availability_rows
    )

    conn.commit()
    cursor.close()
    release_connection(conn)
    return role_ids

def create_starter_shift_templates(manager_id, role_ids):
    days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    shift_defs = [
        ('09:00:00', '17:00:00', 'Host'),
        ('09:00:00', '17:00:00', 'Server'),
        ('12:00:00', '20:00:00', 'Server'),
        ('08:00:00', '16:00:00', 'Cook'),
        ('12:00:00', '20:00:00', 'Cook'),
    ]

    template_ids = []
    for day in days:
        for start_time, end_time, role_name in shift_defs:
            template_id = create_shift_template(day, start_time, end_time, manager_id, role_ids[role_name])
            if template_id:
                template_ids.append(template_id)
    return template_ids

def get_ratings_for_employees(employee_ids):
    """Fetches ratings for a whole list of employees in one round-trip instead of one per employee."""
    if not employee_ids:
        return {}
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT employee_id, category, score FROM ratings WHERE employee_id = ANY(%s);",
        (employee_ids,)
    )
    rows = cursor.fetchall()
    cursor.close()
    release_connection(conn)

    result = {emp_id: {} for emp_id in employee_ids}
    for emp_id, category, score in rows:
        result[emp_id][category] = float(score)
    return result


def get_availability_for_employees(employee_ids):
    """Fetches recurring availability days for a whole list of employees in one round-trip."""
    if not employee_ids:
        return {}
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT employee_id, day_name FROM availability WHERE employee_id = ANY(%s) AND type = 'recurring' AND status = 'available';",
        (employee_ids,)
    )
    rows = cursor.fetchall()
    cursor.close()
    release_connection(conn)

    result = {emp_id: [] for emp_id in employee_ids}
    for emp_id, day_name in rows:
        result[emp_id].append(day_name)
    return result


def get_roles_for_employees(employee_ids):
    """Fetches role names for a whole list of employees in one round-trip."""
    if not employee_ids:
        return {}
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT employee_roles.employee_id, roles.name
        FROM employee_roles
        JOIN roles ON employee_roles.role_id = roles.id
        WHERE employee_roles.employee_id = ANY(%s);
    """, (employee_ids,))
    rows = cursor.fetchall()
    cursor.close()
    release_connection(conn)

    result = {emp_id: [] for emp_id in employee_ids}
    for emp_id, role_name in rows:
        result[emp_id].append(role_name)
    return result

def delete_employee(employee_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM shift_trades WHERE requester_id = %s;", (employee_id,))
    cursor.execute("DELETE FROM schedule WHERE employee_id = %s;", (employee_id,))
    cursor.execute("DELETE FROM ratings WHERE employee_id = %s;", (employee_id,))
    cursor.execute("DELETE FROM availability WHERE employee_id = %s;", (employee_id,))
    cursor.execute("DELETE FROM employee_roles WHERE employee_id = %s;", (employee_id,))
    cursor.execute("DELETE FROM users WHERE employee_id = %s;", (employee_id,))
    cursor.execute("DELETE FROM employees WHERE id = %s;", (employee_id,))
    conn.commit()
    cursor.close()
    release_connection(conn)