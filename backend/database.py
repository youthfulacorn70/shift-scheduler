import psycopg2
import os

def get_connection():
    conn = psycopg2.connect(
        dbname=os.getenv("PGDATABASE", "shift_schedule"),
        user=os.getenv("PGUSER", "mattdou"),
        password=os.getenv("PGPASSWORD", ""),
        host=os.getenv("PGHOST", "localhost"),
        port=os.getenv("PGPORT", "5432")
    )
    return conn

def add_employee(name, desired_hours):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO employees (name, desired_hours) VALUES (%s, %s) RETURNING id;",
        (name, desired_hours)
    )
    employee_id = cursor.fetchone()[0]
    conn.commit()
    cursor.close()
    conn.close()
    return employee_id

def get_all_employees():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, desired_hours FROM employees;")
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return rows

def get_employee_usage(employee_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT COUNT(*) FROM schedule WHERE employee_id = %s;",
        (employee_id,)
    )
    shift_count = cursor.fetchone()[0]
    cursor.execute(
        "SELECT COUNT(*) FROM users WHERE employee_id = %s;",
        (employee_id,)
    )
    has_login = cursor.fetchone()[0] > 0
    cursor.close()
    conn.close()
    return {"shift_count": shift_count, "has_login": has_login}

def delete_employee(employee_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM schedule WHERE employee_id = %s;", (employee_id,))
    cursor.execute("DELETE FROM ratings WHERE employee_id = %s;", (employee_id,))
    cursor.execute("DELETE FROM availability WHERE employee_id = %s;", (employee_id,))
    cursor.execute("DELETE FROM employee_roles WHERE employee_id = %s;", (employee_id,))
    cursor.execute("DELETE FROM users WHERE employee_id = %s;", (employee_id,))
    cursor.execute("DELETE FROM employees WHERE id = %s;", (employee_id,))
    conn.commit()
    cursor.close()
    conn.close()

def add_shift(day, start_time, end_time, role_id=None):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO shifts (day, start_time, end_time, role_id) VALUES (%s, %s, %s, %s) RETURNING id;",
        (day, start_time, end_time, role_id)
    )
    shift_id = cursor.fetchone()[0]
    conn.commit()
    cursor.close()
    conn.close()
    return shift_id

def get_all_shifts():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT shifts.id, shifts.day, shifts.start_time, shifts.end_time, shifts.role_id, roles.name, shifts.template_id
        FROM shifts
        LEFT JOIN roles ON shifts.role_id = roles.id
        ORDER BY shifts.day, shifts.start_time;
    """)
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return rows

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
    conn.close()
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
    conn.close()
    return rows

def save_schedule(shift_id, employee_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO schedule (shift_id, employee_id) VALUES (%s, %s) RETURNING id;",
        (shift_id, employee_id)
    )
    schedule_id = cursor.fetchone()[0]
    conn.commit()
    cursor.close()
    conn.close()
    return schedule_id

def get_schedule():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT schedule.id, employees.name, shifts.day, shifts.start_time, shifts.end_time, roles.name, shifts.id
        FROM schedule
        JOIN employees ON schedule.employee_id = employees.id
        JOIN shifts ON schedule.shift_id = shifts.id
        LEFT JOIN roles ON shifts.role_id = roles.id;
    """)
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return rows

def get_day_overview(date_str: str):
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
        WHERE shifts.day = %s
        ORDER BY shifts.start_time;
    """, (date_str,))
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

    cursor.execute("SELECT id, name FROM employees ORDER BY name;")
    all_employees = cursor.fetchall()

    cursor.close()
    conn.close()

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
        conn2.close()

        available_employees.append({
            "id": emp_id,
            "name": emp_name,
            "roles": emp_roles,
            "available": is_available
        })

    return {"shifts": shifts, "available_employees": available_employees}

def clear_schedule():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM schedule;")
    conn.commit()
    cursor.close()
    conn.close()

# === AVAILABILITY — rewritten for recurring + specific-date support ===

def add_recurring_availability(employee_id, day_name, status='available'):
    """Adds or updates a recurring availability rule for a day of the week."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO availability (employee_id, type, day_name, status) VALUES (%s, 'recurring', %s, %s);",
        (employee_id, day_name, status)
    )
    conn.commit()
    cursor.close()
    conn.close()

