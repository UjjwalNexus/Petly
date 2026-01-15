// card-animation.js
// Optimized cinematic card animation - FIXED SMOOTHNESS AFTER ROTATION

(function() {
    'use strict';
    
    let isAnyAnimationRunning = false;
    let freezeLayer = null;
    let clonedTile = null;
    
    // OPTIMIZED CONFIG FOR SMOOTHNESS
    const CONFIG = {
        totalDuration: 2600, // Slightly reduced for better flow
        jumpDuration: 700,
        rotateDuration: 700, // Reduced for smoother transition
        flyDuration: 700,    // Increased for smoother flight
        expandDuration: 500,
        
        jumpHeight: 120,
        rotateDegrees: 360,
        tiltAngle: 85,
        expandScale: 50,
        
        acceleratedProps: 'transform'
    };
    
    const activeAnimations = new WeakMap();
    const originalTilePositions = new WeakMap();
    
    document.addEventListener('DOMContentLoaded', initialize);
    
    function initialize() {
        const tiles = document.querySelectorAll('.tile');
        
        tiles.forEach(tile => {
            if (!tile.hasAttribute('data-target')) return;
            
            tile.style.cursor = 'pointer';
            tile.style.willChange = 'transform';
            
            activeAnimations.set(tile, {
                isAnimating: false
            });
            
            tile.addEventListener('click', handleTileClick, { passive: false });
        });
    }
    
    function handleTileClick(event) {
        if (isAnyAnimationRunning) {
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        
        const tile = event.currentTarget;
        const state = activeAnimations.get(tile);
        
        if (state && state.isAnimating) {
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        
        const targetPage = tile.getAttribute('data-target');
        if (!targetPage) return;
        
        storeOriginalTilePositions();
        createAnimationClone(tile);
        freezeScreen(tile);
        animateTile(clonedTile, targetPage, tile);
        
        event.preventDefault();
        event.stopPropagation();
    }
    
    function storeOriginalTilePositions() {
        const allTiles = document.querySelectorAll('.tile');
        allTiles.forEach(tile => {
            const rect = tile.getBoundingClientRect();
            originalTilePositions.set(tile, {
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height
            });
        });
    }
    
    function createAnimationClone(originalTile) {
        clonedTile = originalTile.cloneNode(true);
        const rect = originalTile.getBoundingClientRect();
        
        clonedTile.style.position = 'fixed';
        clonedTile.style.left = rect.left + 'px';
        clonedTile.style.top = rect.top + 'px';
        clonedTile.style.width = rect.width + 'px';
        clonedTile.style.height = rect.height + 'px';
        clonedTile.style.zIndex = '9999';
        clonedTile.style.pointerEvents = 'none';
        clonedTile.style.transformOrigin = 'center center';
        clonedTile.style.willChange = 'transform'; // ONLY TRANSFORM FOR PERFORMANCE
        
        // GPU ACCELERATION - CRITICAL FOR SMOOTHNESS
        clonedTile.style.transform = 'translate3d(0, 0, 0)';
        
        clonedTile.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
        clonedTile.style.backdropFilter = 'blur(10px) saturate(180%)';
        clonedTile.style.webkitBackdropFilter = 'blur(10px) saturate(180%)';
        clonedTile.style.border = '1px solid rgba(255, 255, 255, 0.2)';
        clonedTile.style.boxShadow = 'inset 0 0 20px rgba(255, 255, 255, 0.1)';
        clonedTile.style.color = 'rgba(255, 255, 255, 0.9)';
        
        // PREVENT LAYOUT THRASHING - Set all styles at once
        clonedTile.style.cssText += ';transition: none !important;';
        
        document.body.appendChild(clonedTile);
    }
    
    function freezeScreen(activeTile) {
        isAnyAnimationRunning = true;
        document.body.style.overflow = 'hidden';
        
        freezeLayer = document.createElement('div');
        freezeLayer.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 9998;
            pointer-events: none;
            background-color: rgba(15, 23, 42, 0.3);
            backdrop-filter: blur(2px);
            -webkit-backdrop-filter: blur(2px);
        `;
        
        document.body.appendChild(freezeLayer);
        
        const allTiles = document.querySelectorAll('.tile');
        allTiles.forEach(tile => {
            if (tile === activeTile) {
                tile.style.visibility = 'hidden';
                tile.style.opacity = '0';
            } else {
                const originalPos = originalTilePositions.get(tile);
                if (originalPos) {
                    // FIXED POSITIONING - NO TRANSITION DURING ANIMATION
                    tile.style.cssText += `
                        position: fixed !important;
                        left: ${originalPos.left}px !important;
                        top: ${originalPos.top}px !important;
                        width: ${originalPos.width}px !important;
                        height: ${originalPos.height}px !important;
                        margin: 0 !important;
                        transition: none !important;
                        pointer-events: none !important;
                        opacity: 0.6 !important;
                        filter: grayscale(70%) blur(1px) !important;
                        cursor: not-allowed !important;
                    `;
                }
            }
        });
    }
    
    function unfreezeScreen() {
        isAnyAnimationRunning = false;
        document.body.style.overflow = '';
        
        if (freezeLayer && freezeLayer.parentNode) {
            freezeLayer.parentNode.removeChild(freezeLayer);
        }
        
        if (clonedTile && clonedTile.parentNode) {
            clonedTile.parentNode.removeChild(clonedTile);
        }
        
        const allTiles = document.querySelectorAll('.tile');
        allTiles.forEach(tile => {
            tile.style.cssText = ''; // Reset all styles
        });
    }
    
    function animateTile(tile, targetPage, originalTile) {
        const state = activeAnimations.get(originalTile);
        if (state) state.isAnimating = true;
        
        const startTime = performance.now();
        let isRotateComplete = false;
        
        function animateAllPhases(currentTime) {
            const elapsed = currentTime - startTime;
            const totalProgress = Math.min(elapsed / CONFIG.totalDuration, 1);
            
            if (totalProgress < 0.27) {
                // JUMP PHASE
                const jumpProgress = totalProgress / 0.27;
                animateJump(tile, jumpProgress);
            } else if (totalProgress < 0.54) {
                // ROTATION PHASE - SMOOTH TRANSITION IS KEY
                const rotateProgress = (totalProgress - 0.27) / 0.27;
                isRotateComplete = animateRotation(tile, rotateProgress);
            } else if (totalProgress < 0.81) {
                // FLY PHASE - MUST BE BUTTER SMOOTH
                const flyProgress = (totalProgress - 0.54) / 0.27;
                animateFly(tile, flyProgress, isRotateComplete);
            } else {
                // EXPAND PHASE
                const expandProgress = (totalProgress - 0.81) / 0.19;
                animateExpand(tile, expandProgress);
            }
            
            if (totalProgress < 1) {
                requestAnimationFrame(animateAllPhases);
            } else {
                setTimeout(() => {
                    unfreezeScreen();
                    if (state) state.isAnimating = false;
                    window.location.href = targetPage;
                }, 200);
            }
        }
        
        requestAnimationFrame(animateAllPhases);
    }
    
    function animateJump(tile, progress) {
        // Smooth double jump
        const jump1 = Math.sin(progress * Math.PI * 2) * CONFIG.jumpHeight;
        const jump2 = Math.sin(progress * Math.PI * 4) * CONFIG.jumpHeight * 0.4;
        const jumpHeight = (jump1 + jump2) / 1.4;
        
        const scale = 1 + Math.sin(progress * Math.PI) * 0.1;
        
        // USE translate3d FOR HARDWARE ACCELERATION
        tile.style.transform = `translate3d(0, ${-jumpHeight}px, 0) scale(${scale})`;
    }
    
    function animateRotation(tile, progress) {
        // SMOOTH CUBIC EASING FOR ROTATION
        const easeProgress = progress < 0.5 
            ? 2 * progress * progress 
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        
        const rotation = easeProgress * CONFIG.rotateDegrees;
        
        // Fade text gradually - but DON'T change other styles
        if (progress > 0.3) {
            const textFade = Math.min((progress - 0.3) / 0.7, 1);
            tile.style.color = `rgba(255, 255, 255, ${0.9 * (1 - textFade)})`;
        }
        
        // SMOOTH ROTATION WITH translate3d
        tile.style.transform = `rotateY(${rotation}deg) translate3d(0, 0, 0)`;
        
        // Return true when rotation is almost complete for smooth transition
        return progress > 0.9;
    }
    
    function animateFly(tile, progress, isRotateComplete) {
        // CRITICAL: SMOOTH LINEAR INTERPOLATION FOR FLIGHT
        // Use simple linear easing to prevent jerkiness
        const easeProgress = progress;
        
        const viewportCenterX = window.innerWidth / 2;
        const viewportCenterY = window.innerHeight / 2;
        
        const rect = tile.getBoundingClientRect();
        const currentX = rect.left + rect.width / 2;
        const currentY = rect.top + rect.height / 2;
        
        // SMOOTH LINEAR MOVEMENT
        const moveX = currentX + (viewportCenterX - currentX) * easeProgress;
        const moveY = currentY + (viewportCenterY - currentY) * easeProgress;
        
        // SMOOTH TILT TRANSITION
        const tilt = easeProgress * CONFIG.tiltAngle;
        
        // SMOOTH SCALE TRANSITION
        const scale = 1 + easeProgress * 1.5;
        
        // MOVE WITH translate3d FOR MAXIMUM SMOOTHNESS
        tile.style.left = moveX + 'px';
        tile.style.top = moveY + 'px';
        
        // CRITICAL: Single transform property, minimal operations
        tile.style.transform = `translate3d(-50%, -50%, 0) rotateX(${tilt}deg) scale(${scale})`;
        
        // Minimal style changes during flight
        if (progress > 0.5) {
            tile.style.color = 'transparent';
            tile.style.backgroundColor = `rgba(255, 255, 255, ${0.15 + progress * 0.2})`;
        }
        
        // Remove expensive filters that cause lag
        if (progress > 0.7) {
            tile.style.backdropFilter = 'blur(15px)';
            tile.style.webkitBackdropFilter = 'blur(15px)';
        }
    }
    
    function animateExpand(tile, progress) {
        // Smooth expansion with cubic easing
        const easeProgress = progress * progress * (3 - 2 * progress);
        const scale = 2.5 + (CONFIG.expandScale - 2.5) * easeProgress;
        
        // Center position
        tile.style.left = '50%';
        tile.style.top = '50%';
        
        // SMOOTH FINAL TRANSFORM
        tile.style.transform = `translate3d(-50%, -50%, 0) rotateX(${CONFIG.tiltAngle}deg) scale(${scale})`;
        
        // Only update opacity and background at the end
        tile.style.backgroundColor = `rgba(255, 255, 255, ${0.35 + easeProgress * 0.6})`;
        
        if (progress > 0.9) {
            tile.style.boxShadow = '0 0 200px rgba(255, 255, 255, 0.4)';
        }
    }
    
    window.addEventListener('beforeunload', () => {
        if (isAnyAnimationRunning) {
            unfreezeScreen();
        }
    });
    
    window.cardAnimation = {
        trigger: (tileElement) => {
            if (tileElement.classList.contains('tile')) {
                const target = tileElement.getAttribute('data-target');
                if (target) {
                    storeOriginalTilePositions();
                    createAnimationClone(tileElement);
                    freezeScreen(tileElement);
                    animateTile(clonedTile, target, tileElement);
                }
            }
        },
        isAnimationRunning: () => isAnyAnimationRunning
    };
    
})();