"use client";

import React, { useRef, useMemo, useState, useLayoutEffect } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

/* Preload texture immediately at module level */
useLoader.preload(THREE.TextureLoader, "/textures/earth-blue.jpg");

/* ─────────────────────────────────────────
   Earth Sphere
───────────────────────────────────────── */
function EarthSphere({ onPremierRendu }) {
    const meshRef = useRef();
    const texture = useLoader(THREE.TextureLoader, "/textures/earth-blue.jpg");

    /* useLayoutEffect et non useEffect : le réglage doit être posé AVANT que la
       première image ne soit peinte. Avec useEffect, la première image partait
       avec une texture non configurée, ce qui allongeait le moment où le globe
       n'affiche pas encore la Terre. */
    useLayoutEffect(() => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 16;
        texture.needsUpdate = true;
    }, [texture]);

    const annonce = useRef(false);

    useFrame((_, delta) => {
        /* La toute première image dessinée est le seul moment où l'on sait que
           la Terre est réellement à l'écran, texture envoyée au processeur
           graphique comprise. C'est de là qu'on autorise l'apparition, et non
           d'un délai fixe qui devinait. */
        if (!annonce.current) {
            annonce.current = true;
            onPremierRendu();
        }

        /* Rotation lente */
        if (meshRef.current) {
            meshRef.current.rotation.y += delta * 0.08;
        }
    });

    return (
        <mesh ref={meshRef} rotation={[0, 2.0, 0]}>
            <sphereGeometry args={[2, 64, 64]} />
            <meshStandardMaterial
                map={texture}
                color="#ffffff"
                roughness={0.8}
                metalness={0.1}
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
                <ambientLight intensity={2.8} />
                <directionalLight
                    position={[10, 5, 10]}
                    intensity={1.5}
                    color="#ffffff"
                />
                <directionalLight
                    position={[-10, -5, 5]}
                    intensity={0.8}
                    color="#aad4ff"
                />
                <pointLight position={[0, 0, 5]} intensity={1.0} color="#ffffff" />

                <React.Suspense fallback={null}>
                    <EarthSphere onPremierRendu={() => setReady(true)} />
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
