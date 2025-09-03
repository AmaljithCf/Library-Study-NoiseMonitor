#include <M5Unified.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <time.h>
#include <math.h>
#include <FastLED.h>

//====================================================================================
// 1. CONFIGURATION
//====================================================================================
const char* WIFI_SSID = "YOURS_HERE";
const char* WIFI_PASSWORD = "YOURS_HERE";

// --- HiveMQ Broker Configuration (TLS) ---
const char* HIVEMQ_BROKER = "YOURS_HERE.s1.eu.hivemq.cloud";
const int HIVEMQ_PORT = 8883; // Standard TLS Port
const char* HIVEMQ_USERNAME = "YOURS_HERE";
const char* HIVEMQ_PASSWORD = "YOURS_HERE";
const char* MQTT_CLIENT_ID = "library-device-area1";
const char* MQTT_TOPIC_PUBLISH = "library/noise/area1/alerts";

// --- Timezone Settings ---
const long GMT_OFFSET_SEC = 19800; 
const int DAYLIGHT_OFFSET_SEC = 0;
const char* NTP_SERVER_1 = "pool.ntp.org";
const char* NTP_SERVER_2 = "time.nist.gov";

// --- Display Configuration ---
#define SHADOW_OFFSET 3

// --- LED Configuration ---
#define LED_PIN 25
#define NUM_LEDS 10
#define LED_BRIGHTNESS 50
CRGB leds[NUM_LEDS];

// --- Timing and Thresholds ---
const unsigned long STARTUP_GRACE_PERIOD_MS = 5000;
const unsigned long PROCESSING_INTERVAL_MS = 200;
const unsigned long NORMAL_NOISE_ALERT_DURATION_MS = 5000;
const unsigned long ABOVE_QUIET_ORANGE_DURATION_MS = 2000;
const unsigned long LOUD_FLASH_DURATION_MS = 3000;

const size_t MIC_BUFFER_SIZE = 512;
const float MIC_CALIBRATION_DB_OFFSET = 85.0;
const float THRESHOLD_QUIET = 35.0;
const float THRESHOLD_LOUD = 60.0;

enum NoiseCategory { QUIET, NORMAL, LOUD };
enum MQTTTaskState { MQTT_IDLE, MQTT_SHOW_STATUS, MQTT_PENDING_CONNECTION, MQTT_PENDING_SEND, MQTT_PENDING_DISCONNECT };


//====================================================================================
// 3. GLOBAL VARIABLES
//====================================================================================

WiFiClientSecure netClient;
PubSubClient mqttClient(netClient);
MQTTTaskState mqttTaskState = MQTT_IDLE;

float currentNoiseDB = 0.0;
NoiseCategory currentNoiseCategory = QUIET;

unsigned long startupGracePeriodEnd = 0;
unsigned long normalStateStartTime = 0;
unsigned long aboveQuietStartTime = 0;
unsigned long loudFlashEndTime = 0;
bool loudAlertSent = true;
String queuedAlertReason = "";
float queuedAlertDB = 0.0;

int lastDisplayedMinute = -1, lastDisplayedHour = -1, lastDisplayedDate = -1;
int lastDisplayedBattery = -1;
float lastDisplayedDB = -1.0;
bool forceDisplayRedraw = true;

int16_t mic_buffer[MIC_BUFFER_SIZE];
volatile float mic_sum_accumulator = 0;
volatile size_t mic_sample_count = 0;
unsigned long lastProcessingTime = 0;

const char* week_days[] = {"SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"};
const char* months[] = {"JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"};

//====================================================================================
// 4. FORWARD DECLARATIONS
//====================================================================================
void syncInternalClockToNTP();
void triggerMQTTSend(String reason, float dbValue);
unsigned long long getTimestampMillis();
bool publishToHiveMQ();
void handleStatusLED();