def add_specific_availability(employee_id, specific_date, status):
    """Adds a one-off override for a specific date, e.g. unavailable this one Monday."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO availability (employee_id, type, specific_date, status) VALUES (%s, 'specific', %s, %s) RETURNING id;",
        (employee_id, specific_date, status)
    )
    new_id = cursor.fetchone()[0]
    conn.commit()
    cursor.close()
    conn.close()
    return new_id

def get_availability(employee_id):
    """Returns both recurring days and specific overrides for an employee, separated out."""
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
    conn.close()
    return {"recurring_days": recurring_days, "specific_overrides": specific_overrides}

def delete_availability(employee_id):
    """Wipes ALL recurring rules for an employee — used when saving a fresh set of checkboxes."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "DELETE FROM availability WHERE employee_id = %s AND type = 'recurring';",
        (employee_id,)
    )
    conn.commit()
    cursor.close()
    conn.close()

def delete_specific_availability(override_id):
    """Removes a single specific-date override by its id."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "DELETE FROM availability WHERE id = %s AND type = 'specific';",
        (override_id,)
    )
    conn.commit()
    cursor.close()
    conn.close()

def get_availability_for_date(employee_id, date_str, day_name):
    """
    Used by the scheduling algorithm. Checks for a specific override on this exact date first —
    if found, that wins. Otherwise falls back to the recurring rule for this day of the week.
    Returns True if available, False if not.
    """
    conn = get_connection()
    cursor = conn.cursor()

    # specific override always wins if it exists
    cursor.execute(
        "SELECT status FROM availability WHERE employee_id = %s AND type = 'specific' AND specific_date = %s;",
        (employee_id, date_str)
    )
    specific = cursor.fetchone()
    if specific:
        cursor.close()
        conn.close()
        return specific[0] == 'available'

    # fall back to recurring rule
    cursor.execute(
        "SELECT status FROM availability WHERE employee_id = %s AND type = 'recurring' AND day_name = %s;",
        (employee_id, day_name)
    )
    recurring = cursor.fetchone()
    cursor.close()
    conn.close()
    if recurring:
        return recurring[0] == 'available'
    return False  # no rule at all means unavailable by default

def get_schedule_conflicts():
    """
    Returns a set of schedule entry IDs where the assigned employee
    is marked unavailable for that shift's date.
    Used to badge conflicts on the Schedule calendar.
    """
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT schedule.id, schedule.employee_id, shifts.day
        FROM schedule
        JOIN shifts ON schedule.shift_id = shifts.id;
    """)
    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    conflict_ids = set()
    for schedule_id, employee_id, day in rows:
        day_name = day.strftime('%A')
        if not get_availability_for_date(employee_id, day, day_name):
            conflict_ids.add(schedule_id)

    return conflict_ids

def add_role(name):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO roles (name) VALUES (%s) RETURNING id;",
        (name,)
    )
    role_id = cursor.fetchone()[0]
    conn.commit()
    cursor.close()
    conn.close()
    return role_id

def get_all_roles():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name FROM roles;")
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return rows

def assign_role_to_employee(employee_id, role_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO employee_roles (employee_id, role_id) VALUES (%s, %s);",
        (employee_id, role_id)
    )
    conn.commit()
    cursor.close()
    conn.close()

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
    conn.close()
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
    conn.close()

def update_shift(shift_id, day, start_time, end_time, role_id=None):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE shifts SET day = %s, start_time = %s, end_time = %s, role_id = %s WHERE id = %s;",
        (day, start_time, end_time, role_id, shift_id)
    )
    conn.commit()
    cursor.close()
    conn.close()

