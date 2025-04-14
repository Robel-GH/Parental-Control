from flask import Blueprint, render_template, request, redirect, url_for, flash, session, g
from functools import wraps
from models import User
import re

auth_bp = Blueprint('auth', __name__)

def login_required(view):
    @wraps(view)
    def wrapped_view(*args, **kwargs):
        if g.user is None:
            return redirect(url_for('auth.login'))
        return view(*args, **kwargs)
    return wrapped_view

def is_parent(view):
    @wraps(view)
    def wrapped_view(*args, **kwargs):
        if g.user is None or g.user['role'] != 'parent':
            return redirect(url_for('main.index'))
        return view(*args, **kwargs)
    return wrapped_view

@auth_bp.route('/login', methods=('GET', 'POST'))
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        error = None

        if not username:
            error = 'Username is required.'
        elif not password:
            error = 'Password is required.'
        else:
            user = User.authenticate(username, password)
            if user is None:
                error = 'Invalid username or password.'

        if error is None:
            session.clear()
            session['user_id'] = user['id']
            if user['role'] == 'parent':
                return redirect(url_for('main.parent_dashboard'))
            else:
                return redirect(url_for('main.child_home'))

        flash(error)

    return render_template('login.html')

@auth_bp.route('/register', methods=('GET', 'POST'))
def register():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        confirm_password = request.form['confirm_password']
        email = request.form['email']
        role = request.form['role']
        error = None

        # Validation
        if not username:
            error = 'Username is required.'
        elif not password:
            error = 'Password is required.'
        elif password != confirm_password:
            error = 'Passwords do not match.'
        elif not email:
            error = 'Email is required.'
        elif not re.match(r"[^@]+@[^@]+\.[^@]+", email):
            error = 'Invalid email address.'
        elif not role or role not in ['parent', 'child']:
            error = 'Invalid role.'

        # For child accounts, verify parent_id
        parent_id = None
        if role == 'child':
            parent_username = request.form['parent_username']
            if not parent_username:
                error = 'Parent username is required for child accounts.'
            else:
                # Find parent user
                from models import get_db_connection
                conn = get_db_connection()
                cursor = conn.cursor()
                cursor.execute('SELECT id FROM users WHERE username = ? AND role = "parent"', (parent_username,))
                parent = cursor.fetchone()
                conn.close()
                
                if parent:
                    parent_id = parent['id']
                else:
                    error = 'Parent user not found or is not a parent account.'

        if error is None:
            user_id = User.create(username, password, email, role, parent_id)
            
            if user_id is None:
                error = 'Username or email already exists.'
            else:
                # Log the user in
                session.clear()
                session['user_id'] = user_id
                if role == 'parent':
                    return redirect(url_for('main.parent_dashboard'))
                else:
                    return redirect(url_for('main.child_home'))

        flash(error)

    return render_template('register.html')

@auth_bp.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('auth.login'))
