import React from 'react';
import { motion } from 'framer-motion';

const BrutalistButton = ({
  label,
  children,
  onClick,
  variant = 'primary',
  pill = false,
  className = '',
  type = 'button',
  disabled = false,
}) => {
  const handlePress = (e) => {
    if (disabled) return;
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(50);
    }
    if (onClick) onClick(e);
  };

  const shapeClass = pill ? 'rounded-full' : 'rounded-none';

  let variantClass =
    'bg-[#00F0FF] text-black border border-[#00F0FF] shadow-[0_0_10px_rgba(0,240,255,0.35)]';
  if (variant === 'secondary') {
    variantClass = 'bg-[#1E1E1E] text-[#E5E5E5] border border-[#333333] hover:border-[#00F0FF]';
  } else if (variant === 'danger') {
    variantClass =
      'bg-[#FF003C] text-white border border-[#FF003C] shadow-[0_0_10px_rgba(255,0,60,0.35)]';
  } else if (variant === 'ghost') {
    variantClass = 'bg-transparent text-[#A3A3A3] border border-[#333333] hover:text-white';
  }

  return (
    <motion.button
      type={type}
      disabled={disabled}
      whileHover={{ skewX: -2 }}
      whileTap={{ scale: 0.92 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      onClick={handlePress}
      className={`px-5 py-2.5 font-mono text-xs uppercase tracking-wider font-bold select-none disabled:opacity-40 ${shapeClass} ${variantClass} ${className}`}
    >
      {children || label}
    </motion.button>
  );
};

export default BrutalistButton;

