import os
import json
from typing import Optional
from google import genai
from google.genai import types
from models.schemas import ExtractionResultSchema

class ExtractionAgent:
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize the Extraction Agent.
        Uses the provided API key or falls back to the GOOGLE_AI_API_KEY environment variable.
        """
        self._api_key = api_key
        self._client = None

        self.system_prompt = """
        You are an expert, highly meticulous Insurance Claims Adjuster and Data Extraction AI.
        Your task is to analyze First Notice of Loss (FNOL) documents and extract all relevant information 
        into a structured format.

        INSTRUCTIONS:
        1. Extract the Policy Information, Incident Details, Involved Parties, and Assets.
        2. Pay special attention to the Involved Parties: categorize them correctly as one of: "Claimant", "Third Party", "Witness", "Insured Driver".
        3. If there are any injuries mentioned, document them carefully under the specific party.
        4. If a field is explicitly stated in the text, extract it accurately.
        5. IMPORTANT: Identify missing mandatory fields. A field is "missing" if it is logically required for a claim 
           but not present in the text (e.g., Policy Number, Incident Date/Time, Insured Name, Vehicle VIN).
           List these missing fields in the `missingMandatoryFields` array.
        6. Do not hallucinate or make up data. If data is not present, omit it or leave it null.
        7. For estimatedDamage, provide a numeric dollar amount if mentioned, otherwise null.
        """

    def extract_claim_data(self, raw_text: str) -> ExtractionResultSchema:
        """
        Takes raw document text and uses Google Gemini's structured outputs to guarantee
        the response matches our Pydantic ExtractionResultSchema.
        """
        # Lazy-init the client on first use
        if self._client is None:
            key = self._api_key or os.getenv("GOOGLE_AI_API_KEY")
            if not key:
                raise RuntimeError("GOOGLE_AI_API_KEY is not set. Please add it to your .env file.")
            self._client = genai.Client(api_key=key)

        try:
            response = self._client.models.generate_content(
                model="gemini-2.0-flash",
                contents=f"Here is the raw text from the FNOL document:\n\n{raw_text}",
                config=types.GenerateContentConfig(
                    system_instruction=self.system_prompt,
                    response_mime_type="application/json",
                    response_schema=ExtractionResultSchema,
                    temperature=0.0,
                ),
            )

            # Parse the JSON response into our Pydantic model
            parsed = json.loads(response.text)
            return ExtractionResultSchema.model_validate(parsed)

        except json.JSONDecodeError as e:
            raise RuntimeError(f"AI returned invalid JSON: {str(e)}")
        except Exception as e:
            raise RuntimeError(f"AI Extraction failed: {str(e)}")