def delete_shift(shift_id):
    conn = get_connection()
    cursor = conn.cursor()

    # check if this shift came from a template — if so, record it as excluded
    # so it doesn't get regenerated
    cursor.execute("SELECT day, template_id FROM shifts WHERE id = %s;", (shift_id,))
    row = cursor.fetchone()
    if row and row[1] is not None:
        day, template_id = row
        cursor.execute(
            "INSERT INTO template_exclusions (template_id, excluded_date) VALUES (%s, %s) ON CONFLICT DO NOTHING;",
            (template_id, day)
        )

    cursor.execute("DELETE FROM schedule WHERE shift_id = %s;", (shift_id,))
    cursor.execute("DELETE FROM shifts WHERE id = %s;", (shift_id,))
    conn.commit()
    cursor.close()
    conn.close()

def clear_schedule_for_week(start_date: str, end_date: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        DELETE FROM schedule
        WHERE shift_id IN (
            SELECT id FROM shifts
            WHERE day >= %s AND day <= %s
        );
    """, (start_date, end_date))
    conn.commit()
    cursor.close()
    conn.close()

def week_has_schedule(start_date: str, end_date: str) -> bool:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT COUNT(*) FROM schedule
        JOIN shifts ON schedule.shift_id = shifts.id
        WHERE shifts.day >= %s AND shifts.day <= %s;
    """, (start_date, end_date))
    count = cursor.fetchone()[0]
    cursor.close()
    conn.close()
    return count > 0

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
    conn.close()
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
    conn.close()

def get_user_by_username(username):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, username, password_hash, role, employee_id FROM users WHERE username = %s;",
        (username,)
    )
    row = cursor.fetchone()
    cursor.close()
    conn.close()
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
    conn.close()
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
    conn.close()
    return rows

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
    conn.close()
    return trade_id

def get_pending_trades():
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
        ORDER BY shift_trades.created_at DESC;
    """)
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
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
    conn.close()

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
    conn.close()

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
    conn.close()
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
    conn.close()
    return float(result) if result else 0.0

def get_unassigned_shifts(start_date: str, end_date: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT shifts.id, shifts.day, shifts.start_time, shifts.end_time, roles.name
        FROM shifts
        LEFT JOIN roles ON shifts.role_id = roles.id
        LEFT JOIN schedule ON schedule.shift_id = shifts.id
        WHERE schedule.shift_id IS NULL
        AND shifts.day >= %s AND shifts.day <= %s;
    """, (start_date, end_date))
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return rows

