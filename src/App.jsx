import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree, useLoader } from '@react-three/fiber';
import { Points, BufferGeometry, PointsMaterial, Vector3, Float32BufferAttribute, TextureLoader, PlaneGeometry, MeshBasicMaterial, Mesh, MeshStandardMaterial } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import PropTypes from 'prop-types';
import { Sphere } from '@react-three/drei';
import uniqueId from 'lodash/uniqueId';
import { Bloom, EffectComposer, Pixelation, Scanline } from '@react-three/postprocessing';
import { add } from 'lodash';

const asteroidMaterial = new MeshBasicMaterial({ color: 0x8f8f8f }); // Green color for example

function Explosion({ position }) {
  const numParticles = 500;
  const gravity = new Vector3(0, -0.05, 0); // Adjusted gravity vector pointing downwards
  const particles = useRef(new Array(numParticles).fill().map(() => ({
    position: position.clone(),
    velocity: new Vector3((Math.random() - 0.5) * 2, Math.random() * 2, (Math.random() - 0.5) * 2),
    life: Math.random() * 20 + 10, // lifespan in frames
    timeAlive: 0, // Time since particle was created
  }))).current;

  const geometry = useRef(new BufferGeometry()).current;
  const material = useRef(new PointsMaterial({ color: 0x6700e2, size: 0.7 })).current;
  const points = useRef(new Points(geometry, material)).current;

  if (!position) {
    console.error("Explosion position is null or undefined.");
    return null; // Return early or handle appropriately
  }

  useFrame(() => {
    particles.forEach(particle => {
      // Reduce life only if life > 0
      if (particle.life > 0) {
        particle.life -= 0.3;
      }

      particle.timeAlive += 1; // Increment timeAlive each frame

      // Apply gravity after 1 second (assuming 60 frames per second)
      if (particle.timeAlive > 1 * 60) {
        // Gradually increase gravity force over time
        const gravityFactor = Math.min(1, particle.timeAlive / (3 * 60)); // Full gravity force after 3 seconds
        particle.velocity.add(gravity.clone().multiplyScalar(gravityFactor));
      }

      // Update position
      particle.position.add(particle.velocity);
    });

    const positions = particles.flatMap(p => [p.position.x, p.position.y, p.position.z]);
    geometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(positions), 3));
  });

  return <primitive object={points} />;
}

function Asteroid({ position, onCollision, visible, onDestroyed, onModelCollision }) {
  const ref = useRef();
  const { camera, size, scene } = useThree(); // Get the scene

  useFrame(() => {
    if (ref.current) {
      ref.current.position.y -= 0.05 + 0.0002 * performance.now() / 1000;; // Adjust this to change the speed of the asteroids
      ref.current.position.z = -10; // Set the z position to be -10
      if (ref.current.position.y < -12) { // Adjust this to change the bottom boundary
        ref.current.position.y = 15; // Adjust this to change the top boundary
      }
    }
  });

  useEffect(() => {
    if (ref.current && onCollision(ref.current.position)) {
      onDestroyed(ref.current.position);
      onModelCollision();
    }
  }, [onCollision, onDestroyed, onModelCollision]);

  return (
    <group ref={ref} position={position}>
      {visible && <Sphere args={[0.5, 8, 8]} material={asteroidMaterial} />}
    </group>
  );
}

Asteroid.propTypes = {
  position: PropTypes.instanceOf(Vector3).isRequired,
  onCollision: PropTypes.func.isRequired,
  visible: PropTypes.bool.isRequired,
  onDestroyed: PropTypes.func.isRequired,
  onModelCollision: PropTypes.func.isRequired,
};

