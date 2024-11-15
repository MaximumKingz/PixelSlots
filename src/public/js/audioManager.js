class AudioManager {
    constructor() {
        this.sounds = {};
        this.isMuted = false;
        this.volume = 0.5;

        // Load sound effects
        this.loadSounds();
    }

    loadSounds() {
        const soundEffects = {
            spin: 'spin.mp3',
            win: 'win.mp3',
            bigWin: 'big-win.mp3',
            jackpot: 'jackpot.mp3',
            click: 'click.mp3',
            coinDrop: 'coin-drop.mp3',
            achievement: 'achievement.mp3'
        };

        // Preload all sounds
        Object.entries(soundEffects).forEach(([key, file]) => {
            const audio = new Audio(`/sounds/${file}`);
            audio.preload = 'auto';
            this.sounds[key] = audio;
        });
    }

    play(soundName, options = {}) {
        if (this.isMuted) return;

        const sound = this.sounds[soundName];
        if (!sound) return;

        // Clone the audio to allow multiple plays
        const audioClone = sound.cloneNode();
        
        // Apply volume
        audioClone.volume = options.volume || this.volume;

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

        // Return the audio element if we need to stop it later
        return audioClone;
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
            sound.volume = this.volume;
        });
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        if (this.isMuted) {
            this.stopAll();
        }
        return this.isMuted;
    }

    // Special sound effects
    playSpinSound() {
        return this.play('spin', { loop: true });
    }

    playWinSound(amount) {
        if (amount >= 10000) {
            return this.play('jackpot');
        } else if (amount >= 1000) {
            return this.play('bigWin');
        } else {
            return this.play('win');
        }
    }

    playClickSound() {
        return this.play('click', { volume: 0.3 });
    }

    playCoinSound() {
        return this.play('coinDrop', { volume: 0.4 });
    }

    playAchievementSound() {
        return this.play('achievement');
    }
}

// Export as singleton
window.audioManager = new AudioManager();
