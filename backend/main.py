from fastapi import FastAPI
from models import Employee, Shift, calculate_overall_rating
from algorithm import generate_schedule
from database import add_employee, get_all_employees, add_shift, get_all_shifts, add_rating, get_ratings_by_employee, save_schedule, get_schedule, clear_schedule, clear_schedule_for_week, week_has_schedule, add_availability, get_availability, delete_availability, add_role, get_all_roles, assign_role_to_employee, get_employee_roles, remove_employee_role, update_shift, delete_shift, create_user, get_user_by_username, get_user_by_employee_id, get_schedule_by_employee
import bcrypt
from jose import jwt
from datetime import datetime, timedelta
from fastapi.middleware.cors import CORSMiddleware

SECRET_KEY = "your-secret-key-change-this-later"
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Auth helpers ---

def hash_password(password: str) -> str:
    # bcrypt requires bytes, so we encode the string first
    # the result is also bytes so we decode it back to a string for storage
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    # check if the typed password matches the stored hash
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(data: dict) -> str:
    payload = data.copy()
    # set expiry time — current time + 24 hours
    expire = datetime.utcnow() + timedelta(hours=TOKEN_EXPIRE_HOURS)
    payload["exp"] = expire
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> dict:
    # decodes and verifies the token, returns the payload
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

# --- Auth endpoints ---

@app.post("/auth/login")
async def login(data: dict):
    username = data["username"]
    password = data["password"]

    # look up the user
    user = get_user_by_username(username)
    if not user:
        return {"error": "Invalid username or password"}

    # user row: (id, username, password_hash, role, employee_id)
    if not verify_password(password, user[2]):
        return {"error": "Invalid username or password"}

    # create a token with their username and role baked in
    token = create_token({"sub": user[1], "role": user[3], "employee_id": user[4]})
    return {"token": token, "role": user[3], "username": user[1]}

@app.post("/auth/create-user")
async def create_user_account(data: dict):
    username = data["username"]
    password = data["password"]
    role = data["role"]
    employee_id = data.get("employee_id", None)

    # check if username already exists
    existing = get_user_by_username(username)
    if existing:
        return {"error": "Username already taken"}

    hashed = hash_password(password)
    user_id = create_user(username, hashed, role, employee_id)
    return {"id": user_id, "username": username, "role": role}

@app.get("/schedule/employee/{employee_id}")
async def get_employee_schedule(employee_id: int):
    rows = get_schedule_by_employee(employee_id)
    schedule = []
    for row in rows:
        schedule.append({
            "id": row[0],
            "employee": row[1],
            "day": str(row[2]),
            "start_time": str(row[3]),
            "end_time": str(row[4])
        })
    return schedule

@app.post("/employees")
async def create_employee(data: dict):
    employee_id = add_employee(data["name"], data["desired_hours"])
    return {"id": employee_id, "name": data["name"], "desired_hours": data["desired_hours"]}

@app.get("/employees")
async def list_employees():
    rows = get_all_employees()
    employees = []
    for row in rows:
        employees.append({
            "id": row[0],
            "name": row[1],
            "desired_hours": row[2]
        })
    return employees

@app.post("/shifts")
async def create_shift(data: dict):
    role_id = data.get("role_id", None)
    shift_id = add_shift(data["day"], data["start_time"], data["end_time"], role_id)
    return {"id": shift_id, "day": data["day"], "start_time": data["start_time"], "end_time": data["end_time"], "role_id": role_id}

@app.get("/shifts")
async def list_shifts():
    rows = get_all_shifts()
    shifts = []
    for row in rows:
        shifts.append({
            "id": row[0],
            "day": str(row[1]),
            "start_time": str(row[2]),
            "end_time": str(row[3]),
            "role_id": row[4]
        })
    return shifts

@app.get("/ratings/{employee_id}")
async def list_ratings(employee_id: int):
    rows = get_ratings_by_employee(employee_id)
    ratings = []
    for row in rows:
        ratings.append({
            "id": row[0],
            "category": row[1],
            "score": float(row[2])
        })
    return ratings

@app.post("/ratings")
async def create_rating(data: dict):
    rating_id = add_rating(data["employee_id"], data["category"], data["score"])
    return {"id": rating_id, "employee_id": data["employee_id"], "category": data["category"], "score": data["score"]}

