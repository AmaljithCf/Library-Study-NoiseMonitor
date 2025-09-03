# Library Study Noise Monitor

This project is a web application for monitoring noise levels in a library or study area. It provides a real-time dashboard to visualize the noise levels in different designated areas and sends alerts when the noise exceeds a certain threshold.

## Features

*   **Real-time Noise Monitoring:** Uses MQTT to receive and display real-time noise level data.
*   **Area Management:** Add, edit, and manage different areas for noise monitoring.
*   **Alerts:** Get alerts when noise levels are high.
*   **Analytics:** View analytics and historical data for noise levels.
*   **Responsive Design:** The application is designed to work on different screen sizes.

## Technologies Used

*   **Frontend:**
    *   React
    *   TypeScript
    *   Vite
    *   Tailwind CSS
    *   Shadcn/ui
*   **Real-time Communication:**
    *   MQTT
*   **Data Fetching:**
    *   TanStack Query
*   **Routing:**
    *   React Router

## Getting Started

### Prerequisites

*   Node.js and npm (or yarn/bun) installed.
*   An MQTT broker for real-time communication.

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/AmaljithCf/Library-Study-NoiseMonitor.git
    ```
2.  Navigate to the project directory:
    ```bash
    cd Library-Study-NoiseMonitor
    ```
3.  Install the dependencies:
    ```bash
    npm install
    ```

### Running the Application

1.  Start the development server:
    ```bash
    npm run dev
    ```
2.  Open your browser and navigate to `http://localhost:5173` (or the port specified in the output).
