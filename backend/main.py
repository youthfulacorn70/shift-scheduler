from fastapi import FastAPI, Request, HTTPException
from models import Employee, Shift, calculate_overall_rating
from algorithm import generate_schedule
from database import add_employee, get_all_employees, add_shift, get_all_shifts, add_rating, get_ratings_by_employee, save_schedule, get_schedule, clear_schedule, clear_schedule_for_week, week_has_schedule, add_recurring_availability, add_specific_availability, get_availability, delete_availability, delete_specific_availability, get_availability_for_date, add_role, get_all_roles, assign_role_to_employee, get_employee_roles, remove_employee_role, update_shift, delete_shift, create_user, get_user_by_username, get_user_by_employee_id, get_schedule_by_employee, create_shift_trade, get_pending_trades, update_trade_employee_status, update_trade_manager_status, get_trades_for_employee, get_employee_weekly_hours, get_unassigned_shifts, get_potential_substitutes, manually_assign_shift, remove_schedule_entry, get_role_usage, delete_role, get_shift_assignment, get_employee_usage, delete_employee, reset_user_password, get_day_overview, complete_password_reset, check_pending_reset, create_password_reset, create_shift_template, generate_shifts_from_template, get_all_shift_templates, get_schedule_conflicts, signup_new_manager, create_starter_shift_templates, get_ratings_for_employees, get_availability_for_employees, get_roles_for_employees
import bcrypt
from jose import jwt
from datetime import datetime, timedelta
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from pydantic import BaseModel, Field

class LoginRequest(BaseModel):
    username: str = Field(..., max_length=20)
    password: str = Field(..., max_length=50)

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24


app = FastAPI()
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# main.py — replace the CORSMiddleware block
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://shift-scheduler-lyart.vercel.app"],
    allow_origin_regex=r"http://localhost:\d+",
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Auth helpers ---

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def ensure_templates_generated(manager_id: int):
    templates = get_all_shift_templates(manager_id)
    for t in templates:
        if t[6]:  # active
            generate_shifts_from_template(t[0])

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(data: dict) -> str:
    payload = data.copy()
    expire = datetime.utcnow() + timedelta(hours=TOKEN_EXPIRE_HOURS)
    payload["exp"] = expire
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> dict:
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

