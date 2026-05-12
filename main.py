import os
from dotenv import load_dotenv
from services.document_parser import DocumentParser

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
        
    except Exception as e:
        print(f"Error during document ingestion: {e}")

if __name__ == '__main__':
    main()
