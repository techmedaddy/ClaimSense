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

app.mount("/static", StaticFiles(directory="static"), name="static")

parser = DocumentParser()
agent = ExtractionAgent()
router = RoutingEngine()


@app.get("/")
async def serve_dashboard():
    return FileResponse("static/index.html")


@app.post("/api/process")
async def process_claim(file: UploadFile = File(...)):
    """Process an uploaded PDF or TXT claim document."""
    allowed_extensions = [".pdf", ".txt"]
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}. Only PDF and TXT are accepted.")

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save uploaded file: {str(e)}")

    try:
        raw_text = parser.parse_file(tmp_path)
        extraction = agent.extract_claim_data(raw_text)
        final_output = router.evaluate(extraction)

        return final_output.model_dump()

    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
