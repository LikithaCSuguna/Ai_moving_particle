// Main application
class ParticleZen {
    constructor() {
        this.initScene();
        this.createParticles();
        this.setupEventListeners();
        this.setupHandTracking();
        this.animate();
    }

    initScene() {
        // Create scene
        this.scene = new THREE.Scene();
        
        // Setup camera
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.z = 30;
        
        // Setup renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: document.getElementById('particleCanvas'),
            antialias: true,
            alpha: true
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        
        // Add lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);
        
        const pointLight = new THREE.PointLight(0xffcc00, 1);
        pointLight.position.set(10, 10, 10);
        this.scene.add(pointLight);
        
        // Particle system
        this.particles = [];
        this.particleSystem = null;
        this.particleCount = 2000;
        this.particleGeometry = new THREE.BufferGeometry();
        this.particleMaterial = new THREE.PointsMaterial({
            color: 0xffcc00,
            size: 0.15,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });
        
        // Animation properties
        this.time = 0;
        this.targetPosition = new THREE.Vector3();
        this.currentShape = 'sphere';
        this.handOpen = false;
        this.handPosition = { x: 0, y: 0 };
        
        // Window resize handler
        window.addEventListener('resize', this.onWindowResize.bind(this));
    }
    
    createParticles() {
        const positions = new Float32Array(this.particleCount * 3);
        const sizes = new Float32Array(this.particleCount);
        
        for (let i = 0; i < this.particleCount; i++) {
            const i3 = i * 3;
            
            // Random position in a sphere
            const radius = 10 * Math.random();
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            
            positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[i3 + 2] = radius * Math.cos(phi);
            
            // Random size
            sizes[i] = Math.random() * 2 + 1;
            
            // Store original positions for animation
            this.particles.push({
                x: positions[i3],
                y: positions[i3 + 1],
                z: positions[i3 + 2],
                targetX: positions[i3],
                targetY: positions[i3 + 1],
                targetZ: positions[i3 + 2],
                speed: 0.1 + Math.random() * 0.2
            });
        }
        
        this.particleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        this.particleGeometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
        
        this.particleSystem = new THREE.Points(this.particleGeometry, this.particleMaterial);
        this.scene.add(this.particleSystem);
    }
    