//====================================================================================
// 5. SETUP
//====================================================================================
void setup() {
  auto cfg = M5.config();
  cfg.internal_mic = true;
  M5.begin(cfg);
  Serial.begin(115200);
  M5.Display.setBrightness(100);

  FastLED.addLeds<SK6812, LED_PIN, GRB>(leds, NUM_LEDS);
  FastLED.setBrightness(LED_BRIGHTNESS);
  
  M5.Display.fillScreen(TFT_BLACK);
  M5.Display.setTextColor(TFT_WHITE);
  M5.Display.setTextSize(2);
  M5.Display.setCursor(10, 10);
  M5.Display.println("Initializing...");

  Serial.println("\n[INFO] Booting Library Noise Monitor...");
  syncInternalClockToNTP();

  // Using insecure connection as per previous request.
  netClient.setInsecure(); 

  mqttClient.setServer(HIVEMQ_BROKER, HIVEMQ_PORT);

  Serial.println("[INFO] System ready.");
  lastProcessingTime = millis();
  startupGracePeriodEnd = millis() + STARTUP_GRACE_PERIOD_MS;
}

//====================================================================================
// 6. MAIN LOOP
//====================================================================================
void loop() {
  M5.update();
  handleMQTTTaskMachine();
  
  if (mqttTaskState == MQTT_IDLE) {
    handleMicrophoneAndTriggers();
  }
  
  handleDisplay();
  handleStatusLED();
}

//====================================================================================
// 7. CORE HANDLER FUNCTIONS
//====================================================================================

void handleMicrophoneAndTriggers() {
  size_t samples_read = M5.Mic.record(mic_buffer, MIC_BUFFER_SIZE);
  if (samples_read > 0) {
    for (size_t i = 0; i < samples_read; i++) mic_sum_accumulator += abs(mic_buffer[i]);
    mic_sample_count += samples_read;
  }
  if (millis() - lastProcessingTime < PROCESSING_INTERVAL_MS) return;
  
  if (mic_sample_count > 0) {
    float avg_amplitude = mic_sum_accumulator / mic_sample_count;
    float db = 20.0 * log10(avg_amplitude / 32767.0 + 1e-6) + MIC_CALIBRATION_DB_OFFSET;
    currentNoiseDB = (db > 0) ? db : 0;
  } else {
    currentNoiseDB = 0.0;
  }
  
  NoiseCategory previousCategory = currentNoiseCategory;
  if (currentNoiseDB > THRESHOLD_LOUD) currentNoiseCategory = LOUD;
  else if (currentNoiseDB > THRESHOLD_QUIET) currentNoiseCategory = NORMAL;
  else currentNoiseCategory = QUIET;

  if (millis() < startupGracePeriodEnd) {
    mic_sum_accumulator = 0;
    mic_sample_count = 0;
    lastProcessingTime = millis();
    return;
  }

  if (currentNoiseCategory == LOUD) {
    if (!loudAlertSent) {
      triggerMQTTSend("Loud noise level detected", currentNoiseDB);
      loudAlertSent = true;
    }
    if (previousCategory != LOUD) {
      loudFlashEndTime = millis() + LOUD_FLASH_DURATION_MS;
    }
  }
  else if (currentNoiseCategory == NORMAL) {
    loudAlertSent = false;
    if (previousCategory != NORMAL) {
      normalStateStartTime = millis();
    } else if (normalStateStartTime > 0 && millis() - normalStateStartTime > NORMAL_NOISE_ALERT_DURATION_MS) {
      triggerMQTTSend("Above threshold", currentNoiseDB);
      normalStateStartTime = 0;
    }
  }
  else {
    loudAlertSent = false;
    normalStateStartTime = 0;
  }
  mic_sum_accumulator = 0;
  mic_sample_count = 0;
  lastProcessingTime = millis();
}

