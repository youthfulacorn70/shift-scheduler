from models import Employee, Shift, calculate_overall_rating
from datetime import datetime, timedelta

def generate_schedule(employees: list, shifts: list, availability_data: dict) -> list:
    sorted_employees = sorted(employees, key=lambda emp: emp.rating, reverse=True)

    assigned_hours = {emp.name: {} for emp in sorted_employees}  # name -> {week_start: hours}
    assigned_days = {emp.name: [] for emp in sorted_employees}

    shifts = sorted(shifts, key=lambda s: calculate_shift_hours(s.start_time, s.end_time), reverse=True)

    for shift in shifts:
        shift_duration = calculate_shift_hours(shift.start_time, shift.end_time)
        shift_date = datetime.strptime(shift.day, "%Y-%m-%d")
        day_name = shift_date.strftime("%A")
        week_start = (shift_date - timedelta(days=shift_date.weekday())).strftime("%Y-%m-%d")

        for emp in sorted_employees:
            already_working_that_day = shift.day in assigned_days[emp.name]
            current_week_hours = assigned_hours[emp.name].get(week_start, 0)
            would_exceed_hours = current_week_hours + shift_duration > emp.desired_hours

            is_available = check_availability_in_memory(
                availability_data.get(emp.employee_id, {"recurring": {}, "specific": {}}),
                shift.day,
                day_name
            )

            has_required_role = shift.required_role is None or shift.required_role in emp.roles

            if is_available and not already_working_that_day and not would_exceed_hours and has_required_role:
                shift.employee_name = emp.name
                assigned_hours[emp.name][week_start] = current_week_hours + shift_duration
                assigned_days[emp.name].append(shift.day)
                break

    return shifts

def check_availability_in_memory(emp_availability: dict, shift_day: str, day_name: str) -> bool:
    """Same logic as get_availability_for_date, but reads from pre-fetched data — no DB call."""
    specific_status = emp_availability["specific"].get(shift_day)
    if specific_status is not None:
        return specific_status == 'available'
    recurring_status = emp_availability["recurring"].get(day_name)
    if recurring_status is not None:
        return recurring_status == 'available'
    return False

def calculate_shift_hours(start_time: str, end_time: str) -> float:
    start_parts = start_time.split(':')
    end_parts = end_time.split(':')
    start_minutes = int(start_parts[0]) * 60 + int(start_parts[1])
    end_minutes = int(end_parts[0]) * 60 + int(end_parts[1])
    return (end_minutes - start_minutes) / 60