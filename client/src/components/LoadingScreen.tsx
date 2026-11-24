import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export function LoadingScreen() {
  const [dots, setDots] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length < 3 ? prev + "." : ""));
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
      <motion.div
        className="text-4xl font-bold"
        animate={{
          scale: [1, 1.1, 1],
          textShadow: [
            "0 0 5px #fff, 0 0 10px #fff, 0 0 15px #fff, 0 0 20px #00f, 0 0 35px #00f, 0 0 40px #00f, 0 0 50px #00f, 0 0 75px #00f",
            "0 0 10px #fff, 0 0 20px #fff, 0 0 30px #fff, 0 0 40px #00f, 0 0 70px #00f, 0 0 80px #00f, 0 0 100px #00f, 0 0 150px #00f",
            "0 0 5px #fff, 0 0 10px #fff, 0 0 15px #fff, 0 0 20px #00f, 0 0 35px #00f, 0 0 40px #00f, 0 0 50px #00f, 0 0 75px #00f"
          ]
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          repeatType: "reverse"
        }}
      >
        <span className="text-cyan-400">Neon</span>
        <span className="text-purple-400">Path</span>
        <span className="text-blue-400">{dots}</span>
      </motion.div>
    </div>
  );
}
