# 🛡️ ClaimSense: Autonomous Insurance Claims Agent

ClaimSense is an end-to-end AI-powered POC that automates the ingestion, extraction, and routing of First Notice of Loss (FNOL) insurance documents. Built to demonstrate rapid prototyping, robust system design, and production-ready thinking.

## 🚀 The Approach

Rather than just writing a script that prints text to the console, I approached this as a complete product feature. The architecture is split into four distinct phases:

1. **Document Ingestion (`pdfplumber`)**: Accurately extracts raw text from structured or unstructured FNOL PDFs and TXT files.
2. **AI Extraction Engine (`google-genai` + `Pydantic`)**: Instead of relying on brittle prompt engineering or Regex to parse AI outputs, this system uses Gemini 2.0 Flash's native `response_schema` feature. By passing strict Pydantic models to the AI, we guarantee 100% type-safe, perfectly structured JSON output every single time. No hallucinations.
3. **Deterministic Routing Engine**: A Python-based rule engine that evaluates the AI's JSON output. It enforces a strict priority hierarchy (Missing Fields -> Fraud Keywords -> Injuries -> Fast-Track thresholds) to guarantee safe and logical claim routing.
4. **Premium UI/UX (FastAPI + HTML/CSS/JS)**: A beautifully crafted, glassmorphic dashboard that allows users to drag-and-drop documents, watch the AI process them in real-time, and visualize the final claim report.

## 🛠️ Tech Stack

*   **Backend & API:** Python 3, FastAPI, Uvicorn
*   **AI / LLM:** Google GenAI (`gemini-2.0-flash`)
*   **Data Validation:** Pydantic (V2)
*   **PDF Parsing:** pdfplumber
*   **Frontend:** Vanilla HTML/CSS/JS (Zero-build pipeline for rapid POC deployment)

## ⚙️ How to Run Locally

### 1. Environment Setup
Clone the repository and set up a Python virtual environment:
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. Configure API Keys
Copy the example environment file and add your Google Gemini API key:
```bash
cp .env.example .env
```
Open `.env` and paste your key: `GOOGLE_AI_API_KEY=your_key_here`

### 3. Start the Server
Run the FastAPI application:
```bash
python app.py
```

### 4. Use the Dashboard
*   Open your browser and navigate to: `http://localhost:8000`
*   Drag and drop the provided `data/ACORD-Automobile-Loss-Notice-12.05.16.pdf` into the upload zone.
*   Click **Analyze Claim** and watch the magic happen.

## 🧠 Why This Architecture?

*   **Speed vs. Reliability:** Using `gemini-2.0-flash` provides near-instant extraction. Pairing it with Pydantic schemas eliminates the "parsing errors" commonly associated with LLM wrappers.
*   **Separation of Concerns:** The AI does not make business decisions. The AI strictly extracts data. The Python `RoutingEngine` makes deterministic routing decisions. This prevents the AI from "hallucinating" a routing outcome and ensures auditability for the insurance company.
*   **Frontend as a First-Class Citizen:** A working backend is good, but an end-to-end solution that stakeholders can actually click on and interact with is what drives product vision forward.

---
*Built for the Junior Software Engineer assignment.*
