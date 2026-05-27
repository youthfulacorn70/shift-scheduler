from models import Employee, Shift, calculate_overall_rating
from datetime import datetime  # added

def generate_schedule(employees: list, shifts: list) -> list:
    sorted_employees = sorted(employees, key=lambda emp: emp.rating, reverse=True)
    
    assigned_hours = {emp.name: 0 for emp in sorted_employees}
    assigned_days = {emp.name: [] for emp in sorted_employees}

    shifts = sorted(shifts, key=lambda s: calculate_shift_hours(s.start_time, s.end_time), reverse=True)

    for shift in shifts:
        shift_duration = calculate_shift_hours(shift.start_time, shift.end_time)
        
        # convert the shift's date to a day name so it matches availability
        day_name = datetime.strptime(shift.day, "%Y-%m-%d").strftime("%A")
        
        for emp in sorted_employees:
            already_working_that_day = day_name in assigned_days[emp.name]  # changed shift.day to day_name
            would_exceed_hours = assigned_hours[emp.name] + shift_duration > emp.desired_hours
            is_available = day_name in emp.available_days  # changed shift.day to day_name
            has_required_role = shift.required_role is None or shift.required_role in emp.roles

            if is_available and not already_working_that_day and not would_exceed_hours and has_required_role:
                shift.employee_name = emp.name
                assigned_hours[emp.name] += shift_duration
                assigned_days[emp.name].append(day_name)  # changed shift.day to day_name
                break

    return shifts

def calculate_shift_hours(start_time: str, end_time: str) -> float:
    start_parts = start_time.split(':')
    end_parts = end_time.split(':')
    start_minutes = int(start_parts[0]) * 60 + int(start_parts[1])
    end_minutes = int(end_parts[0]) * 60 + int(end_parts[1])
    return (end_minutes - start_minutes) / 60