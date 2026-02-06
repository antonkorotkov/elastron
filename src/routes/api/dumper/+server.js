import { json } from '@sveltejs/kit';
import ElasticDump from 'elasticdump';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { pipeline } from 'stream/promises';
import { createWriteStream, createReadStream } from 'fs';

// Helper to Options class from app/dumper/Options.js
// We might need to copy/import that logic or reimplement it.
// For now, assume we receive processed options or reimplement basics.
// In original: `new Options(options)`
import { Options } from '$lib/api/Options.js'; // We need to move Options.js to lib

export async function POST({ request }) {
    const type = request.headers.get('x-dumper-type'); // 'import' or 'export'

    if (type === 'import') {
        return handleImport(request);
    } else if (type === 'export') {
        // For export, we might need a different approach (GET or POST returning stream)
        // But original dumper used dialog to save file.
        // Here we return the file stream.
        return handleExport(request);
    }

    return json({ error: 'Invalid type' }, { status: 400 });
}

async function handleImport(request) {
    // 1. Stream uploaded file to temp
    const tmpDir = os.tmpdir();
    const tmpFilePath = path.join(tmpDir, `elastron-import-${Date.now()}.json`);

    // request.body is a ReadableStream (Web Standard)
    // We pipeline it to fs.createWriteStream
    try {
        if (!request.body) throw new Error('No body');
        // Convert Web Stream to Node Stream if needed, or pipeline supports it in Node 18+
        // standard pipeline supports AsyncIterable which Web ReadableStream is compatible with in recent Node
        await pipeline(request.body, createWriteStream(tmpFilePath));

        // 2. Run ElasticDump
        // We need 'options' but they are not in the body (body is file).
        // We can pass options in headers or query params.
        const optionsStr = request.headers.get('x-dumper-options');
        const options = JSON.parse(optionsStr || '{}');

        // Set input to temp file
        options.input = tmpFilePath;

        const dumperOptions = new Options(options);
        const dumper = new ElasticDump(dumperOptions.options);

        // Events
        dumper.on('log', message => console.log('DUMPER LOG:', message));
        dumper.on('error', error => console.error('DUMPER ERROR:', error));

        await new Promise((resolve, reject) => {
            dumper.dump((err) => {
                if (err) reject(err);
                else resolve(true);
            });
        });

        // 3. Cleanup
        fs.unlinkSync(tmpFilePath);

        return json({ success: true });

    } catch (e) {
        if (fs.existsSync(tmpFilePath)) fs.unlinkSync(tmpFilePath);
        return json({ error: e.message }, { status: 500 });
    }
}

async function handleExport(request) {
    const { options } = await request.json();

    // 1. Setup temp file for output (Elasticdump needs file output usually, or stdout)
    // Elasticdump can write to file.
    const tmpDir = os.tmpdir();
    const tmpFilePath = path.join(tmpDir, `elastron-export-${Date.now()}.json`);

    const dumperOptions = new Options(options);
    dumperOptions.options.output = tmpFilePath; // Override output to temp file

    const dumper = new ElasticDump(dumperOptions.options);

    try {
        await new Promise((resolve, reject) => {
            dumper.dump((err) => {
                if (err) reject(err);
                else resolve(true);
            });
        });

        // 2. Stream back to client
        const stream = createReadStream(tmpFilePath);

        // Cleanup listener: when stream ends, delete file
        stream.on('close', () => {
            if (fs.existsSync(tmpFilePath)) fs.unlinkSync(tmpFilePath);
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'application/json',
                'Content-Disposition': `attachment; filename="export.json"`
            }
        });
    } catch (e) {
        if (fs.existsSync(tmpFilePath)) fs.unlinkSync(tmpFilePath);
        return json({ error: e.message }, { status: 500 });
    }
}
