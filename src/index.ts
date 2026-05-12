import dotenv from 'dotenv';
dotenv.config();

async function main() {
  console.log('--- ClaimSense Autonomous Agent Initialized ---');
  console.log('Environment:', process.env.NODE_ENV || 'development');
  
  // TODO: Implement Phase 2 (Document Ingestion)
  console.log('Ready for Phase 2: Document Ingestion');
}

main().catch(err => {
  console.error('Failed to start ClaimSense:', err);
  process.exit(1);
});
