# Library Study Noise Monitor

This project is a web application for monitoring noise levels in a library or study area. It provides a real-time dashboard to visualize the noise levels in different designated areas and sends alerts when the noise exceeds a certain threshold.

## Project Overview
The M5Stack device serves as the noise sensor, capturing audio, measuring decibel (dB) levels, and communicating this data via MQTT to a real-time web dashboard. Alerts are triggered and displayed when noise exceeds predefined thresholds.

## Hardware
*   **M5Stack Development Board:** The core of the noise monitoring system.
*   **Built-in Display:** Shows current time, date, battery status, and noise levels.
*   **Internal Microphone:** Captures ambient sound to measure noise levels.
*   **LEDs (connected to GPIO 25):** Visually indicate noise status (Green for quiet, Orange for normal, Red for loud/alert).

## Frontend Technologies
 historical data for noise levels.
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