function Particles({ modelRef, isMouseDown, asteroids, asteroidVisibility, setAsteroidVisibility, onDestroyed, modelVisible, setModelVisible, lives, setLives }) {
  const numParticles = 1000;
  const particlesRef = useRef();
  const [particles, setParticles] = useState(new Array(numParticles).fill().map(() => ({
    position: new Vector3(0, 0, 0),
    velocity: new Vector3(0, 10, 0),
    life: 0,
  })));
  const [destroyedAsteroids, setDestroyedAsteroids] = useState(new Set());

  const checkCollision = (asteroidPos, asteroidIndex) => {
    const asteroidRadius = 0.5; // Assuming the asteroid is a sphere with radius 0.5
    const particleRadius = 0.1; // Assuming each particle has a radius of 0.1

    particles.forEach((particle) => {
      const distance = particle.position.distanceTo(asteroidPos);
      const collisionDistance = asteroidRadius + particleRadius;

      if (distance < collisionDistance && asteroidVisibility[asteroidIndex]) {
        // Collision detected

        // Trigger explosion
        if (!destroyedAsteroids.has(asteroidIndex)) { // Check if the asteroid has not been destroyed in this frame
          onDestroyed(asteroidPos);
          destroyedAsteroids.add(asteroidIndex);
        }

        setAsteroidVisibility(prevVisibility => {
          const newVisibility = [...prevVisibility];
          newVisibility[asteroidIndex] = false;
          return newVisibility;
        });
      }
    });
  };

  const checkModelCollision = () => {
    asteroids.forEach((asteroid, index) => {
      if (!asteroidVisibility[index]) {
        // Skip this asteroid if it is not visible
        return;
      }

      const distance = modelRef.current.position.distanceTo(asteroid);
      console.log(`Distance to asteroid ${index}: ${distance}`); // This will log the distance to each asteroid
      if (distance < 14 ) { // Adjusted collision threshold to match the new size of the model
        // Collision detected
        handleModelCollision(index);
      }
    });
  };

  const handleModelCollision = (asteroidIndex) => {
    console.log('Collision detected!'); // This will log a message whenever a collision is detected
    setLives(prevLives => {
      console.log(`Lives before update: ${prevLives}`); // This will log the number of lives before the update
      const updatedLives = prevLives - 1;
      console.log(`Lives after update: ${updatedLives}`); // This will log the number of lives after the update
      return updatedLives;
    });
    setModelVisible(false);
    setTimeout(() => setModelVisible(true), 1000); // Make the model visible again after 1 second

    // Hide the asteroid and prevent further collisions
    setAsteroidVisibility(prevVisibility => {
      const newVisibility = [...prevVisibility];
      newVisibility[asteroidIndex] = false;
      return newVisibility;
    });
  };

  useFrame(() => {
    setParticles(particles.map(particle => {
      if (particle.life > 0) {
        const newPosition = particle.position.clone().add(particle.velocity);
        const newLife = particle.life - 1;
        return { ...particle, position: newPosition, life: newLife };
      } else {
        return particle;
      }
    }));

    if (isMouseDown.current) {
      emitParticles();
    }

    if (particlesRef.current) {
      const positions = particles.flatMap(p => [p.position.x, p.position.y, p.position.z]);
      particlesRef.current.geometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(positions), 3));
    }

    checkModelCollision();

    destroyedAsteroids.clear();
  });

  const emitParticles = () => {
    const offset = new Vector3(0, -1, 0); // Adjust this to change the emitter position relative to the GLTF
    setParticles(particles.map(particle => ({
      ...particle,
      position: modelRef.current.position.clone().add(offset),
      velocity: new Vector3(0, Math.random() * 30 + 3), // Particles will always shoot upwards
      life: Math.random() * 30 + 60,
      size: 18,
    })));
  };

  const points = new Points(
    new BufferGeometry(),
    new PointsMaterial({ color: 0xffffff, size: 0.6 })
  );

  const positions = particles.flatMap(p => [p.position.x, p.position.y, p.position.z]);
  points.geometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(positions), 3));

  return (
    <>
      <primitive object={points} ref={particlesRef} />
      {asteroids.map((position, index) => (
        // Only render the asteroid if it is not in the destroyedAsteroids set
        !destroyedAsteroids.has(index) && (
          <Asteroid key={index} position={position} onCollision={(pos) => checkCollision(pos, index)} visible={asteroidVisibility[index]} onDestroyed={onDestroyed} onModelCollision={handleModelCollision} />
        )
      ))}
    </>
  );
}

Particles.propTypes = {
  modelRef: PropTypes.object.isRequired,
  isMouseDown: PropTypes.object.isRequired,
  asteroids: PropTypes.arrayOf(PropTypes.instanceOf(Vector3)).isRequired,
  asteroidVisibility: PropTypes.arrayOf(PropTypes.bool).isRequired,
  setAsteroidVisibility: PropTypes.func.isRequired,
  onDestroyed: PropTypes.func.isRequired,
  modelVisible: PropTypes.bool.isRequired,
  setModelVisible: PropTypes.func.isRequired,
  lives: PropTypes.number.isRequired,
  setLives: PropTypes.func.isRequired,
};

