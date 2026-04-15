"use client";

import React, { useRef, useMemo, useState } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

/* Preload texture immediately at module level */
useLoader.preload(THREE.TextureLoader, "/textures/earth-blue.jpg");

/* ─────────────────────────────────────────
   Earth Sphere
───────────────────────────────────────── */
function EarthSphere() {
    const meshRef = useRef();
    const texture = useLoader(THREE.TextureLoader, "/textures/earth-blue.jpg");

    /* Make texture look crisp */
    useMemo(() => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 16;
    }, [texture]);

    /* Slow auto-rotation */
    useFrame((_, delta) => {
        if (meshRef.current) {
            meshRef.current.rotation.y += delta * 0.08;
        }
    });

    return (
        <mesh ref={meshRef} rotation={[0, -0.3, 0]}>
            <sphereGeometry args={[2, 64, 64]} />
            <meshStandardMaterial
                map={texture}
                roughness={0.8}
                metalness={0.05}
            />
        </mesh>
    );
}

/* ─────────────────────────────────────────
   Atmosphere glow  (bright blue halo)
───────────────────────────────────────── */
function Atmosphere() {
    const atmosphereMaterial = useMemo(() => {
        return new THREE.ShaderMaterial({
            vertexShader: `
                varying vec3 vNormal;
                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                varying vec3 vNormal;
                void main() {
                    float intensity = pow(0.7 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
                    gl_FragColor = vec4(0.42, 0.68, 1.0, 1.0) * intensity * 0.8;
                }
            `,
            blending: THREE.AdditiveBlending,
            side: THREE.BackSide,
            transparent: true,
        });
    }, []);

    return (
        <mesh scale={[1.15, 1.15, 1.15]}>
            <sphereGeometry args={[2, 64, 64]} />
            <primitive object={atmosphereMaterial} attach="material" />
        </mesh>
    );
}

/* ─────────────────────────────────────────
   Main Globe Component
───────────────────────────────────────── */
export default function Globe3D({ className }) {
    const [ready, setReady] = useState(false);

    return (
        <div
            className={className}
            style={{
                width: "100%",
                height: "100%",
                touchAction: "none",
                opacity: ready ? 1 : 0,
                transition: "opacity 0.6s ease",
            }}
        >
            <Canvas
                camera={{ position: [0, 0, 4.8], fov: 45 }}
                gl={{ antialias: true, alpha: true }}
                onCreated={({ gl }) => {
                    gl.setClearColor(0x000000, 0);
                }}
                style={{ background: "transparent" }}
                dpr={[1, 2]}
            >
                {/* ── Bright lighting to keep globe clear ── */}
                <ambientLight intensity={2.2} />
                <directionalLight
                    position={[5, 3, 5]}
                    intensity={3.0}
                    color="#ffffff"
                />
                <directionalLight
                    position={[-4, -2, 3]}
                    intensity={1.2}
                    color="#aad4ff"
                />
                <directionalLight
                    position={[0, 5, -3]}
                    intensity={0.8}
                    color="#ffffff"
                />

                <React.Suspense fallback={null}>
                    <ReadyNotifier onReady={() => setReady(true)} />
                    <EarthSphere />
                    <Atmosphere />
                </React.Suspense>

                {/* ── Controls: drag to rotate on mouse / touch ── */}
                <OrbitControls
                    enableZoom={false}
                    enablePan={false}
                    rotateSpeed={0.4}
                    autoRotate
                    autoRotateSpeed={0.5}
                    minPolarAngle={Math.PI * 0.25}
                    maxPolarAngle={Math.PI * 0.75}
                />
            </Canvas>
        </div>
    );
}

/* Tiny helper — fires onReady once mounted inside Suspense */
function ReadyNotifier({ onReady }) {
    useMemo(() => { onReady(); }, [onReady]);
    return null;
}