    setupEventListeners() {
        // Template buttons
        document.querySelectorAll('.template-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelector('.template-btn.active').classList.remove('active');
                btn.classList.add('active');
                this.currentShape = btn.dataset.shape;
                this.updateParticleShape();
            });
        });
        
        // Mouse move for testing (will be overridden by hand tracking)
        document.addEventListener('mousemove', (e) => {
            this.handPosition = {
                x: (e.clientX / window.innerWidth) * 2 - 1,
                y: -(e.clientY / window.innerHeight) * 2 + 1
            };
        });
        
        // Mouse click for testing hand open/close
        document.addEventListener('mousedown', () => {
            this.handOpen = false;
            this.updateParticleSize();
        });
        
        document.addEventListener('mouseup', () => {
            this.handOpen = true;
            this.updateParticleSize();
        });
    }
    
    async setupHandTracking() {
        try {
            // Load the handtrack model
            const model = await handTrack.load();
            const video = document.getElementById('webcam');
            
            // Start video
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    width: 640, 
                    height: 480,
                    facingMode: 'user'
                } 
            });
            video.srcObject = stream;
            
            // Detect hands
            const detectHands = async () => {
                if (video.readyState === 4) {
                    const predictions = await model.detect(video);
                    this.processHandPredictions(predictions);
                }
                requestAnimationFrame(detectHands);
            };
            
            detectHands();
        } catch (error) {
            console.error('Error setting up hand tracking:', error);
        }
    }
    
    processHandPredictions(predictions) {
        if (predictions.length > 0) {
            const hand = predictions[0];
            
            // More sensitive hand position tracking
            this.handPosition = {
                x: (hand.bbox[0] + hand.bbox[2] / 2) / 640 * 4 - 2,
                y: -((hand.bbox[1] + hand.bbox[3] / 2) / 480 * 4 - 2)
            };
            
            // Improved hand open/close detection
            const aspectRatio = hand.bbox[2] / hand.bbox[3];
            const handArea = hand.bbox[2] * hand.bbox[3];
            
            // More reliable detection using both aspect ratio and hand area
            const newHandOpen = aspectRatio > 0.7 && handArea > 10000;
            
            if (newHandOpen !== this.handOpen) {
                this.handOpen = newHandOpen;
                this.updateParticleSize();
                
                // Visual feedback when hand state changes
                const feedback = document.createElement('div');
                feedback.className = 'hand-feedback';
                feedback.textContent = this.handOpen ? 'Hand Open' : 'Hand Closed';
                feedback.style.position = 'fixed';
                feedback.style.top = '20px';
                feedback.style.left = '50%';
                feedback.style.transform = 'translateX(-50%)';
                feedback.style.padding = '10px 20px';
                feedback.style.background = this.handOpen ? 'rgba(0, 200, 0, 0.7)' : 'rgba(200, 0, 0, 0.7)';
                feedback.style.color = 'white';
                feedback.style.borderRadius = '20px';
                feedback.style.zIndex = '1000';
                document.body.appendChild(feedback);
                
                // Remove feedback after animation
                setTimeout(() => {
                    feedback.style.transition = 'opacity 0.5s';
                    feedback.style.opacity = '0';
                    setTimeout(() => feedback.remove(), 500);
                }, 1000);
            }
        }
    }
    
    updateParticleShape() {
        // Update particle positions based on the selected shape
        for (let i = 0; i < this.particleCount; i++) {
            const particle = this.particles[i];
            
            switch (this.currentShape) {
                case 'heart':
                    this.setHeartPosition(particle, i);
                    break;
                case 'saturn':
                    this.setSaturnPosition(particle, i);
                    break;
                case 'flower':
                    this.setFlowerPosition(particle, i);
                    break;
                case 'zen':
                    this.setZenPosition(particle, i);
                    break;
                case 'burst':
                    this.setBurstPosition(particle, i);
                    break;
                default: // sphere
                    this.setSpherePosition(particle, i);
            }
            
            // Store target position for smooth animation
            particle.targetX = particle.x;
            particle.targetY = particle.y;
            particle.targetZ = particle.z;
        }
    }
    
    // Different shape configurations
    setSpherePosition(particle, i) {
        const radius = 10;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        
        particle.x = radius * Math.sin(phi) * Math.cos(theta);
        particle.y = radius * Math.sin(phi) * Math.sin(theta);
        particle.z = radius * Math.cos(phi);
    }
    
    setHeartPosition(particle, i) {
        const t = (i / this.particleCount) * Math.PI * 2;
        
        particle.x = 16 * Math.pow(Math.sin(t), 3);
        particle.y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
        particle.z = (Math.random() - 0.5) * 10;
        
        // Scale down
        particle.x *= 0.5;
        particle.y *= 0.5;
        particle.z *= 0.3;
    }
    
    setSaturnPosition(particle, i) {
        // Create a disc with a ring
        if (i < this.particleCount * 0.8) {
            // Main sphere
            const radius = 8;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            
            particle.x = radius * Math.sin(phi) * Math.cos(theta);
            particle.y = radius * Math.sin(phi) * Math.sin(theta);
            particle.z = radius * Math.cos(phi);
        } else {
            // Ring
            const angle = Math.random() * Math.PI * 2;
            const radius = 12 + (Math.random() - 0.5) * 2;
            
            particle.x = Math.cos(angle) * radius;
            particle.y = Math.sin(angle) * radius * 0.2;
            particle.z = Math.sin(angle) * radius;
        }
    }
    
    setFlowerPosition(particle, i) {
        const t = (i / this.particleCount) * Math.PI * 8;
        const r = 5 + 2 * Math.sin(t * 5);
        
        particle.x = r * Math.cos(t);
        particle.y = r * Math.sin(t);
        particle.z = (Math.random() - 0.5) * 4;
    }
    
    setZenPosition(particle, i) {
        // Create a mandala/zen pattern
        const angle = (i / this.particleCount) * Math.PI * 16;
        const radius = 8 * (i % 2 === 0 ? 1 : 0.6);
        
        particle.x = Math.cos(angle) * radius;
        particle.y = Math.sin(angle) * radius;
        particle.z = (Math.random() - 0.5) * 2;
    }
    
    setBurstPosition(particle, i) {
        // Create an explosive burst pattern
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * 15;
        
        particle.x = Math.cos(angle) * radius;
        particle.y = Math.sin(angle) * radius;
        particle.z = (Math.random() - 0.5) * 15;
    }
    
    updateParticleSize() {
        // More dramatic size change based on hand state
        if (this.handOpen) {
            this.particleMaterial.size = 0.3;
            this.particleMaterial.color.set(0x00ff88);
            this.particleMaterial.needsUpdate = true;
            
            // Expand the shape when hand is open
            this.particles.forEach(particle => {
                const expansion = 1.5;
                particle.targetX = particle.x * expansion;
                particle.targetY = particle.y * expansion;
                particle.targetZ = particle.z * expansion;
            });
        } else {
            this.particleMaterial.size = 0.1;
            this.particleMaterial.color.set(0xff6600);
            this.particleMaterial.needsUpdate = true;
            
            // Contract the shape when hand is closed
            this.particles.forEach(particle => {
                const contraction = 0.7;
                particle.targetX = particle.x * contraction;
                particle.targetY = particle.y * contraction;
                particle.targetZ = particle.z * contraction;
            });
        }
    }
    
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    animate() {
        requestAnimationFrame(this.animate.bind(this));
        this.time += 0.01;
        
        // Update particles
        const positions = this.particleGeometry.attributes.position.array;
        
        for (let i = 0; i < this.particleCount; i++) {
            const i3 = i * 3;
            const particle = this.particles[i];
            
            // Dynamic movement based on hand position and state
            const handInfluenceFactor = this.handOpen ? 12 : 8;
            const noiseX = Math.sin(this.time * particle.speed + i) * (this.handOpen ? 2.5 : 1);
            const noiseY = Math.cos(this.time * particle.speed + i) * (this.handOpen ? 2.5 : 1);
            const noiseZ = Math.sin(this.time * 0.5 * particle.speed + i) * (this.handOpen ? 1.5 : 0.5);
            
            // Add pulsing effect based on hand state
            const pulse = this.handOpen ? 
                Math.sin(this.time * 2) * 0.2 + 1 : 
                Math.sin(this.time * 5) * 0.05 + 0.95;
            
            // Responsive interpolation based on hand state
            const lerpFactor = this.handOpen ? 0.08 : 0.15;
            particle.x += (particle.targetX - particle.x) * lerpFactor;
            particle.y += (particle.targetY - particle.y) * lerpFactor;
            particle.z += (particle.targetZ - particle.z) * lerpFactor;
            
            // Hand position influence with wave effect
            const handX = this.handPosition.x * handInfluenceFactor * (1 + Math.sin(this.time) * 0.2);
            const handY = this.handPosition.y * handInfluenceFactor * (1 + Math.cos(this.time) * 0.2);
            
            // Apply pulse effect to position
            const pulseX = particle.x * pulse;
            const pulseY = particle.y * pulse;
            const pulseZ = particle.z * pulse;
            
            // Update positions with noise, hand influence, and pulse
            positions[i3] = pulseX + handX + noiseX;
            positions[i3 + 1] = pulseY + handY + noiseY;
            positions[i3 + 2] = pulseZ + noiseZ;
        }
        
        this.particleGeometry.attributes.position.needsUpdate = true;
        
        // Rotate the entire particle system
        this.particleSystem.rotation.y = this.time * 0.15;
        this.particleSystem.rotation.x = Math.sin(this.time * 0.3) * 0.1;
        
        // Render the scene
        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize the application when the page loads
window.addEventListener('load', () => {
    // Hide loading screen
    const loadingScreen = document.createElement('div');
    loadingScreen.className = 'loading';
    loadingScreen.innerHTML = '<div class="loading-spinner"></div>';
    document.body.appendChild(loadingScreen);
    
    // Start the app
    const app = new ParticleZen();
    
    // Remove loading screen after a short delay
    setTimeout(() => {
        loadingScreen.style.transition = 'opacity 0.5s';
        loadingScreen.style.opacity = '0';
        setTimeout(() => {
            if (document.body.contains(loadingScreen)) {
                document.body.removeChild(loadingScreen);
            }
        }, 500);
    }, 1000);
    
    // Make app globally available for debugging
    window.app = app;
});
