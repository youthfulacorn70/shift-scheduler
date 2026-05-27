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
    cursor.execute("SELECT id, day, start_time, end_time, role_id FROM shifts;")
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
        SELECT schedule.id, employees.name, shifts.day, shifts.start_time, shifts.end_time
        FROM schedule
        JOIN employees ON schedule.employee_id = employees.id
        JOIN shifts ON schedule.shift_id = shifts.id;
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