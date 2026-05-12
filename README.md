# 🛡️ ClaimSense: Autonomous Insurance Claims Agent

ClaimSense is an end-to-end AI-powered POC that automates the ingestion, extraction, and routing of First Notice of Loss (FNOL) insurance documents. Built to demonstrate rapid prototyping, robust system design, and production-ready thinking.

## 🚀 The Approach

Rather than just writing a script that prints text to the console, I approached this as a complete product feature. The architecture is split into four distinct phases:

1. **Document Ingestion (`pdfplumber`)**: Accurately extracts raw text from structured or unstructured FNOL PDFs and TXT files.
2. **AI Extraction Engine (`openai` SDK + `Pydantic`)**: Instead of relying on brittle prompt engineering or Regex to parse AI outputs, this system uses MiniMax-M2.7 (via NVIDIA NIM) with strict Pydantic schema enforcement. The JSON schema is passed directly to the model, guaranteeing type-safe, structured output every single time. No hallucinations.
3. **Deterministic Routing Engine**: A Python-based rule engine that evaluates the AI's JSON output. It enforces a strict priority hierarchy (Missing Fields → Fraud Keywords → Injuries → Fast-Track thresholds) to guarantee safe and logical claim routing.
4. **Premium UI/UX (FastAPI + HTML/CSS/JS)**: A beautifully crafted, glassmorphic dashboard that allows users to drag-and-drop documents, watch the AI process them in real-time, and visualize the final claim report.

## 🛠️ Tech Stack

*   **Backend & API:** Python 3, FastAPI, Uvicorn
*   **AI / LLM:** MiniMax-M2.7 via NVIDIA NIM (OpenAI-compatible endpoint)
*   **Data Validation:** Pydantic (V2)
*   **PDF Parsing:** pdfplumber
*   **Frontend:** Vanilla HTML/CSS/JS (Zero-build pipeline for rapid POC deployment)
*   **Deployment:** Render (via `render.yaml` blueprint)

## ⚙️ How to Run Locally

### 1. Environment Setup
Clone the repository and set up a Python virtual environment:
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. Configure API Keys
Copy the example environment file and add your NVIDIA NIM API key:
```bash
cp .env.example .env
```
Open `.env` and paste your key: `NVIDIA_API_KEY=nvapi-your-key-here`

You can get a free key from [NVIDIA NIM](https://build.nvidia.com/).

### 3. Start the Server
Run the FastAPI application:
```bash
python app.py
```

### 4. Use the Dashboard
*   Open your browser and navigate to: `http://localhost:8000`
*   Upload a filled FNOL document (try `data/sample-claim-filled.txt` for a demo)
*   Click **Analyze Claim** and watch the magic happen.

## ☁️ Deploy to Render

This project includes a `render.yaml` blueprint for one-click deployment:

1. Push this repo to GitHub.
2. Go to [Render Dashboard](https://dashboard.render.com/) → **New** → **Blueprint**.
3. Connect your GitHub repo.
4. Render will auto-detect `render.yaml` and configure everything.
5. Add `NVIDIA_API_KEY` as an environment variable in the Render dashboard.
6. Deploy!

Or deploy manually:
*   **Build Command:** `pip install -r requirements.txt`
*   **Start Command:** `gunicorn app:app --workers 2 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT`

## 🧠 Why This Architecture?

*   **Speed vs. Reliability:** Using MiniMax-M2.7 via NVIDIA NIM provides near-instant extraction with a free tier. Pairing it with Pydantic schemas eliminates the "parsing errors" commonly associated with LLM wrappers.
*   **Separation of Concerns:** The AI does not make business decisions. The AI strictly extracts data. The Python `RoutingEngine` makes deterministic routing decisions. This prevents the AI from "hallucinating" a routing outcome and ensures auditability for the insurance company.
*   **Frontend as a First-Class Citizen:** A working backend is good, but an end-to-end solution that stakeholders can actually click on and interact with is what drives product vision forward.

---
*Built for the Junior Software Engineer assignment.*