@app.post("/schedule")
async def create_schedule(data: dict):
    start_date = data["start_date"]  # e.g. "2026-05-25"
    end_date = data["end_date"]      # e.g. "2026-05-31"

    # Get employees from database
    emp_rows = get_all_employees()

    employees = []
    for row in emp_rows:
        emp_id = row[0]
        emp_name = row[1]
        emp_desired_hours = row[2]

        rating_rows = get_ratings_by_employee(emp_id)
        ratings = {}
        for r in rating_rows:
            ratings[r[1]] = float(r[2])

        overall_rating = calculate_overall_rating(ratings)
        available_days = get_availability(emp_id)
        role_rows = get_employee_roles(emp_id)
        emp_roles = [row[1] for row in role_rows]
        emp = Employee(
            name=emp_name,
            rating=overall_rating,
            available_days=available_days,
            desired_hours=emp_desired_hours,
            roles=emp_roles
        )
        employees.append(emp)

    # Get only shifts within the selected week
    shift_rows = get_all_shifts()
    shifts = []
    for row in shift_rows:
        shift_date = str(row[1])
        if start_date <= shift_date <= end_date:  # only include shifts in this week
            shift = Shift(
                day=shift_date,
                start_time=str(row[2]),
                end_time=str(row[3]),
                required_role=str(row[4]) if row[4] else None,
                shift_id=row[0]
            )
            shifts.append(shift)

    completed_schedule = generate_schedule(employees, shifts)

    result = []
    for shift in completed_schedule:
        result.append({
            "day": shift.day,
            "start_time": shift.start_time,
            "end_time": shift.end_time,
            "employee": shift.employee_name
        })

    # Only clear and save this week's schedule
    clear_schedule_for_week(start_date, end_date)
    for shift in completed_schedule:
        if shift.employee_name:
            emp_id = next((row[0] for row in emp_rows if row[1] == shift.employee_name), None)
            if emp_id and shift.shift_id:
                save_schedule(shift.shift_id, emp_id)

    return result

@app.get("/schedule/check")
async def check_schedule(start_date: str, end_date: str):
    has_schedule = week_has_schedule(start_date, end_date)
    return {"has_schedule": has_schedule}

@app.get("/schedule")
async def list_schedule():
    rows = get_schedule()
    schedule = []
    for row in rows:
        schedule.append({
            "id": row[0],
            "employee": row[1],
            "day": str(row[2]),
            "start_time": str(row[3]),
            "end_time": str(row[4])
        })
    return schedule

@app.post("/availability")
async def set_availability(data: dict):
    delete_availability(data["employee_id"])
    for day in data["days"]:
        add_availability(data["employee_id"], day)
    return {"message": "Availability updated"}

@app.get("/availability/{employee_id}")
async def get_employee_availability(employee_id: int):
    days = get_availability(employee_id)
    return {"days": days}

@app.post("/roles")
async def create_role(data: dict):
    role_id = add_role(data["name"])
    return {"id": role_id, "name": data["name"]}

@app.get("/roles")
async def list_roles():
    rows = get_all_roles()
    return [{"id": row[0], "name": row[1]} for row in rows]

@app.post("/employee-roles")
async def assign_role(data: dict):
    assign_role_to_employee(data["employee_id"], data["role_id"])
    return {"message": "Role assigned"}

@app.delete("/employee-roles")
async def remove_role(data: dict):
    remove_employee_role(data["employee_id"], data["role_id"])
    return {"message": "Role removed"}

@app.get("/employee-roles/{employee_id}")
async def get_roles(employee_id: int):
    rows = get_employee_roles(employee_id)
    return [{"id": row[0], "name": row[1]} for row in rows]

@app.put("/shifts/{shift_id}")
async def edit_shift(shift_id: int, data: dict):
    update_shift(shift_id, data["day"], data["start_time"], data["end_time"], data.get("role_id", None))
    return {"message": "Shift updated"}

@app.delete("/shifts/{shift_id}")
async def remove_shift(shift_id: int):
    delete_shift(shift_id)
    return {"message": "Shift deleted"}

@app.get("/auth/user-by-employee/{employee_id}")
async def check_user_by_employee(employee_id: int):
    user = get_user_by_employee_id(employee_id)
    return {"exists": user is not None}