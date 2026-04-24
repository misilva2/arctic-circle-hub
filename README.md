# Arctic Circle Hub

Employee time tracking and operational procedure management web app.

## Features

- Add and maintain an employee roster (name and role)
- Clock employees in and out
- Automatic shift entry logging with calculated worked hours
- Live count of currently clocked-in employees
- Procedure checklist with complete/remove actions
- Hours summary by employee
- CSV export for timesheet entries
- Local persistence using browser `localStorage`

## Project Structure

- `index.html` - App layout and UI sections
- `styles.css` - Responsive visual design and animations
- `app.js` - State management, rendering, and app interactions

## Run Locally

Because this is a static site, any simple file server works.

Option 1 (Python):

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

Option 2:

- Open `index.html` directly in a browser.

## Notes

- Data is stored in the current browser only.
- To reset all app data, clear site storage/localStorage in the browser.