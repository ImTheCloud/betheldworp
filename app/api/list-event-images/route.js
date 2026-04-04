import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
    try {
        const eventsDir = path.join(process.cwd(), 'public', 'images', 'events');
        
        // Ensure directory exists
        if (!fs.existsSync(eventsDir)) {
            return NextResponse.json([]);
        }

        const files = fs.readdirSync(eventsDir);
        
        // Filter for common image extensions
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'];
        const images = files.filter(file => 
            imageExtensions.includes(path.extname(file).toLowerCase())
        ).sort();

        return NextResponse.json(images);
    } catch (error) {
        console.error('Error listing event images:', error);
        return NextResponse.json({ error: 'Failed to list images' }, { status: 500 });
    }
}