def get_manager_id_from_request(request: Request) -> int:
    """
    Pulls the caller's user id out of their JWT — this IS their manager_id,
    since a manager's own users.id is what every owned row gets tagged with.
    Never trust manager_id from a request body — only from a verified token.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid auth token")
    token = auth_header.split(" ")[1]
    try:
        payload = decode_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return payload["id"]

# --- Auth endpoints ---

@app.post("/auth/login")
@limiter.limit("5/minute")
@app.post("/auth/login")
@limiter.limit("5/minute")

async def login(request: Request, data: LoginRequest):
    username = data.username.lower()
    password = data.password

    user = get_user_by_username(username)
    if not user:
        return {"error": "Invalid username or password"}

    if not verify_password(password, user[2]):
        return {"error": "Invalid username or password"}

    token = create_token({"sub": user[1], "role": user[3], "employee_id": user[4], "id": user[0]})
    return {"token": token, "role": user[3], "username": user[1]}

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
async def create_employee(request: Request, data: dict):
    manager_id = get_manager_id_from_request(request)
    employee_id = add_employee(data["name"], data["desired_hours"], manager_id)
    return {"id": employee_id, "name": data["name"], "desired_hours": data["desired_hours"]}

@app.get("/employees")
async def list_employees(request: Request):
    manager_id = get_manager_id_from_request(request)
    rows = get_all_employees(manager_id)
    employees = []
    for row in rows:
        employees.append({
            "id": row[0],
            "name": row[1],
            "desired_hours": row[2]
        })
    return employees

@app.get("/employees/{employee_id}/usage")
async def employee_usage(employee_id: int, request: Request):
    manager_id = get_manager_id_from_request(request)
    return get_employee_usage(employee_id, manager_id)

@app.delete("/employees/{employee_id}")
async def remove_employee(employee_id: int, request: Request):
    manager_id = get_manager_id_from_request(request)
    delete_employee(employee_id, manager_id)
    return {"message": "Employee deleted"}

@app.post("/shifts")
async def create_shift(request: Request, data: dict):
    manager_id = get_manager_id_from_request(request)
    role_id = data.get("role_id", None)
    shift_id = add_shift(data["day"], data["start_time"], data["end_time"], manager_id, role_id)
    role_name = None
    if role_id:
        roles = get_all_roles(manager_id)
        role = next((r for r in roles if r[0] == role_id), None)
        if role:
            role_name = role[1]
    return {"id": shift_id, "day": data["day"], "start_time": data["start_time"], "end_time": data["end_time"], "role_id": role_id, "role_name": role_name}

@app.get("/shifts")
async def list_shifts(request: Request):
    manager_id = get_manager_id_from_request(request)
    ensure_templates_generated(manager_id)

    rows = get_all_shifts(manager_id)
    shifts = []
    for row in rows:
        shifts.append({
            "id": row[0],
            "day": str(row[1]),
            "start_time": str(row[2]),
            "end_time": str(row[3]),
            "role_id": row[4],
            "role_name": row[5],
            "template_id": row[6]
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
async def create_schedule(request: Request, data: dict):
    manager_id = get_manager_id_from_request(request)
    start_date = data["start_date"]
    end_date = data["end_date"]

    emp_rows = get_all_employees(manager_id)
    employee_ids = [row[0] for row in emp_rows]

    # one query each, instead of one query per employee per category
    ratings_by_employee = get_ratings_for_employees(employee_ids)
    availability_by_employee = get_availability_for_employees(employee_ids)
    roles_by_employee = get_roles_for_employees(employee_ids)

    employees = []
    for row in emp_rows:
        emp_id = row[0]
        emp_name = row[1]
        emp_desired_hours = row[2]

        ratings = ratings_by_employee.get(emp_id, {})
        overall_rating = calculate_overall_rating(ratings)
        available_days = availability_by_employee.get(emp_id, [])
        emp_roles = roles_by_employee.get(emp_id, [])

        emp = Employee(
            employee_id=emp_id,
            name=emp_name,
            rating=overall_rating,
            available_days=available_days,
            desired_hours=emp_desired_hours,
            roles=emp_roles
        )
        employees.append(emp)

    shift_rows = get_all_shifts(manager_id)
    shifts = []
    for row in shift_rows:
        shift_date = str(row[1])
        if start_date <= shift_date <= end_date:
            shift = Shift(
                day=shift_date,
                start_time=str(row[2]),
                end_time=str(row[3]),
                required_role=str(row[5]) if row[5] else None,
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

    clear_schedule_for_week(start_date, end_date, manager_id)
    for shift in completed_schedule:
        if shift.employee_name:
            emp_id = next((row[0] for row in emp_rows if row[1] == shift.employee_name), None)
            if emp_id and shift.shift_id:
                save_schedule(shift.shift_id, emp_id, manager_id)

    return result

@app.get("/schedule/check")
async def check_schedule(request: Request, start_date: str, end_date: str):
    manager_id = get_manager_id_from_request(request)
    has_schedule = week_has_schedule(start_date, end_date, manager_id)
    return {"has_schedule": has_schedule}

@app.get("/schedule")
async def list_schedule(request: Request):
    manager_id = get_manager_id_from_request(request)
    ensure_templates_generated(manager_id)
    rows = get_schedule(manager_id)
    schedule = []
    for row in rows:
        schedule.append({
            "id": row[0],
            "employee": row[1],
            "day": str(row[2]),
            "start_time": str(row[3]),
            "end_time": str(row[4]),
            "role": row[5],
            "shift_id": row[6]
        })
    return schedule

# === AVAILABILITY ENDPOINTS — unchanged, dependent table, scoped via employee_id ===

@app.post("/availability")
async def set_availability(data: dict):
    delete_availability(data["employee_id"])
    for day in data["days"]:
        add_recurring_availability(data["employee_id"], day, status='available')
    return {"message": "Availability updated"}

@app.get("/availability/{employee_id}")
async def get_employee_availability(employee_id: int):
    data = get_availability(employee_id)
    return {"days": data["recurring_days"], "specific_overrides": data["specific_overrides"]}

@app.post("/availability/specific")
async def add_specific_override(data: dict):
    employee_id = data["employee_id"]
    date_str = data["date"]
    status = data["status"]

    target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    today = datetime.utcnow().date()

    days_until_monday = (7 - today.weekday()) % 7
    days_until_monday = days_until_monday if days_until_monday != 0 else 7
    earliest_allowed = today + timedelta(days=days_until_monday)
    latest_allowed = earliest_allowed + timedelta(weeks=4)

    if target_date < earliest_allowed:
        return {"error": "Availability changes must be made for next week or later."}
    if target_date > latest_allowed:
        return {"error": "Availability changes can only be made up to 4 weeks in advance."}

    new_id = add_specific_availability(employee_id, date_str, status)
    return {"id": new_id, "date": date_str, "status": status}

@app.delete("/availability/specific/{override_id}")
async def remove_specific_override(override_id: int):
    delete_specific_availability(override_id)
    return {"message": "Override removed"}

@app.post("/roles")
async def create_role(request: Request, data: dict):
    manager_id = get_manager_id_from_request(request)
    role_id = add_role(data["name"], manager_id)
    return {"id": role_id, "name": data["name"]}

@app.get("/roles")
async def list_roles(request: Request):
    manager_id = get_manager_id_from_request(request)
    rows = get_all_roles(manager_id)
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
async def edit_shift(shift_id: int, request: Request, data: dict):
    manager_id = get_manager_id_from_request(request)
    update_shift(shift_id, data["day"], data["start_time"], data["end_time"], manager_id, data.get("role_id", None))
    return {"message": "Shift updated"}

@app.delete("/shifts/{shift_id}")
async def remove_shift(shift_id: int, request: Request):
    manager_id = get_manager_id_from_request(request)
    delete_shift(shift_id, manager_id)
    return {"message": "Shift deleted"}

@app.get("/auth/user-by-employee/{employee_id}")
async def check_user_by_employee(employee_id: int):
    user = get_user_by_employee_id(employee_id)
    return {"exists": user is not None}

@app.post("/trades")
async def request_trade(data: dict):
    skip_employee = data.get("skip_employee_approval", False)
    trade_id = create_shift_trade(
        data["requester_id"],
        data["shift_id"],
        data.get("offered_shift_id", None)
    )
    if skip_employee:
        update_trade_employee_status(trade_id, 'approved')
    return {"id": trade_id, "status": "pending"}

@app.get("/trades")
async def list_trades(request: Request):
    manager_id = get_manager_id_from_request(request)
    rows = get_pending_trades(manager_id)
    trades = []
    for row in rows:
        trades.append({
            "id": row[0],
            "requester_name": row[1],
            "requester_id": row[2],
            "shift_id": row[3],
            "day": str(row[4]),
            "start_time": str(row[5]),
            "end_time": str(row[6]),
            "current_employee_name": row[7],
            "offered_shift_id": row[8],
            "employee_status": row[9],
            "manager_status": row[10]
        })
    return trades

@app.put("/trades/{trade_id}/employee")
async def respond_trade_employee(trade_id: int, data: dict):
    update_trade_employee_status(trade_id, data["status"])
    return {"message": "Trade updated"}

@app.put("/trades/{trade_id}/manager")
async def respond_trade_manager(trade_id: int, data: dict):
    update_trade_manager_status(trade_id, data["status"])
    return {"message": "Trade updated"}

@app.get("/trades/employee/{employee_id}")
async def list_trades_for_employee(employee_id: int):
    rows = get_trades_for_employee(employee_id)
    trades = []
    for row in rows:
        trades.append({
            "id": row[0],
            "requester_name": row[1],
            "day": str(row[2]),
            "start_time": str(row[3]),
            "end_time": str(row[4]),
            "employee_status": row[5],
            "manager_status": row[6]
        })
    return trades

@app.get("/trades/hours-check")
async def check_hours(request: Request, employee_id: int, shift_id: int):
    manager_id = get_manager_id_from_request(request)
    shift_rows = get_all_shifts(manager_id)
    shift = next((r for r in shift_rows if r[0] == shift_id), None)
    if not shift:
        return {"error": "Shift not found"}

    shift_date = str(shift[1])
    d = datetime.strptime(shift_date, "%Y-%m-%d")
    day = d.weekday()
    monday = d - timedelta(days=day)
    sunday = monday + timedelta(days=6)

    current_hours = get_employee_weekly_hours(
        employee_id,
        monday.strftime("%Y-%m-%d"),
        sunday.strftime("%Y-%m-%d")
    )

    shift_duration = (
        datetime.strptime(str(shift[3]), "%H:%M:%S") -
        datetime.strptime(str(shift[2]), "%H:%M:%S")
    ).seconds / 3600

    emp_rows = get_all_employees(manager_id)
    emp = next((r for r in emp_rows if r[0] == employee_id), None)
    desired_hours = emp[2] if emp else 40

    projected_hours = current_hours + shift_duration

    return {
        "current_hours": current_hours,
        "shift_hours": shift_duration,
        "projected_hours": projected_hours,
        "desired_hours": desired_hours,
        "over_limit": projected_hours > desired_hours
    }

@app.get("/schedule/unassigned")
async def list_unassigned_shifts(request: Request, start_date: str, end_date: str):
    manager_id = get_manager_id_from_request(request)
    ensure_templates_generated(manager_id)
    rows = get_unassigned_shifts(start_date, end_date, manager_id)
    result = []
    for row in rows:
        shift_id = row[0]
        substitutes = get_potential_substitutes(shift_id)
        result.append({
            "shift_id": shift_id,
            "day": str(row[1]),
            "start_time": str(row[2]),
            "end_time": str(row[3]),
            "required_role": row[4],
            "potential_substitutes": [
                {"id": s[0], "name": s[1]} for s in substitutes
            ]
        })
    return result

@app.post("/schedule/assign")
async def assign_shift(request: Request, data: dict):
    manager_id = get_manager_id_from_request(request)
    manually_assign_shift(data["shift_id"], data["employee_id"], manager_id)
    return {"message": "Shift assigned"}

@app.delete("/schedule/{schedule_id}")
async def delete_schedule_entry(schedule_id: int, request: Request):
    manager_id = get_manager_id_from_request(request)
    remove_schedule_entry(schedule_id, manager_id)
    return {"message": "Assignment removed"}

@app.get("/roles/{role_id}/usage")
async def role_usage(role_id: int):
    return get_role_usage(role_id)

@app.delete("/roles/{role_id}")
async def remove_role(role_id: int, request: Request):
    manager_id = get_manager_id_from_request(request)
    delete_role(role_id, manager_id)
    return {"message": "Role deleted"}

@app.get("/shifts/{shift_id}/assignment")
async def get_assignment(shift_id: int):
    employee_name = get_shift_assignment(shift_id)
    return {"employee": employee_name}

@app.put("/auth/reset-password")
async def reset_password(data: dict):
    employee_id = data["employee_id"]
    new_password = data["new_password"]
    hashed = hash_password(new_password)
    reset_user_password(employee_id, hashed)
    return {"message": "Password reset"}

@app.get("/schedule/day")
async def get_day_overview_endpoint(request: Request, date: str):
    manager_id = get_manager_id_from_request(request)
    return get_day_overview(date, manager_id)

@app.post("/auth/reset-request")
@limiter.limit("10/minute")
async def request_password_reset(request: Request, data: dict):
    employee_id = data["employee_id"]
    reset_id = create_password_reset(employee_id)
    return {"id": reset_id, "message": "Reset requested"}


@app.get("/auth/reset-status")
@limiter.limit("5/minute")
async def check_reset_status(request: Request, username: str):
    reset_id = check_pending_reset(username)
    return {"eligible": reset_id is not None}


@app.post("/auth/reset-complete")
@limiter.limit("5/minute")
async def complete_reset(request: Request, data: dict):
    username = data["username"]
    new_password = data["new_password"]
    hashed = hash_password(new_password)
    success = complete_password_reset(username, hashed)
    if not success:
        return {"error": "No valid reset request found. It may have expired."}
    return {"message": "Password reset successful"}

@app.post("/auth/create-user")
@limiter.limit("10/minute")
async def create_user_account(request: Request, data: dict):
    username = data["username"]
    password = data["password"]
    role = data["role"]
    employee_id = data.get("employee_id", None)

    existing = get_user_by_username(username)
    if existing:
        return {"error": "Username already taken"}

    hashed = hash_password(password)
    user_id = create_user(username, hashed, role, employee_id)
    return {"id": user_id, "username": username, "role": role}

@app.post("/shift-templates")
async def create_template(request: Request, data: dict):
    manager_id = get_manager_id_from_request(request)
    template_id = create_shift_template(
        data["day_name"],
        data["start_time"],
        data["end_time"],
        manager_id,
        data.get("role_id", None)
    )
    if template_id is None:
        return {"error": "An identical recurring shift already exists."}
    generate_shifts_from_template(template_id)
    return {"id": template_id, "message": "Recurring shift created"}


@app.get("/shift-templates")
async def list_templates(request: Request):
    manager_id = get_manager_id_from_request(request)
    rows = get_all_shift_templates(manager_id)
    return [
        {
            "id": row[0],
            "day_name": row[1],
            "start_time": str(row[2]),
            "end_time": str(row[3]),
            "role_id": row[4],
            "role_name": row[5],
            "active": row[6]
        }
        for row in rows
    ]

@app.get("/schedule/conflicts")
def get_schedule_conflicts_route(request: Request):
    manager_id = get_manager_id_from_request(request)
    conflict_ids = get_schedule_conflicts(manager_id)
    return {"conflict_ids": list(conflict_ids)}

class SignupRequest(BaseModel):
    username: str = Field(..., max_length=20)
    password: str = Field(..., max_length=50)

@app.post("/auth/signup")
@limiter.limit("5/minute")
async def signup(request: Request, data: SignupRequest):
    username = data.username.lower()

    existing = get_user_by_username(username)
    if existing:
        return {"error": "Username already taken"}

    hashed = hash_password(data.password)
    manager_id = create_user(username, hashed, "manager")

    role_ids = signup_new_manager(manager_id)
    template_ids = create_starter_shift_templates(manager_id, role_ids)
    for template_id in template_ids:
        generate_shifts_from_template(template_id)

    today = datetime.utcnow().date()
    start_date = today.strftime("%Y-%m-%d")
    end_date = (today + timedelta(days=13)).strftime("%Y-%m-%d")

    emp_rows = get_all_employees(manager_id)
    employees = []
    for row in emp_rows:
        emp_id, emp_name, emp_desired_hours = row
        rating_rows = get_ratings_by_employee(emp_id)
        ratings = {r[1]: float(r[2]) for r in rating_rows}
        overall_rating = calculate_overall_rating(ratings)
        availability_data = get_availability(emp_id)
        role_rows = get_employee_roles(emp_id)
        employees.append(Employee(
            employee_id=emp_id, name=emp_name, rating=overall_rating,
            available_days=availability_data["recurring_days"],
            desired_hours=emp_desired_hours, roles=[r[1] for r in role_rows]
        ))

    shift_rows = get_all_shifts(manager_id)
    shifts = []
    for row in shift_rows:
        shift_date = str(row[1])
        if start_date <= shift_date <= end_date:
            shifts.append(Shift(
                day=shift_date, start_time=str(row[2]), end_time=str(row[3]),
                required_role=str(row[5]) if row[5] else None, shift_id=row[0]
            ))

    completed_schedule = generate_schedule(employees, shifts)
    for shift in completed_schedule:
        if shift.employee_name:
            emp_id = next((r[0] for r in emp_rows if r[1] == shift.employee_name), None)
            if emp_id and shift.shift_id:
                save_schedule(shift.shift_id, emp_id, manager_id)

    token = create_token({"sub": data.username, "role": "manager", "employee_id": None, "id": manager_id})
    return {"token": token, "role": "manager", "username": data.username}