import os
import tempfile
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv

from services.document_parser import DocumentParser
from services.extraction_agent import ExtractionAgent
from services.routing_engine import RoutingEngine

load_dotenv()

app = FastAPI(title="ClaimSense", description="Autonomous Insurance Claims Processing Agent")

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Initialize services
parser = DocumentParser()
agent = ExtractionAgent()
router = RoutingEngine()


@app.get("/")
async def serve_dashboard():
    """Serve the main dashboard."""
    return FileResponse("static/index.html")


@app.post("/api/process")
async def process_claim(file: UploadFile = File(...)):
    """
    Accept a PDF or TXT file, extract claim data via AI,
    apply routing rules, and return the full JSON report.
    """
    # Validate file type
    allowed_extensions = [".pdf", ".txt"]
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}. Only PDF and TXT are accepted.")

    # Save the uploaded file to a temp location
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save uploaded file: {str(e)}")

    try:
        # Phase 2: Parse
        raw_text = parser.parse_file(tmp_path)

        # Phase 3: AI Extraction
        extraction = agent.extract_claim_data(raw_text)

        # Phase 4: Routing
        final_output = router.evaluate(extraction)

        return final_output.model_dump()

    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")
    finally:
        # Clean up temp file
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