// *** MODIFIED FUNCTION ***
void handleMQTTTaskMachine() {
  switch (mqttTaskState) {
    case MQTT_IDLE: break;
    case MQTT_SHOW_STATUS:
      M5.Display.fillScreen(TFT_BLACK);
      M5.Display.setFont(nullptr);

      // --- Display "Sending Alert..." ---
      M5.Display.setTextSize(3);
      M5.Display.setCursor(20, 100);
      M5.Display.setTextColor(TFT_YELLOW);
      M5.Display.println("Sending Alert...");

      // --- NEW: Display the triggering dB value ---
      char dbStr[20];
      sprintf(dbStr, "Level: %.1f dB", queuedAlertDB); // Format the dB value string
      M5.Display.setTextSize(3);                       // Use a similar size for impact
      M5.Display.setTextColor(TFT_RED);                // Use red to highlight the alert level
      
      // Center the text
      int16_t x;
      x = (M5.Display.width() - M5.Display.textWidth(dbStr)) / 2;
      M5.Display.setCursor(x, 150);                    // Position it below the main message
      M5.Display.print(dbStr);

      mqttTaskState = MQTT_PENDING_CONNECTION;
      break;

    case MQTT_PENDING_CONNECTION:
      if (WiFi.status() == WL_CONNECTED && mqttClient.connect(MQTT_CLIENT_ID, HIVEMQ_USERNAME, HIVEMQ_PASSWORD)) {
        mqttTaskState = MQTT_PENDING_SEND;
      } else {
        Serial.print("MQTT connection failed, state=");
        Serial.println(mqttClient.state());
        mqttTaskState = MQTT_PENDING_DISCONNECT;
      }
      break;
    case MQTT_PENDING_SEND:
      publishToHiveMQ();
      mqttTaskState = MQTT_PENDING_DISCONNECT;
      break;
    case MQTT_PENDING_DISCONNECT:
      mqttClient.disconnect();
      mqttTaskState = MQTT_IDLE;
      forceDisplayRedraw = true;
      break;
  }
}

void handleStatusLED() {
  if (mqttTaskState != MQTT_IDLE) {
    fill_solid(leds, NUM_LEDS, CRGB::Red);
    FastLED.show();
    return;
  }
  if (millis() < loudFlashEndTime) {
    bool ledOn = (millis() / 200) % 2;
    fill_solid(leds, NUM_LEDS, ledOn ? CRGB::Red : CRGB::Black);
    FastLED.show();
    return;
  }
  if (currentNoiseDB < THRESHOLD_QUIET) {
    fill_solid(leds, NUM_LEDS, CRGB::Green);
    aboveQuietStartTime = 0;
  } else {
    if (aboveQuietStartTime == 0) {
      aboveQuietStartTime = millis();
    }
    if (millis() - aboveQuietStartTime > ABOVE_QUIET_ORANGE_DURATION_MS) {
      fill_solid(leds, NUM_LEDS, CRGB::Orange);
    } else {
      fill_solid(leds, NUM_LEDS, CRGB::Green);
    }
  }
  FastLED.show();
}

