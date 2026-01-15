// Custom Cursor System - Global JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // Check if cursor system is already initialized
    if (window.customCursorInitialized) {
        return;
    }
    window.customCursorInitialized = true;
    
    console.log('Custom cursor system initializing...');
    
    // Create cursor container
    const cursorContainer = document.createElement('div');
    cursorContainer.className = 'cursor-container';
    cursorContainer.id = 'cursor-container';
    document.body.appendChild(cursorContainer);
    
    // Create rat cursor (follows mouse)
    const ratCursor = document.createElement('div');
    ratCursor.className = 'cursor-element';
    ratCursor.id = 'cursor-rat';
    ratCursor.style.left = '0px';
    ratCursor.style.top = '0px';
    cursorContainer.appendChild(ratCursor);
    
    // Create cat cursor (chases rat)
    const catCursor = document.createElement('div');
    catCursor.className = 'cursor-element';
    catCursor.id = 'cursor-cat';
    catCursor.style.left = '0px';
    catCursor.style.top = '0px';
    cursorContainer.appendChild(catCursor);
    
    // Default dimensions (will be updated when GIFs load)
    let ratWidth = 40;
    let ratHeight = 40;
    let catWidth = 60;
    let catHeight = 60;
    
    // Track if GIFs have loaded
    let ratLoaded = false;
    let catLoaded = false;
    
    // Function to load images with better error handling
    function loadImage(src, element, type) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            
            img.onload = function() {
                console.log(`${type} GIF loaded: ${this.width}x${this.height}`);
                
                // Update cursor dimensions based on actual GIF size
                if (type === 'rat') {
                    ratWidth = this.width;
                    ratHeight = this.height;
                    ratCursor.style.width = `${ratWidth}px`;
                    ratCursor.style.height = `${ratHeight}px`;
                    ratLoaded = true;
                    ratCursor.classList.add('loaded');
                } else {
                    catWidth = this.width;
                    catHeight = this.height;
                    catCursor.style.width = `${catWidth}px`;
                    catCursor.style.height = `${catHeight}px`;
                    catLoaded = true;
                    catCursor.classList.add('loaded');
                }
                
                resolve();
            };
            
            img.onerror = function() {
                console.error(`Failed to load ${type} GIF: ${src}`);
                element.classList.add('load-error');
                element.classList.remove('loaded');
                
                // Set fallback dimensions
                if (type === 'rat') {
                    ratCursor.style.backgroundColor = '#8B6935';
                    ratCursor.style.borderRadius = '50%';
                } else {
                    catCursor.style.backgroundColor = '#C86645';
                    catCursor.style.borderRadius = '50%';
                }
                
                reject(new Error(`Failed to load ${type} image`));
            };
            
            // Set multiple possible paths
            const paths = [
                src,
                `./${src}`,
                `/${src}`,
                `resources/${src.split('/').pop()}`,
                `./resources/${src.split('/').pop()}`
            ];
            
            // Try each path until one works
            let currentPathIndex = 0;
            
            function tryNextPath() {
                if (currentPathIndex < paths.length) {
                    console.log(`Trying to load ${type} from: ${paths[currentPathIndex]}`);
                    img.src = paths[currentPathIndex];
                    currentPathIndex++;
                } else {
                    reject(new Error(`All paths failed for ${type}`));
                }
            }
            
            img.onerror = function() {
                if (currentPathIndex < paths.length) {
                    setTimeout(tryNextPath, 100);
                } else {
                    console.error(`All paths failed for ${type} GIF`);
                    element.classList.add('load-error');
                    reject(new Error(`All paths failed for ${type}`));
                }
            };
            
            // Start with the first path
            tryNextPath();
        });
    }
    
    // Load both GIFs
    Promise.allSettled([
        loadImage('cursor_rat.gif', ratCursor, 'rat'),
        loadImage('cursor_cat.gif', catCursor, 'cat')
    ]).then(() => {
        console.log('GIF loading complete. Rat loaded:', ratLoaded, 'Cat loaded:', catLoaded);
        if (!ratLoaded || !catLoaded) {
            console.warn('Some GIFs failed to load. Using fallback appearance.');
        }
    });
    
    // Mouse position
    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    
    // Rat position (with light smoothing)
    let ratX = mouseX;
    let ratY = mouseY;
    let ratVelX = 0;
    let ratVelY = 0;
    
    // Cat position (with chase smoothing)
    let catX = mouseX - 50;
    let catY = mouseY - 50;
    let catVelX = 0;
    let catVelY = 0;
    
    // Rotation angles
    let ratRotation = 0;
    let catRotation = 0;
    
    // Animation control
    let animationId = null;
    let lastTimestamp = 0;
    
    // Configuration
    const config = {
        // Rat follows mouse directly with light smoothing
        ratSmoothing: 0.15,
        ratMaxSpeed: 30,
        
        // Cat chases rat with delay and easing
        catChaseSpeed: 0.08,
        catMaxSpeed: 15,
        catMinDistance: 35,
        catMaxDistance: 150,
        
        // Rotation sensitivity
        rotationSmoothing: 0.2,
        minRotationSpeed: 0.5,
    };
    
    // Update mouse position
    function updateMousePosition(e) {
        mouseX = e.clientX;
        mouseY = e.clientY;
        
        // Start animation loop if not already running
        if (!animationId) {
            lastTimestamp = performance.now();
            animationId = requestAnimationFrame(animate);
        }
    }
    
    // Handle touch events for mobile
    function updateTouchPosition(e) {
        if (e.touches.length > 0) {
            mouseX = e.touches[0].clientX;
            mouseY = e.touches[0].clientY;
            
            if (!animationId) {
                lastTimestamp = performance.now();
                animationId = requestAnimationFrame(animate);
            }
        }
    }
    
    // Calculate distance between two points
    function distance(x1, y1, x2, y2) {
        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    }
    
    // Calculate angle between two points (in radians)
    function angleBetween(x1, y1, x2, y2) {
        return Math.atan2(y2 - y1, x2 - x1);
    }
    
    // Smooth rotation towards target angle
    function smoothRotation(current, target, smoothing) {
        let difference = target - current;
        
        // Normalize difference to be between -PI and PI
        while (difference > Math.PI) difference -= 2 * Math.PI;
        while (difference < -Math.PI) difference += 2 * Math.PI;
        
        return current + difference * smoothing;
    }
    
    // Animation loop
    function animate(timestamp) {
        // Calculate time delta for frame-independent movement
        const deltaTime = Math.min((timestamp - lastTimestamp) / 16.67, 2.5);
        lastTimestamp = timestamp;
        
        // Calculate center offsets based on actual dimensions
        const ratCenterX = ratWidth / 2;
        const ratCenterY = ratHeight / 2;
        const catCenterX = catWidth / 2;
        const catCenterY = catHeight / 2;
        
        // 1. Update rat position (smooth follow to mouse)
        const targetRatX = mouseX - ratCenterX;
        const targetRatY = mouseY - ratCenterY;
        
        // Apply smooth movement
        ratVelX += (targetRatX - ratX) * config.ratSmoothing * deltaTime;
        ratVelY += (targetRatY - ratY) * config.ratSmoothing * deltaTime;
        
        // Limit maximum speed
        const ratSpeed = Math.sqrt(ratVelX * ratVelX + ratVelY * ratVelY);
        if (ratSpeed > config.ratMaxSpeed) {
            ratVelX = (ratVelX / ratSpeed) * config.ratMaxSpeed;
            ratVelY = (ratVelY / ratSpeed) * config.ratMaxSpeed;
        }
        
        ratX += ratVelX * deltaTime;
        ratY += ratVelY * deltaTime;
        
        // Apply friction
        ratVelX *= 0.9;
        ratVelY *= 0.9;
        
        // 2. Update cat position (chase the rat)
        const targetCatX = ratX + 15;
        const targetCatY = ratY + 15;
        
        // Calculate distance to rat
        const distToRat = distance(catX + catCenterX, catY + catCenterY, 
                                 targetCatX + ratCenterX, targetCatY + ratCenterY);
        
        // If cat is too far from rat, teleport closer
        if (distToRat > config.catMaxDistance) {
            catX = targetCatX - 60;
            catY = targetCatY - 60;
            catVelX = 0;
            catVelY = 0;
        } else {
            // Normal chase behavior
            const chaseForceX = (targetCatX - catX) * config.catChaseSpeed * deltaTime;
            const chaseForceY = (targetCatY - catY) * config.catChaseSpeed * deltaTime;
            
            catVelX += chaseForceX;
            catVelY += chaseForceY;
            
            // Limit maximum speed
            const catSpeed = Math.sqrt(catVelX * catVelX + catVelY * catVelY);
            if (catSpeed > config.catMaxSpeed) {
                catVelX = (catVelX / catSpeed) * config.catMaxSpeed;
                catVelY = (catVelY / catSpeed) * config.catMaxSpeed;
            }
            
            catX += catVelX * deltaTime;
            catY += catVelY * deltaTime;
            
            // Apply friction
            catVelX *= 0.92;
            catVelY *= 0.92;
            
            // Prevent cat from overlapping rat
            if (distToRat < config.catMinDistance) {
                const angle = angleBetween(catX + catCenterX, catY + catCenterY, 
                                         targetCatX + ratCenterX, targetCatY + ratCenterY);
                catX = targetCatX - Math.cos(angle) * config.catMinDistance - catCenterX;
                catY = targetCatY - Math.sin(angle) * config.catMinDistance - catCenterY;
            }
        }
        
        // 3. Update rotations based on movement
        const ratSpeedForRotation = Math.sqrt(ratVelX * ratVelX + ratVelY * ratVelY);
        if (ratSpeedForRotation > config.minRotationSpeed) {
            const targetRatRotation = angleBetween(0, 0, ratVelX, ratVelY);
            ratRotation = smoothRotation(ratRotation, targetRatRotation, config.rotationSmoothing);
        }
        
        const catSpeedForRotation = Math.sqrt(catVelX * catVelX + catVelY * catVelY);
        if (catSpeedForRotation > config.minRotationSpeed) {
            const targetCatRotation = angleBetween(0, 0, catVelX, catVelY);
            catRotation = smoothRotation(catRotation, targetCatRotation, config.rotationSmoothing);
        }
        
        // 4. Apply positions and rotations
        ratCursor.style.transform = `translate(${ratX}px, ${ratY}px) rotate(${ratRotation}rad)`;
        catCursor.style.transform = `translate(${catX}px, ${catY}px) rotate(${catRotation}rad)`;
        
        // 5. Continue animation loop
        animationId = requestAnimationFrame(animate);
    }
    
    // Initialize positions
    function initializePositions() {
        const ratCenterX = ratWidth / 2;
        const ratCenterY = ratHeight / 2;
        const catCenterX = catWidth / 2;
        const catCenterY = catHeight / 2;
        
        ratX = mouseX - ratCenterX;
        ratY = mouseY - ratCenterY;
        catX = ratX - 60;
        catY = ratY - 60;
        
        ratCursor.style.transform = `translate(${ratX}px, ${ratY}px)`;
        catCursor.style.transform = `translate(${catX}px, ${catY}px)`;
        
        // Start animation
        lastTimestamp = performance.now();
        animationId = requestAnimationFrame(animate);
    }
    
    // Event listeners
    document.addEventListener('mousemove', updateMousePosition);
    document.addEventListener('touchmove', updateTouchPosition, { passive: true });
    document.addEventListener('touchstart', updateTouchPosition, { passive: true });
    window.addEventListener('resize', function() {
        mouseX = Math.min(mouseX, window.innerWidth);
        mouseY = Math.min(mouseY, window.innerHeight);
    });
    
    // Initialize after a short delay to allow GIFs to load
    setTimeout(initializePositions, 300);
    
    // Handle page visibility
    document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
            if (animationId) {
                cancelAnimationFrame(animationId);
                animationId = null;
            }
        } else {
            if (!animationId) {
                lastTimestamp = performance.now();
                animationId = requestAnimationFrame(animate);
            }
        }
    });
    
    // Reduce motion preference
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        config.ratSmoothing = 0.3;
        config.catChaseSpeed = 0.15;
        config.catMaxSpeed = 8;
    }
    
    console.log('Custom cursor system initialized');
});