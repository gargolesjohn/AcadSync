# AcadSync - Campus Communication Hub

AcadSync is a full-stack academic platform designed to streamline communication, coursework management, and scheduling within an educational institution. It provides a comprehensive dashboard for administrators, instructors, and students to interact seamlessly.

## How It Works

AcadSync serves as a centralized hub where users can access different features based on their roles:
- **Announcements & Messages:** Real-time updates and direct messaging between students and instructors.
- **Assignments & Submissions:** Instructors can post assignments, and students can submit their work and view grades.
- **Schedules:** Built-in scheduling system to keep track of classes, lab reservations, and important events.
- **User Management:** Administrators have full control over user accounts and platform data.
- **Authentication:** Secure login system supporting Google OAuth and role-based access control.

## Technologies Used

### Frontend
- **React (with Vite)** - For building a fast, dynamic user interface.
- **TypeScript** - Ensures type safety and scalable code.
- **Vanilla CSS** - Custom, modern, and beautiful UI styling with responsive design and dark-theme support.

### Backend
- **Python (FastAPI)** - A high-performance web framework for building the RESTful API.
- **SQLAlchemy** - ORM for robust database management.
- **MySQL** - Robust relational database replacing SQLite for scalable data storage.

## How to Run Locally

Running the project on any PC is extremely simple thanks to the included startup script. 

### Prerequisites
Make sure you have the following installed on your PC:
- [Node.js](https://nodejs.org/) (for the frontend)
- [Python 3.10+](https://www.python.org/) (for the backend)
- **MySQL Server** (e.g. via XAMPP). Must be running on `127.0.0.1:3306` with user `root` and no password.

### Data Migration (First Time Only)
If you are running the project for the first time after upgrading to MySQL, run the migration script to transfer all existing accounts and data from the old SQLite database:
1. Start your MySQL server (e.g. from XAMPP Control Panel).
2. Open a terminal in the root project folder and run:
   ```bash
   python migrate_to_mysql.py
   ```
   *This script will automatically create the `acadsync` database and copy all your data over safely.*

### Steps to Run
1. **Clone the repository** to your local machine.
2. Double-click the **`start_acadsync.bat`** file in the root folder.
3. The script will automatically start both the FastAPI backend and the React frontend in new terminal windows!
   - Frontend Web App: `http://localhost:5173`
   - Backend API Docs: `http://localhost:8000/docs`