void handleDisplay() {
  if (mqttTaskState != MQTT_IDLE) return;
  
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    M5.Display.setFont(nullptr); M5.Display.setTextSize(2);
    M5.Display.setCursor(80, 110);
    M5.Display.setTextColor(TFT_RED, TFT_BLACK);
    M5.Display.print("Syncing Time...");
    return;
  }

  if (forceDisplayRedraw) {
    M5.Display.fillScreen(TFT_BLACK);
    lastDisplayedMinute = -1;
    lastDisplayedDB = -1.0;
    lastDisplayedDate = -1;
    lastDisplayedBattery = -1;
  }

  // --- 1. Draw Battery Percentage ---
  int batteryLevel = M5.Power.getBatteryLevel();
  if(batteryLevel != lastDisplayedBattery || forceDisplayRedraw) {
    char battStr[8];
    sprintf(battStr, "%d%%", batteryLevel);
    if(M5.Power.isCharging()) { strcat(battStr, "+"); }
    M5.Display.setFont(nullptr); M5.Display.setTextSize(2);
    M5.Display.setTextColor(TFT_WHITE, TFT_BLACK);
    M5.Display.setCursor(10, 10); M5.Display.print(battStr);
    lastDisplayedBattery = batteryLevel;
  }

  // --- 2. Draw the Clock with 3D effect ---
  if (timeinfo.tm_min != lastDisplayedMinute || forceDisplayRedraw) {
    int displayHour = (timeinfo.tm_hour % 12 == 0) ? 12 : timeinfo.tm_hour % 12;
    char timeStr[6];
    sprintf(timeStr, "%02d:%02d", displayHour, timeinfo.tm_min);
    
    M5.Display.setFont(nullptr); M5.Display.setTextSize(7);
    int16_t x = (M5.Display.width() - M5.Display.textWidth(timeStr)) / 2;
    int16_t y = 60;
    M5.Display.fillRect(x - SHADOW_OFFSET, y - SHADOW_OFFSET, M5.Display.textWidth(timeStr) + (SHADOW_OFFSET*2), 60 + (SHADOW_OFFSET*2), TFT_BLACK);
    M5.Display.setTextColor(TFT_DARKGREY);
    M5.Display.setCursor(x + SHADOW_OFFSET, y + SHADOW_OFFSET); M5.Display.print(timeStr);
    M5.Display.setTextColor(TFT_YELLOW);
    M5.Display.setCursor(x, y); M5.Display.print(timeStr);

    lastDisplayedMinute = timeinfo.tm_min;
    lastDisplayedHour = timeinfo.tm_hour;
  }

  // --- 3. Draw the Calendar Date ---
  if (timeinfo.tm_mday != lastDisplayedDate || forceDisplayRedraw) {
    char dateStr[20];
    sprintf(dateStr, "%s, %s %d", week_days[timeinfo.tm_wday], months[timeinfo.tm_mon], timeinfo.tm_mday);
    
    M5.Display.setFont(nullptr); M5.Display.setTextSize(2);
    int16_t date_x = (M5.Display.width() - M5.Display.textWidth(dateStr)) / 2;
    int16_t date_y = 130;
    M5.Display.setTextColor(TFT_WHITE, TFT_BLACK);
    M5.Display.setCursor(date_x, date_y); M5.Display.print(dateStr);
    lastDisplayedDate = timeinfo.tm_mday;
  }

  // --- 4. Draw AM/PM ---
  bool isAm = (timeinfo.tm_hour < 12);
  if (lastDisplayedHour != timeinfo.tm_hour || forceDisplayRedraw) {
      M5.Display.setTextSize(2);
      M5.Display.setTextColor(TFT_CYAN, TFT_BLACK);
      M5.Display.setCursor(260, 215);
      M5.Display.print(isAm ? "AM" : "PM");
  }

  // --- 5. Draw dB Level ---
  if ((int)currentNoiseDB != (int)lastDisplayedDB || forceDisplayRedraw) {
    char dbStr[16];
    sprintf(dbStr, "%.1f dB", currentNoiseDB);
    M5.Display.setTextSize(2);
    if (currentNoiseDB < 35) {
      M5.Display.setTextColor(TFT_GREEN, TFT_BLACK);
    } else if (currentNoiseDB >= 35 && currentNoiseDB < 60) {
      M5.Display.setTextColor(TFT_ORANGE, TFT_BLACK);
    } else {
      M5.Display.setTextColor(TFT_RED, TFT_BLACK);
    }
    M5.Display.setCursor(15, 215); M5.Display.print(dbStr);
    lastDisplayedDB = currentNoiseDB;
  }

  forceDisplayRedraw = false;
}

//====================================================================================
// 8. ACTION & UTILITY FUNCTIONS
//====================================================================================

void triggerMQTTSend(String reason, float dbValue) {
  if (mqttTaskState != MQTT_IDLE) return;
  Serial.printf("[INFO] Trigger received: %s\n", reason.c_str());
  queuedAlertReason = reason;
  queuedAlertDB = dbValue;
  mqttTaskState = MQTT_SHOW_STATUS;
}

bool publishToHiveMQ() {
  StaticJsonDocument<256> doc;

  doc["noise_level"] = round(queuedAlertDB);
  doc["alert_reason"] = queuedAlertReason;
  doc["client_id"] = MQTT_CLIENT_ID;
  doc["timestamp"] = getTimestampMillis();

  String payload;
  serializeJson(doc, payload);

  Serial.print("[INFO] Publishing payload: ");
  Serial.println(payload);

  return mqttClient.publish(MQTT_TOPIC_PUBLISH, payload.c_str());
}

void syncInternalClockToNTP() {
  M5.Display.println("Connecting to WiFi...");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    M5.Display.print(".");
    delay(500);
  }
  M5.Display.println("\nSyncing time...");

  configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER_1, NTP_SERVER_2);
  
  struct tm timeinfo;
  if (getLocalTime(&timeinfo)) {
    Serial.println("[INFO] Internal clock synchronized successfully.");
  } else {
    Serial.println("[WARN] Failed to get NTP time.");
  }
}

unsigned long long getTimestampMillis() {
  time_t now;
  time(&now);
  return (unsigned long long)now * 1000;
}