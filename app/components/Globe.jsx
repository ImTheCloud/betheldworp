"use client";

import React, { useRef, Suspense } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { OrbitControls, Stars, PerspectiveCamera } from "@react-three/drei";

function Earth() {
    const meshRef = useRef();
    const texture = useLoader(THREE.TextureLoader, "/earth-texture-2k.jpg");

    useFrame((state, delta) => {
        if (meshRef.current) {
            meshRef.current.rotation.y += delta * 0.15;
        }
    });

    return (
        <mesh ref={meshRef}>
            <sphereGeometry args={[2.5, 64, 64]} />
            <meshStandardMaterial
                map={texture}
                metalness={0.1}
                roughness={0.8}
            />
        </mesh>
    );
}

export default function Globe() {
    return (
        <div style={{ width: "100%", height: "500px", position: "relative", cursor: "grab" }}>
            <Canvas
                dpr={[1, 2]}
                gl={{
                    antialias: true,
                    alpha: true,
                    toneMapping: THREE.NoToneMapping
                }}
            >
                <Suspense fallback={null}>
                    <PerspectiveCamera makeDefault position={[0, 0, 7]} />

                    {/* Pro lighting for the high-quality texture */}
                    <ambientLight intensity={1.5} />
                    <directionalLight position={[5, 3, 5]} intensity={1.2} />
                    <directionalLight position={[-5, -2, 2]} intensity={0.5} />

                    <Earth />

                    <Stars
                        radius={100}
                        depth={50}
                        count={3000}
                        factor={4}
                        saturation={0}
                        fade
                        speed={1}
                    />

                    <OrbitControls
                        enableZoom={false}
                        rotateSpeed={0.5}
                        enablePan={false}
                    />
                </Suspense>
            </Canvas>
        </div>
    );
}
