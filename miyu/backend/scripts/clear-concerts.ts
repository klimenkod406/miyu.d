import { runQuery } from '../db';

async function clearConcerts() {
  try {
    console.log('Clearing concerts data...');

    await runQuery('DELETE FROM tickets');
    console.log('✓ Tickets cleared');

    await runQuery('DELETE FROM ticket_types');
    console.log('✓ Ticket types cleared');

    await runQuery('DELETE FROM concerts');
    console.log('✓ Concerts cleared');

    console.log('All concerts data cleared successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error clearing concerts:', error);
    process.exit(1);
  }
}

clearConcerts();