function Model({ modelRef, modelVisible }) {
  const { mouse, camera } = useThree();
  const gltf = useLoader(GLTFLoader, '/jokuh_ship_y.gltf');
  // Initialize velocity and drag
  const velocity = useRef(new Vector3(0, 0, 0));
  const drag = 0.02; // Adjust this value to change the drag effect
  const trackingIntensity = 0.0001; // Adjust this value to change how much the camera tracks the object

  // Create basic material
  const basicMaterial = new MeshBasicMaterial({ color: 0x333333 }); // Red color

  // Apply basic material to all meshes in the GLTF scene
  gltf.scene.traverse((node) => {
    if (node.isMesh) {
      node.material = basicMaterial;
    }
  });

  useFrame(() => {
    const rollintensity = Math.PI;
    gltf.scene.rotation.y = mouse.x * rollintensity / 2;

    // Calculate the target position and subtract the current position to get the difference
    const targetPosition = new Vector3(mouse.x * 13, mouse.y * 13, 0);
    const diff = targetPosition.clone().sub(modelRef.current.position);

    // Add the difference to the velocity and apply the drag
    velocity.current.add(diff).multiplyScalar(drag);

    // Add the velocity to the current position
    modelRef.current.position.add(velocity.current);

    // Update the camera's rotation to follow the model
    camera.quaternion.slerp(modelRef.current.quaternion, trackingIntensity);

    gltf.scene.position.z = -10;
  });

  return modelVisible ? <primitive object={gltf.scene} ref={modelRef} /> : null;
}

Model.propTypes = {
  modelRef: PropTypes.object.isRequired,
  modelVisible: PropTypes.bool.isRequired,
};

function App() {
  const modelRef = useRef();
  const isMouseDown = useRef(false);

  const [asteroids, setAsteroids] = useState([]);
  const [asteroidVisibility, setAsteroidVisibility] = useState([]);
  const [explosions, setExplosions] = useState([]); // New state for explosions
  const [asteroidStateChanges, setAsteroidStateChanges] = useState(0); // New state for asteroid state changes
  const [lives, setLives] = useState(3); // New state for lives
  const [modelVisible, setModelVisible] = useState(true); // New state for model visibility
  const [gameOver, setGameOver] = useState(false); // New state for game over

  const handleAsteroidDestruction = (asteroidPosition) => {
    setAsteroidStateChanges(prevState => prevState + 1); // Increment asteroid state changes
    setExplosions(prevExplosions => {
      const newExplosions = [...prevExplosions, { id: uniqueId(), position: asteroidPosition }];
      return newExplosions;
    });
    // Other destruction logic
  };

  const removeExplosion = (explosionId) => {
    setExplosions(prevExplosions => {
      const newExplosions = prevExplosions.filter(explosion => explosion.id !== explosionId);
      return newExplosions;
    });
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setAsteroids(prevAsteroids => {
        const newAsteroids = [
          ...prevAsteroids,
          new Vector3(
            parseFloat((Math.random() * 15 - 5).toFixed(3)), 
            parseFloat((15).toFixed(3)), 
            parseFloat((-2).toFixed(3))
          )
        ];
        setAsteroidVisibility(prevVisibility => [...prevVisibility, true]); // Add visibility for the new asteroid
        return newAsteroids;
      });
    }, 2000); // Spawn a new asteroid every 2 seconds

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (lives === 0) {
      // End the game
      setGameOver(true);
    }
  }, [lives]);

  return (
    <div>
      {gameOver ? (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
          <h1>Game Over</h1>
          <button onClick={() => window.location.reload()}>Refresh</button>
        </div>
      ) : (
        <>
          <div style={{ position: 'absolute', top: 0, width: '100%', textAlign: 'center', userSelect: 'none', fontSize: '3em', fontFamily: 'Finders Keepers' }}>
            Score: {asteroidStateChanges}
          </div>
          <div style={{ position: 'absolute', bottom: 0, left: 20, userSelect: 'none', fontSize: '3em', fontFamily: 'Finders Keepers' }}>
            Lives: {lives}
          </div>
          <Canvas style={{ width: '100vw', height: '100vh' }}
            camera={{ fov: 30, position: [0, 0, 30] }} // Set the FOV to 75
            onMouseDown={() => {
              isMouseDown.current = true;
            }}
            onMouseUp={() => {
              isMouseDown.current = false;
            }}
          >
            <ambientLight intensity={1} />
            <EffectComposer>
              <Bloom
                luminanceThreshold={0.01}
                luminanceSmoothing={0.9}
                height={300}
              />
              <Pixelation granularity={10} />
              <Scanline density={11.1} opacity={0.11}/>
            </EffectComposer>
            <Model modelRef={modelRef} modelVisible={modelVisible} />
            <Particles modelRef={modelRef} isMouseDown={isMouseDown} asteroids={asteroids} asteroidVisibility={asteroidVisibility} setAsteroidVisibility={setAsteroidVisibility} onDestroyed={handleAsteroidDestruction} modelVisible={modelVisible} setModelVisible={setModelVisible} lives={lives} setLives={setLives} />
            {explosions.map(explosion => (
              <Explosion key={explosion.id} position={explosion.position} />
            ))}
          </Canvas>
        </>
      )}
    </div>
  )
}

export default App;
