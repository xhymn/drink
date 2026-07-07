# Repository Guidelines

## Technical Architecture

This project is a dependency-free daily water intake tracker. The UI is a static web app built with plain HTML, CSS, and vanilla JavaScript. Data is stored in browser `localStorage`, so no database is required.

For reliable system notifications, the project also includes a tiny Node.js HTTP server in `server.js`. When the app is opened through `http://127.0.0.1:8787/`, the browser calls `/api/notify`, and the server triggers native notifications with `osascript` on macOS, `powershell.exe` on Windows, and `notify-send` on Linux.

## Main Features

- Track daily water intake with quick-add and custom milliliter entries.
- Browse previous dates and return to today with one click.
- Calculate a personalized daily target using sex, weight, activity, hot weather, pregnancy, lactation, or a manual target.
- Show progress with an animated water cup.
- Display daily logs, a 7-day bar trend, and a line chart with the suggested target line.
- Generate a configurable daily drinking plan with start time, end time, interval, next reminder time, and system notifications.
- Provide concise hydration advice with scientific source links.

## Project Structure

- `index.html`: app markup and panels.
- `styles.css`: responsive layout, visual design, charts, and animations.
- `app.js`: app state, rendering, calculations, reminders, and notification calls.
- `server.js`: local static file server and cross-platform notification endpoint.
- `assets/`: SVG visual assets.
- `20260707-095905.jpg`: design reference image.

## Running Locally

For full functionality, including native system notifications:

```sh
node server.js
```

Then open:

```text
http://127.0.0.1:8787/
```

For basic UI-only use, opening `index.html` directly also works, but native notification support will not be available.

## Development & Testing

Validate JavaScript syntax before handoff:

```sh
node --check app.js
node --check server.js
```

Manual checks should include adding and deleting records, switching dates, refreshing to verify `localStorage`, testing responsive layouts, and clicking the reminder test button from the local server URL.

## Coding Style

Use two-space indentation, `camelCase` for JavaScript, and `kebab-case` for CSS classes and IDs. Keep the app dependency-free unless a clear need is discussed first.
