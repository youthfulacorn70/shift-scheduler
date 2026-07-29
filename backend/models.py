class Employee:
    def __init__(self, employee_id, name, rating, available_days, desired_hours, roles=[]):
        self.employee_id = employee_id
        self.available_days = available_days
        self.name = name
        self.rating = rating
        self.desired_hours = desired_hours
        self.roles = roles

def calculate_overall_rating(ratings: dict) -> float:
    if not ratings:
        return 0.0
    return round(sum(ratings.values()) / len(ratings), 2)

class Shift:
    def __init__(self, day, start_time, end_time, employee_name=None, required_role=None, shift_id=None):
        self.day = day
        self.start_time = start_time
        self.end_time = end_time
        self.employee_name = employee_name
        self.required_role = required_role
        self.shift_id = shift_id