def get_potential_substitutes(shift_id: int):
    """
    Updated to use get_availability_for_date logic inline via SQL —
    checks specific override first, falls back to recurring.
    """
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT DISTINCT employees.id, employees.name, shifts.day
        FROM employees
        JOIN shifts ON shifts.id = %s
        LEFT JOIN employee_roles ON employee_roles.employee_id = employees.id
        LEFT JOIN roles ON employee_roles.role_id = roles.id
        WHERE (shifts.role_id IS NULL OR roles.id = shifts.role_id)
        AND employees.id NOT IN (
            SELECT schedule.employee_id
            FROM schedule
            JOIN shifts AS s2 ON schedule.shift_id = s2.id
            WHERE s2.day = shifts.day
        );
    """, (shift_id,))
    candidates = cursor.fetchall()
    cursor.close()
    conn.close()

    # filter candidates down to only those actually available on that date
    day_name = None
    result = []
    for emp_id, emp_name, shift_day in candidates:
        if day_name is None:
            day_name = shift_day.strftime('%A')  # e.g. "Monday"
        if get_availability_for_date(emp_id, str(shift_day), day_name):
            result.append((emp_id, emp_name))

    return result

def manually_assign_shift(shift_id: int, employee_id: int):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM schedule WHERE shift_id = %s;", (shift_id,))
    cursor.execute(
        "INSERT INTO schedule (shift_id, employee_id) VALUES (%s, %s) RETURNING id;",
        (shift_id, employee_id)
    )
    schedule_id = cursor.fetchone()[0]
    conn.commit()
    cursor.close()
    conn.close()
    return schedule_id

def remove_schedule_entry(schedule_id: int):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM schedule WHERE id = %s;", (schedule_id,))
    conn.commit()
    cursor.close()
    conn.close()

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
    conn.close()
    return {"employee_count": employee_count, "shift_count": shift_count}

def delete_role(role_id: int):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM employee_roles WHERE role_id = %s;", (role_id,))
    cursor.execute("UPDATE shifts SET role_id = NULL WHERE role_id = %s;", (role_id,))
    cursor.execute("DELETE FROM roles WHERE id = %s;", (role_id,))
    conn.commit()
    cursor.close()
    conn.close()

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
    conn.close()
    return row[0] if row else None

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
    conn.close()
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
    conn.close()
    return row[0] if row else None

def complete_password_reset(username, new_password_hash):
    conn = get_connection()
    cursor = conn.cursor()

    # re-check eligibility server-side, never trust the earlier check alone
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
        conn.close()
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
    conn.close()
    return True

def create_shift_template(day_name, start_time, end_time, role_id=None):
    conn = get_connection()
    cursor = conn.cursor()

    # prevent creating an identical recurring shift twice
    cursor.execute("""
        SELECT id FROM shift_templates
        WHERE day_name = %s AND start_time = %s AND end_time = %s
        AND active = TRUE
        AND (role_id = %s OR (role_id IS NULL AND %s IS NULL));
    """, (day_name, start_time, end_time, role_id, role_id))
    existing = cursor.fetchone()
    if existing:
        cursor.close()
        conn.close()
        return None  # signal duplicate — caller decides what to do

    cursor.execute(
        "INSERT INTO shift_templates (day_name, start_time, end_time, role_id) VALUES (%s, %s, %s, %s) RETURNING id;",
        (day_name, start_time, end_time, role_id)
    )
    template_id = cursor.fetchone()[0]
    conn.commit()
    cursor.close()
    conn.close()
    return template_id


def generate_shifts_from_template(template_id, horizon_weeks=1):
    """
    Ensures shifts exist for this template out to `horizon_weeks` from today.
    Only creates shifts for dates that don't already have one from this template
    (so calling this repeatedly is always safe — it just fills in gaps).
    """
    from datetime import datetime, timedelta

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT day_name, start_time, end_time, role_id, active FROM shift_templates WHERE id = %s;",
        (template_id,)
    )
    template = cursor.fetchone()
    if not template or not template[4]:  # doesn't exist or inactive
        cursor.close()
        conn.close()
        return []

    day_name, start_time, end_time, role_id, active = template

    day_name_to_weekday = {
        'Monday': 0, 'Tuesday': 1, 'Wednesday': 2, 'Thursday': 3,
        'Friday': 4, 'Saturday': 5, 'Sunday': 6
    }
    target_weekday = day_name_to_weekday[day_name]

    today = datetime.utcnow().date()
    horizon_end = today + timedelta(weeks=horizon_weeks)

    # find all dates matching this day_name between today and horizon_end
    dates_to_check = []
    current = today
    while current <= horizon_end:
        if current.weekday() == target_weekday:
            dates_to_check.append(current)
        current += timedelta(days=1)

    # find which of these dates already have a shift from this template
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
                "INSERT INTO shifts (day, start_time, end_time, role_id, template_id) VALUES (%s, %s, %s, %s, %s) RETURNING id;",
                (date, start_time, end_time, role_id, template_id)
            )
            created_ids.append(cursor.fetchone()[0])

    conn.commit()
    cursor.close()
    conn.close()
    return created_ids

def get_all_shift_templates():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT shift_templates.id, shift_templates.day_name, shift_templates.start_time,
               shift_templates.end_time, shift_templates.role_id, roles.name, shift_templates.active
        FROM shift_templates
        LEFT JOIN roles ON shift_templates.role_id = roles.id
        ORDER BY shift_templates.day_name;
    """)
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return rows

