class ParticleSystem {
    constructor() {
        this.particles = [];
        this.container = document.createElement('div');
        this.container.id = 'particle-container';
        this.container.style.position = 'fixed';
        this.container.style.top = '0';
        this.container.style.left = '0';
        this.container.style.width = '100%';
        this.container.style.height = '100%';
        this.container.style.pointerEvents = 'none';
        this.container.style.zIndex = '9999';
        document.body.appendChild(this.container);
    }

    createParticle(options = {}) {
        const particle = document.createElement('div');
        particle.className = options.className || 'particle';
        
        // Set initial position
        particle.style.position = 'absolute';
        particle.style.left = options.x + 'px';
        particle.style.top = options.y + 'px';

        // Set size
        particle.style.width = (options.size || 8) + 'px';
        particle.style.height = (options.size || 8) + 'px';

        // Set appearance
        if (options.color) {
            particle.style.backgroundColor = options.color;
        }
        if (options.image) {
            particle.style.backgroundImage = `url(${options.image})`;
            particle.style.backgroundSize = 'contain';
        }

        // Add to container
        this.container.appendChild(particle);

        // Store particle data
        const particleData = {
            element: particle,
            x: options.x,
            y: options.y,
            vx: options.vx || 0,
            vy: options.vy || 0,
            gravity: options.gravity || 0,
            life: options.life || 1000,
            rotation: options.rotation || 0,
            rotationSpeed: options.rotationSpeed || 0,
            created: Date.now()
        };

        this.particles.push(particleData);
        return particleData;
    }

    update() {
        const now = Date.now();
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            
            // Check if particle should be removed
            if (now - p.created > p.life) {
                p.element.remove();
                this.particles.splice(i, 1);
                continue;
            }

            // Update position
            p.vy += p.gravity;
            p.x += p.vx;
            p.y += p.vy;
            p.rotation += p.rotationSpeed;

            // Update element
            p.element.style.transform = `translate(${p.x}px, ${p.y}px) rotate(${p.rotation}deg)`;
        }

        // Continue animation if particles exist
        if (this.particles.length > 0) {
            requestAnimationFrame(() => this.update());
        }
    }

    createCoinBurst(x, y, count = 20) {
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count;
            const speed = 5 + Math.random() * 5;
            const size = 24;

            this.createParticle({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 10,
                gravity: 0.5,
                size,
                life: 1000 + Math.random() * 1000,
                rotation: Math.random() * 360,
                rotationSpeed: Math.random() * 10 - 5,
                className: 'coin-particle',
                image: '/images/symbols/coin-particle.png'
            });
        }
        this.update();
    }

    createJackpotBurst(x, y) {
        // Create central burst
        const burst = document.createElement('div');
        burst.className = 'jackpot-burst';
        this.container.appendChild(burst);

        // Create particles in all directions
        for (let i = 0; i < 50; i++) {
            const angle = (Math.PI * 2 * i) / 50;
            const speed = 10 + Math.random() * 10;

            this.createParticle({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                gravity: 0.2,
                size: 12 + Math.random() * 12,
                life: 2000 + Math.random() * 1000,
                color: '#ffd700',
                className: 'star-particle'
            });
        }

        // Remove burst element after animation
        setTimeout(() => burst.remove(), 1000);
        this.update();
    }

    createWinLines(lines) {
        lines.forEach(line => {
            const winLine = document.createElement('div');
            winLine.className = 'win-line';
            winLine.style.top = line.y + 'px';
            winLine.style.left = line.x1 + 'px';
            winLine.style.width = (line.x2 - line.x1) + 'px';
            this.container.appendChild(winLine);

            // Remove line after animation
            setTimeout(() => winLine.remove(), 2000);
        });
    }

    clear() {
        this.particles.forEach(p => p.element.remove());
        this.particles = [];
        this.container.innerHTML = '';
    }
}

// Export as singleton
window.particleSystem = new ParticleSystem();
