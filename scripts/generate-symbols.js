const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const SYMBOL_SIZE = 64;
const symbols = [
    {
        name: 'cherry',
        color: '#FF0000',
        draw: (ctx) => {
            // Cherry body
            ctx.fillStyle = '#FF0000';
            ctx.beginPath();
            ctx.arc(32, 40, 12, 0, Math.PI * 2);
            ctx.fill();

            // Cherry stem
            ctx.strokeStyle = '#4CAF50';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(32, 28);
            ctx.quadraticCurveTo(45, 20, 40, 10);
            ctx.stroke();
        }
    },
    {
        name: 'lemon',
        color: '#FFD700',
        draw: (ctx) => {
            // Lemon body
            ctx.fillStyle = '#FFD700';
            ctx.beginPath();
            ctx.ellipse(32, 32, 20, 15, 0, 0, Math.PI * 2);
            ctx.fill();
        }
    },
    {
        name: 'orange',
        color: '#FFA500',
        draw: (ctx) => {
            // Orange body
            ctx.fillStyle = '#FFA500';
            ctx.beginPath();
            ctx.arc(32, 32, 15, 0, Math.PI * 2);
            ctx.fill();

            // Leaf
            ctx.fillStyle = '#4CAF50';
            ctx.beginPath();
            ctx.moveTo(32, 15);
            ctx.lineTo(38, 10);
            ctx.lineTo(32, 18);
            ctx.fill();
        }
    },
    {
        name: 'plum',
        color: '#800080',
        draw: (ctx) => {
            // Plum body
            ctx.fillStyle = '#800080';
            ctx.beginPath();
            ctx.arc(32, 35, 15, 0, Math.PI * 2);
            ctx.fill();

            // Highlight
            ctx.fillStyle = '#FFFFFF33';
            ctx.beginPath();
            ctx.arc(28, 30, 5, 0, Math.PI * 2);
            ctx.fill();
        }
    },
    {
        name: 'bell',
        color: '#FFD700',
        draw: (ctx) => {
            // Bell body
            ctx.fillStyle = '#FFD700';
            ctx.beginPath();
            ctx.moveTo(20, 45);
            ctx.quadraticCurveTo(32, 15, 44, 45);
            ctx.closePath();
            ctx.fill();

            // Bell bottom
            ctx.fillStyle = '#8B4513';
            ctx.beginPath();
            ctx.arc(32, 45, 5, 0, Math.PI * 2);
            ctx.fill();
        }
    },
    {
        name: 'seven',
        color: '#FF0000',
        draw: (ctx) => {
            // Number 7
            ctx.fillStyle = '#FF0000';
            ctx.font = 'bold 48px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('7', 32, 32);
        }
    },
    {
        name: 'diamond',
        color: '#00FFFF',
        draw: (ctx) => {
            // Diamond shape
            ctx.fillStyle = '#00FFFF';
            ctx.beginPath();
            ctx.moveTo(32, 10);
            ctx.lineTo(50, 32);
            ctx.lineTo(32, 54);
            ctx.lineTo(14, 32);
            ctx.closePath();
            ctx.fill();

            // Highlight
            ctx.fillStyle = '#FFFFFF33';
            ctx.beginPath();
            ctx.moveTo(32, 15);
            ctx.lineTo(45, 32);
            ctx.lineTo(32, 49);
            ctx.lineTo(19, 32);
            ctx.closePath();
            ctx.fill();
        }
    },
    {
        name: 'bitcoin',
        color: '#F7931A',
        draw: (ctx) => {
            // Bitcoin symbol
            ctx.fillStyle = '#F7931A';
            ctx.font = 'bold 40px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('₿', 32, 32);
        }
    },
    {
        name: 'coin-particle',
        color: '#FFD700',
        draw: (ctx) => {
            // Coin body
            ctx.fillStyle = '#FFD700';
            ctx.beginPath();
            ctx.arc(32, 32, 12, 0, Math.PI * 2);
            ctx.fill();

            // Dollar sign
            ctx.fillStyle = '#000000';
            ctx.font = 'bold 20px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('$', 32, 32);
        }
    }
];

// Create output directory if it doesn't exist
const outputDir = path.join(__dirname, '../src/public/images/symbols');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// Generate each symbol
symbols.forEach(symbol => {
    const canvas = createCanvas(SYMBOL_SIZE, SYMBOL_SIZE);
    const ctx = canvas.getContext('2d');

    // Clear canvas
    ctx.clearRect(0, 0, SYMBOL_SIZE, SYMBOL_SIZE);

    // Draw symbol
    symbol.draw(ctx);

    // Save to file
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(path.join(outputDir, `${symbol.name}.png`), buffer);
    console.log(`Generated ${symbol.name}.png`);
});

console.log('All symbols generated successfully!');
