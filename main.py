import os
from dotenv import load_dotenv
from services.document_parser import DocumentParser
from services.extraction_agent import ExtractionAgent

# Load environment variables
load_dotenv()

def main():
    print('--- ClaimSense Autonomous Agent Initialized ---')
    print(f"Environment: {os.getenv('NODE_ENV', 'development')}")
    
    print('\n--- Phase 2: Testing Document Ingestion ---')
    parser = DocumentParser()
    
    # Path to the sample ACORD form
    sample_pdf_path = os.path.join(os.path.dirname(__file__), 'ACORD-Automobile-Loss-Notice-12.05.16.pdf')
    
    try:
        print(f"Parsing file: {sample_pdf_path}")
        extracted_text = parser.parse_file(sample_pdf_path)
        
        print('\n--- Extraction Preview (First 500 characters) ---')
        print(extracted_text[:500])
        print('\n--- Extraction Successful ---')
        print(f"Total extracted length: {len(extracted_text)} characters.")
        
        print('\n--- Phase 3: Testing AI Extraction Engine ---')
        # Initialize the AI Agent
        agent = ExtractionAgent()
        
        print("Sending raw text to AI for structured extraction...")
        # In a real run, this requires OPENAI_API_KEY to be set in .env
        if not os.getenv("OPENAI_API_KEY") and not os.getenv("OPENAI_API_KEY") == "your_openai_key_here":
            print("⚠️ WARNING: OPENAI_API_KEY is not set in .env. Skipping actual API call to prevent crash.")
            print("Please add your API key to the .env file to see the AI extraction in action.")
        else:
            result = agent.extract_claim_data(extracted_text)
            print("\n--- AI Extraction Result (JSON) ---")
            print(result.model_dump_json(indent=2))
        
    except Exception as e:
        print(f"Error during execution: {e}")

if __name__ == '__main__':
    main()
