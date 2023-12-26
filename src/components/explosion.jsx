import React, { useRef, useFrame } from 'react'; // Import useRef here
import { BufferGeometry, PointsMaterial, Points, Vector3, Float32BufferAttribute } from 'three';

export function Explosion({ position }) {
  const numParticles = 50;
  const particles = useRef(new Array(numParticles).fill().map(() => ({
    position: position.clone(),
    velocity: new Vector3((Math.random() - 0.5) * 2, Math.random() * 2, (Math.random() - 0.5) * 2),
    life: Math.random() * 60 + 60, // lifespan in frames
  }))).current;

  const geometry = useRef(new BufferGeometry()).current;
  const material = useRef(new PointsMaterial({ color: 0xffc107, size: 0.1 })).current;
  const points = useRef(new Points(geometry, material)).current;

  useFrame(() => {
    particles.forEach(particle => {
      if (particle.life > 0) {
        particle.position.add(particle.velocity);
        particle.life -= 1;
      }
    });

    const positions = particles.flatMap(p => [p.position.x, p.position.y, p.position.z]);
    geometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(positions), 3));
  });

  return <primitive object={points} />;
}
