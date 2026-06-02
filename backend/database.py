import psycopg2

def get_connection():
    conn = psycopg2.connect(
        dbname="shift_schedule",
        user="mattdou",
        password="",
        host="localhost",
        port="5432"
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
        SELECT shifts.id, shifts.day, shifts.start_time, shifts.end_time, shifts.role_id, roles.name
        FROM shifts
        LEFT JOIN roles ON shifts.role_id = roles.id;
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

def clear_schedule():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM schedule;")
    conn.commit()
    cursor.close()
    conn.close()

def add_availability(employee_id, day):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO availability (employee_id, day) VALUES (%s, %s);",
        (employee_id, day)
    )
    conn.commit()
    cursor.close()
    conn.close()

def get_availability(employee_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT day FROM availability WHERE employee_id = %s;",
        (employee_id,)
    )
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return [row[0] for row in rows]

def delete_availability(employee_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "DELETE FROM availability WHERE employee_id = %s;",
        (employee_id,)
    )
    conn.commit()
    cursor.close()
    conn.close()

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
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT DISTINCT employees.id, employees.name
        FROM employees
        JOIN employee_roles ON employee_roles.employee_id = employees.id
        JOIN roles ON employee_roles.role_id = roles.id
        JOIN shifts ON roles.id = shifts.role_id
        JOIN availability ON availability.employee_id = employees.id
        WHERE shifts.id = %s
        AND availability.day = INITCAP(LOWER(TRIM(TO_CHAR(shifts.day, 'Day'))))
        AND employees.id NOT IN (
            SELECT schedule.employee_id
            FROM schedule
            JOIN shifts AS s2 ON schedule.shift_id = s2.id
            WHERE s2.day = shifts.day
        )
        ORDER BY employees.name;
    """, (shift_id,))
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return rows

def manually_assign_shift(shift_id: int, employee_id: int):
    conn = get_connection()
    cursor = conn.cursor()
    # remove any existing assignment for this shift first
    cursor.execute("DELETE FROM schedule WHERE shift_id = %s;", (shift_id,))
    # insert the new assignment
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
    # count how many employees have this role
    cursor.execute(
        "SELECT COUNT(*) FROM employee_roles WHERE role_id = %s;",
        (role_id,)
    )
    employee_count = cursor.fetchone()[0]
    # count how many shifts require this role
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
    # remove role from all employees first
    cursor.execute("DELETE FROM employee_roles WHERE role_id = %s;", (role_id,))
    # remove role from all shifts
    cursor.execute("UPDATE shifts SET role_id = NULL WHERE role_id = %s;", (role_id,))
    # delete the role itself
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