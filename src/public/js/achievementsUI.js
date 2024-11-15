class AchievementsUI {
    constructor() {
        this.achievementsContainer = document.getElementById('achievements-container');
        this.achievementsList = document.getElementById('achievements-list');
        this.closeAchievements = document.getElementById('close-achievements');
        this.achievementPopup = document.getElementById('achievement-popup');
        this.categories = ['beginner', 'milestone', 'jackpot', 'daily', 'special'];
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.closeAchievements.addEventListener('click', () => {
            this.hideAchievements();
        });
    }

    showAchievements(achievements) {
        this.achievementsList.innerHTML = '';
        this.achievementsContainer.classList.remove('hidden');

        // Create category containers
        const categoryContainers = {};
        this.categories.forEach(category => {
            const container = document.createElement('div');
            container.className = 'achievement-category';
            container.innerHTML = `
                <h3>${this.formatCategoryName(category)}</h3>
                <div class="achievements-grid" id="${category}-achievements"></div>
            `;
            categoryContainers[category] = container;
            this.achievementsList.appendChild(container);
        });

        // Add achievements to their categories
        Object.values(achievements).forEach(achievement => {
            const achievementElement = this.createAchievementElement(achievement);
            const categoryContainer = categoryContainers[achievement.category]
                .querySelector('.achievements-grid');
            categoryContainer.appendChild(achievementElement);
        });

        // Remove empty categories
        this.categories.forEach(category => {
            const container = categoryContainers[category];
            const grid = container.querySelector('.achievements-grid');
            if (!grid.children.length) {
                container.remove();
            }
        });
    }

    createAchievementElement(achievement) {
        const element = document.createElement('div');
        element.className = `achievement-item ${achievement.isUnlocked ? 'unlocked' : ''}`;
        
        const progressPercent = Math.round(achievement.progress * 100);
        const progressBarWidth = achievement.isUnlocked ? 100 : progressPercent;
        
        element.innerHTML = `
            <div class="achievement-icon">${achievement.icon}</div>
            <div class="achievement-info">
                <h4>${achievement.name}</h4>
                <p>${achievement.description}</p>
                <div class="achievement-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progressBarWidth}%"></div>
                    </div>
                    <span class="progress-text">${progressPercent}%</span>
                </div>
                <div class="achievement-reward">
                    <span class="reward-amount">+${achievement.reward} Tokens</span>
                    ${achievement.streakBonus ? '<span class="streak-bonus">+Streak Bonus</span>' : ''}
                </div>
            </div>
        `;

        // Add tooltip for streak bonus if applicable
        if (achievement.streakBonus) {
            const streakBonus = element.querySelector('.streak-bonus');
            streakBonus.title = 'Additional bonus based on your login streak';
        }

        return element;
    }

    formatCategoryName(category) {
        return category.charAt(0).toUpperCase() + category.slice(1) + ' Achievements';
    }

    hideAchievements() {
        this.achievementsContainer.classList.add('hidden');
    }

    showAchievementUnlock(achievement) {
        // Update achievement popup content
        const nameElement = this.achievementPopup.querySelector('#achievement-name');
        const rewardElement = this.achievementPopup.querySelector('#achievement-reward');
        
        nameElement.textContent = achievement.name;
        rewardElement.textContent = `+${achievement.reward} Tokens`;
        
        // Show the popup
        this.achievementPopup.classList.remove('hidden');
        
        // Add animation classes
        this.achievementPopup.classList.add('achievement-popup-show');
        
        // Play achievement sound if available
        if (window.audioManager) {
            window.audioManager.playAchievementSound();
        }

        // Create particle effect
        if (window.particleSystem) {
            const rect = this.achievementPopup.getBoundingClientRect();
            window.particleSystem.createAchievementBurst(
                rect.left + rect.width / 2,
                rect.top + rect.height / 2
            );
        }
        
        // Hide after animation
        setTimeout(() => {
            this.achievementPopup.classList.remove('achievement-popup-show');
            this.achievementPopup.classList.add('achievement-popup-hide');
            
            setTimeout(() => {
                this.achievementPopup.classList.add('hidden');
                this.achievementPopup.classList.remove('achievement-popup-hide');
            }, 500);
        }, 5000);
    }

    updateProgress(achievementId, progress) {
        const achievementElement = this.achievementsList
            .querySelector(`[data-achievement-id="${achievementId}"]`);
        
        if (achievementElement) {
            const progressBar = achievementElement.querySelector('.progress-fill');
            const progressText = achievementElement.querySelector('.progress-text');
            const progressPercent = Math.round(progress * 100);
            
            progressBar.style.width = `${progressPercent}%`;
            progressText.textContent = `${progressPercent}%`;
            
            if (progress >= 1) {
                achievementElement.classList.add('unlocked');
            }
        }
    }
}

// Initialize achievements UI when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.achievementsUI = new AchievementsUI();
});
