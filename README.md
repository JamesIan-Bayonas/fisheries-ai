# Fisheries AI: Edge-Vision Telegram Interface

## Overview
Fisheries AI is a Node.js-based microservice that acts as the user-facing data collection layer for the IsdaLog ecosystem. Designed for maritime environments with limited connectivity, it utilizes a Telegram bot interface to allow fishermen to log their catch data efficiently. The service integrates with a local Edge-AI vision model (LLaVA) to automatically identify fish species, estimate weight, and calculate confidence scores directly from user-uploaded images.

**Important Ecosystem Note:** This service is the frontend gateway and relies entirely on a handshake with the [IsdaLog Backend Engine](link-to-your-isdalog-repo) to function. It will not operate without the Laravel API running.

## System Architecture
1. **User Interface:** Telegraf.js Telegram Bot (Supports English and Cebuano localization).
2. **Edge-AI Processing:** Local integration with Ollama running the LLaVA multi-modal model for zero-latency image inference.
3. **Data Enrichment:** Open-Meteo API integration for real-time port weather and wind conditions.
4. **Data Sync:** Secure HTTP handshake and payload transmission to the IsdaLog Laravel API.

## Technical Stack
* **Runtime:** Node.js (v18+)
* **Bot Framework:** Telegraf
* **HTTP Client:** Axios
* **AI Inference:** Ollama (LLaVA)
* **Containerization:** Docker & Docker Compose

## Core Workflows
* **Catch Logging:** Accepts image payloads, routes them to the local GPU for inference, parses the structured JSON response, requests GPS coordinates, and dispatches the compiled data to the backend.
* **Session Management:** Utilizes in-memory session states to maintain localization preferences (English/Cebuano) and hold pending catch data during the multi-step input process.

## Environment Configuration
Create a `.env` file in the root directory:

```env
BOT_TOKEN=your_telegram_bot_token
ISDALOG_API_URL=http://isdalog-app:8000/api
ISDALOG_API_TOKEN=your_secure_handshake_token
OLLAMA_URL=[http://host.docker.internal:11434/api/generate](http://host.docker.internal:11434/api/generate)
```

## Installation & Deployment

Due to the hardware dependencies of the Edge-AI model, this application is designed to be run alongside the IsdaLog Docker network.
1. Ensure the IsdaLog Laravel backend is currently running.
2. Ensure Ollama is running locally with the vision model loaded (ollama run llava).
3. Build and deploy the container:

```bash
docker-compose up -d --build
```