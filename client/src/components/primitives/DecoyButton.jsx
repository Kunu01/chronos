import React from 'react';
import { motion } from 'framer-motion';

const DecoyButton = ({ children, onClick, variant = 'primary', className = '', type = 'button' }) => {
  const baseStyles =
    'inline-flex items-center justify-center rounded-lg px-4 py-2.5 font-sans text-sm font-medium transition-opacity shadow-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-1';
  const variantStyles =
    variant === 'primary'
      ? 'bg-[#E11D48] text-white'
      : 'bg-white text-[#171717] border border-neutral-200 hover:bg-neutral-50';

  return (
    <motion.button
      type={type}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`${baseStyles} ${variantStyles} ${className}`}
    >
      {children}
    </motion.button>
  );
};

export default DecoyButton;

