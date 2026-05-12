import os
from typing import Optional
from openai import OpenAI
from models.schemas import ExtractionResultSchema

class ExtractionAgent:
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize the Extraction Agent.
        Uses the provided API key or falls back to the OPENAI_API_KEY environment variable.
        """
        self.client = OpenAI(api_key=api_key or os.getenv("OPENAI_API_KEY"))
        
        self.system_prompt = """
        You are an expert, highly meticulous Insurance Claims Adjuster and Data Extraction AI.
        Your task is to analyze First Notice of Loss (FNOL) documents and extract all relevant information 
        into a structured format.

        INSTRUCTIONS:
        1. Extract the Policy Information, Incident Details, Involved Parties, and Assets.
        2. Pay special attention to the Involved Parties: categorize them correctly (Claimant, Third Party, Witness, Insured Driver).
        3. If there are any injuries mentioned, document them carefully under the specific party.
        4. If a field is explicitly stated in the text, extract it accurately.
        5. IMPORTANT: Identify missing mandatory fields. A field is "missing" if it is logically required for a claim 
           but not present in the text (e.g., Policy Number, Incident Date/Time, Insured Name, Vehicle VIN).
           List these missing fields in the `missingMandatoryFields` array.
        6. Do not hallucinate or make up data. If data is not present, omit it or leave it null.
        """

    def extract_claim_data(self, raw_text: str) -> ExtractionResultSchema:
        """
        Takes raw document text and uses OpenAI's structured outputs to guarantee
        the response matches our Pydantic ExtractionResultSchema.
        """
        try:
            completion = self.client.beta.chat.completions.parse(
                model="gpt-4o-mini", # Cost-effective, fast, and supports structured outputs
                messages=[
                    {"role": "system", "content": self.system_prompt},
                    {"role": "user", "content": f"Here is the raw text from the FNOL document:\n\n{raw_text}"}
                ],
                response_format=ExtractionResultSchema,
                temperature=0.0 # Deterministic extraction
            )
            
            # The .parse method automatically validates and returns a Pydantic object
            return completion.choices[0].message.parsed
            
        except Exception as e:
            raise RuntimeError(f"AI Extraction failed: {str(e)}")
