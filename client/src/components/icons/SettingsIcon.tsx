import { motion } from "framer-motion";

export function SettingsIcon({ className }: { className?: string }) {
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      initial={{ pathLength: 0 }}
      animate={{ pathLength: 1 }}
      transition={{ duration: 1, ease: "easeInOut" }}
    >
      <motion.path
        d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m0 0v-4m
