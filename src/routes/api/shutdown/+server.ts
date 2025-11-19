import { json } from '@sveltejs/kit';

export async function POST() {
    console.log('\x1b[31m%s\x1b[0m', '🛑 Browser closed. Shutting down TXT-FORGE...');

    // Delay slightly to allow the response to finish sending
    setTimeout(() => {
        process.exit(0);
    }, 100);

    return json({ success: true });
}
