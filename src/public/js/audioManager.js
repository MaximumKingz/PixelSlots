class AudioManager {
    constructor() {
        this.sounds = {};
        this.isMuted = false;
        this.volume = 0.5;
        this.currentMusic = null;

        // Load sound effects
        this.loadSounds();
        this.initializeEventListeners();
    }

    loadSounds() {
        const soundEffects = {
            // Background music
            bgMusic: 'https://pixelslots.s3.amazonaws.com/sounds/retro-casino.mp3',
            
            // Game sounds
            spin: 'https://pixelslots.s3.amazonaws.com/sounds/slot-spin.mp3',
            stop: 'https://pixelslots.s3.amazonaws.com/sounds/reel-stop.mp3',
            win: 'https://pixelslots.s3.amazonaws.com/sounds/win.mp3',
            bigWin: 'https://pixelslots.s3.amazonaws.com/sounds/big-win.mp3',
            jackpot: 'https://pixelslots.s3.amazonaws.com/sounds/jackpot.mp3',
            
            // UI sounds
            click: 'https://pixelslots.s3.amazonaws.com/sounds/click.mp3',
            hover: 'https://pixelslots.s3.amazonaws.com/sounds/hover.mp3',
            coinDrop: 'https://pixelslots.s3.amazonaws.com/sounds/coin.mp3',
            achievement: 'https://pixelslots.s3.amazonaws.com/sounds/achievement.mp3',
            error: 'https://pixelslots.s3.amazonaws.com/sounds/error.mp3'
        };

        // Preload all sounds
        Object.entries(soundEffects).forEach(([key, url]) => {
            const audio = new Audio(url);
            audio.preload = 'auto';
            this.sounds[key] = audio;
        });
    }

    initializeEventListeners() {
        // Add hover sound to buttons
        document.querySelectorAll('button').forEach(button => {
            button.addEventListener('mouseenter', () => this.play('hover', { volume: 0.2 }));
            button.addEventListener('click', () => this.play('click', { volume: 0.3 }));
        });

        // Handle page visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.fadeOutMusic();
            } else {
                this.fadeInMusic();
            }
        });
    }

    play(soundName, options = {}) {
        if (this.isMuted) return;

        const sound = this.sounds[soundName];
        if (!sound) return;

        // Clone the audio to allow multiple plays
        const audioClone = sound.cloneNode();
        
        // Apply volume with fade in if specified
        if (options.fadeIn) {
            audioClone.volume = 0;
            this.fadeAudio(audioClone, options.volume || this.volume, options.fadeIn);
        } else {
            audioClone.volume = options.volume || this.volume;
        }

        // Apply any other options
        if (options.loop) audioClone.loop = true;
        if (options.playbackRate) audioClone.playbackRate = options.playbackRate;

        const playPromise = audioClone.play();

        // Handle autoplay restrictions
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.error('Audio playback failed:', error);
            });
        }

        return audioClone;
    }

    fadeAudio(audio, targetVolume, duration) {
        const steps = 20;
        const stepTime = duration / steps;
        const volumeStep = (targetVolume - audio.volume) / steps;
        
        const fadeInterval = setInterval(() => {
            if (Math.abs(audio.volume - targetVolume) < volumeStep) {
                audio.volume = targetVolume;
                clearInterval(fadeInterval);
            } else {
                audio.volume += volumeStep;
            }
        }, stepTime);
    }

    playBackgroundMusic() {
        if (this.currentMusic) return;
        
        this.currentMusic = this.play('bgMusic', {
            loop: true,
            volume: 0.3,
            fadeIn: 2000
        });
    }

    fadeOutMusic() {
        if (this.currentMusic) {
            this.fadeAudio(this.currentMusic, 0, 1000);
        }
    }

    fadeInMusic() {
        if (this.currentMusic) {
            this.fadeAudio(this.currentMusic, 0.3, 1000);
        }
    }

    stopAll() {
        Object.values(this.sounds).forEach(sound => {
            sound.pause();
            sound.currentTime = 0;
        });
    }

    setVolume(level) {
        this.volume = Math.max(0, Math.min(1, level));
        Object.values(this.sounds).forEach(sound => {
            if (sound !== this.currentMusic) {
                sound.volume = this.volume;
            }
        });
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        if (this.isMuted) {
            this.stopAll();
        } else {
            this.playBackgroundMusic();
        }
        return this.isMuted;
    }

    // Special sound effects
    playSpinSound() {
        return this.play('spin', { volume: 0.4 });
    }

    playStopSound() {
        return this.play('stop', { volume: 0.4 });
    }

    playWinSound(amount) {
        if (amount >= 1) {
            return this.play('jackpot', { volume: 0.6 });
        } else if (amount >= 0.1) {
            return this.play('bigWin', { volume: 0.5 });
        } else {
            return this.play('win', { volume: 0.4 });
        }
    }

    playErrorSound() {
        return this.play('error', { volume: 0.3 });
    }

    playCoinSound() {
        return this.play('coinDrop', { volume: 0.4, playbackRate: 1.2 });
    }

    playAchievementSound() {
        return this.play('achievement', { volume: 0.5 });
    }
}

// Initialize audio manager
window.audioManager = new AudioManager();

// Start background music on first user interaction
document.addEventListener('click', () => {
    window.audioManager.playBackgroundMusic();
}, { once: true });
