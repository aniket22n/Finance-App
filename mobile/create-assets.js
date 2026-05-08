// Generate proper valid PNG assets for Expo
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
    let crc = 0xFFFFFFFF;
    const table = [];
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
            c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        }
        table[n] = c;
    }
    for (let i = 0; i < buf.length; i++) {
        crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

function createPNG(width, height, r, g, b) {
    // Build raw image data (filter byte + RGB pixels per row)
    const rawRows = [];
    for (let y = 0; y < height; y++) {
        const row = Buffer.alloc(1 + width * 3);
        row[0] = 0; // no filter
        for (let x = 0; x < width; x++) {
            row[1 + x * 3] = r;
            row[2 + x * 3] = g;
            row[3 + x * 3] = b;
        }
        rawRows.push(row);
    }
    const rawData = Buffer.concat(rawRows);
    const compressed = zlib.deflateSync(rawData);

    // PNG Signature
    const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

    // IHDR
    const ihdrData = Buffer.alloc(13);
    ihdrData.writeUInt32BE(width, 0);
    ihdrData.writeUInt32BE(height, 4);
    ihdrData[8] = 8;  // bit depth
    ihdrData[9] = 2;  // color type RGB
    ihdrData[10] = 0; // compression
    ihdrData[11] = 0; // filter
    ihdrData[12] = 0; // interlace
    const ihdr = makeChunk('IHDR', ihdrData);

    // IDAT
    const idat = makeChunk('IDAT', compressed);

    // IEND
    const iend = makeChunk('IEND', Buffer.alloc(0));

    return Buffer.concat([sig, ihdr, idat, iend]);
}

function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeB = Buffer.from(type, 'ascii');
    const crcInput = Buffer.concat([typeB, data]);
    const crcVal = Buffer.alloc(4);
    crcVal.writeUInt32BE(crc32(crcInput), 0);
    return Buffer.concat([len, typeB, data, crcVal]);
}

const assetsDir = path.join(__dirname, 'assets');
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

// Dark navy #1a1a2e with accent #e94560
const assets = [
    { name: 'icon.png', w: 1024, h: 1024, r: 0x1a, g: 0x1a, b: 0x2e },
    { name: 'adaptive-icon.png', w: 1024, h: 1024, r: 0x1a, g: 0x1a, b: 0x2e },
    { name: 'splash.png', w: 1284, h: 2778, r: 0x1a, g: 0x1a, b: 0x2e },
    { name: 'favicon.png', w: 48, h: 48, r: 0x1a, g: 0x1a, b: 0x2e },
];

assets.forEach(({ name, w, h, r, g, b }) => {
    const filePath = path.join(assetsDir, name);
    const png = createPNG(w, h, r, g, b);
    fs.writeFileSync(filePath, png);
    console.log(`✅ Created ${name} (${w}x${h}, ${png.length} bytes)`);
});

console.log('\nDone! All assets created with valid PNG format.');
