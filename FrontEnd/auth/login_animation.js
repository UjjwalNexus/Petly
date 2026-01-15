// Bullet-style Login Button Animation - Shoot Across Screen
class BulletAnimation {
    constructor() {
        this.animationInProgress = false;
    }

    startLoginAnimation() {
        if (this.animationInProgress) return;
        
        this.animationInProgress = true;
        const loginButton = document.getElementById('loginButton');
        const allButtons = document.querySelectorAll('.action-btn, .back-button button, .edit-btn');
        
        if (!loginButton) return;
        
        // Add screen shake to body for dramatic effect
        document.body.classList.add('screen-shake');
        
        // Disable all buttons during animation
        allButtons.forEach(btn => {
            btn.disabled = true;
            btn.classList.add('animating');
        });
        
        // Step 1: Create bullet sound effect
        this.createBulletSoundEffect(loginButton);
        
        // Step 2: Login button prepares (pulls back left)
        loginButton.classList.add('bullet-prepare');
        
        // Step 3: After preparing, all buttons prepare together
        setTimeout(() => {
            // Add prepare animation to all other buttons
            allButtons.forEach((btn, index) => {
                if (btn !== loginButton) {
                    setTimeout(() => {
                        btn.classList.add('all-bullets-prepare');
                    }, index * 30); // Quick stagger
                }
            });
            
            // Step 4: Shoot animations - ACROSS THE ENTIRE SCREEN
            setTimeout(() => {
                // Login button shoots first (main bullet)
                loginButton.classList.remove('bullet-prepare');
                loginButton.classList.add('bullet-shoot');
                
                // Create intense bullet trail for main button
                this.createIntenseBulletTrail(loginButton);
                
                // Create speed lines for main button
                this.createSpeedLines(loginButton);
                
                // Other buttons shoot with slight delay
                setTimeout(() => {
                    allButtons.forEach((btn, index) => {
                        if (btn !== loginButton) {
                            setTimeout(() => {
                                btn.classList.remove('all-bullets-prepare');
                                btn.classList.add('all-bullets-shoot');
                                
                                // Create bullet trails for other buttons
                                this.createBulletTrail(btn);
                            }, index * 60); // Staggered shooting
                        }
                    });
                    
                    // Step 5: Show transition overlay
                    setTimeout(() => {
                        const transitionOverlay = document.getElementById('pageTransition');
                        if (transitionOverlay) {
                            transitionOverlay.classList.add('active');
                        }
                    }, 400);
                    
                    // Step 6: Redirect to sign_in.html
                    setTimeout(() => {
                        window.location.href = 'sign_in.html';
                    }, 1200); // Total animation time (1.2 seconds)
                    
                }, 200); // Delay before other buttons shoot
                
            }, 200); // Delay between prepare and shoot
            
            // Remove screen shake after animation
            setTimeout(() => {
                document.body.classList.remove('screen-shake');
            }, 700);
            
        }, 500); // Wait for login button to prepare
    }

    createBulletSoundEffect(button) {
        const wave = document.createElement('div');
        wave.className = 'sound-wave';
        button.appendChild(wave);
        
        setTimeout(() => {
            if (button.contains(wave)) {
                button.removeChild(wave);
            }
        }, 400);
    }

    createIntenseBulletTrail(button) {
        // Create multiple trails for main button
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                this.createTrail(button, i * 50);
            }, i * 50);
        }
    }

    createTrail(button, delay) {
        setTimeout(() => {
            const rect = button.getBoundingClientRect();
            const trail = document.createElement('div');
            trail.className = 'bullet-trail';
            trail.style.left = `${rect.left + rect.width/2 - 4}px`;
            trail.style.top = `${rect.top + rect.height/2 - 4}px`;
            document.body.appendChild(trail);
            
            setTimeout(() => {
                if (document.body.contains(trail)) {
                    document.body.removeChild(trail);
                }
            }, 600);
        }, delay);
    }

    createBulletTrail(button) {
        const rect = button.getBoundingClientRect();
        const trail = document.createElement('div');
        trail.className = 'bullet-trail';
        trail.style.left = `${rect.left + rect.width/2 - 4}px`;
        trail.style.top = `${rect.top + rect.height/2 - 4}px`;
        trail.style.background = 'rgba(255, 255, 255, 0.7)';
        trail.style.boxShadow = '0 0 10px 3px rgba(255, 255, 255, 0.5)';
        document.body.appendChild(trail);
        
        setTimeout(() => {
            if (document.body.contains(trail)) {
                document.body.removeChild(trail);
            }
        }, 500);
    }

    createSpeedLines(button) {
        const rect = button.getBoundingClientRect();
        
        // Create 3 speed lines at different positions
        for (let i = 0; i < 3; i++) {
            const line = document.createElement('div');
            line.className = 'speed-line';
            line.style.top = `${rect.top + (rect.height/4 * (i+1))}px`;
            line.style.left = `${rect.left}px`;
            document.body.appendChild(line);
            
            // Activate the line
            setTimeout(() => {
                line.classList.add('active');
            }, 10);
            
            // Remove after animation
            setTimeout(() => {
                if (document.body.contains(line)) {
                    document.body.removeChild(line);
                }
            }, 800);
        }
    }

    resetAnimations() {
        const allButtons = document.querySelectorAll('.action-btn, .back-button button, .edit-btn');
        
        allButtons.forEach(btn => {
            btn.classList.remove(
                'bullet-prepare', 
                'bullet-shoot', 
                'all-bullets-prepare', 
                'all-bullets-shoot',
                'animating'
            );
            btn.disabled = false;
            btn.style.transform = '';
            btn.style.opacity = '1';
            btn.style.visibility = 'visible';
        });
        
        // Remove any leftover effects
        document.querySelectorAll('.bullet-trail, .sound-wave, .speed-line').forEach(el => {
            el.remove();
        });
        
        document.body.classList.remove('screen-shake');
        
        const transitionOverlay = document.getElementById('pageTransition');
        if (transitionOverlay) {
            transitionOverlay.classList.remove('active');
        }
        
        this.animationInProgress = false;
    }
}

// Create global animation controller
window.bulletAnimation = new BulletAnimation();

// Export animation functions for use in profile.html
function startLoginAnimation() {
    window.bulletAnimation.startLoginAnimation();
}

function resetButtonAnimations() {
    window.bulletAnimation.resetAnimations();
}