import React, { useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';

export const CustomSlider = ({ min, max, step, value, onChange, isDarkMode }: any) => {
  const liveUpdate = useStore(state => state.filters.liveUpdate);
  const [localVal, setLocalVal] = useState(value);
  
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setLocalVal(value), [value]);

  const handleChange = (e: any) => {
    const val = Number(Number(e.target.value).toFixed(3));
    setLocalVal(val);
    if (liveUpdate) {
      onChange(val);
    }
  };

  const handleRelease = () => {
    if (localVal !== value) {
      onChange(localVal);
    }
  };

  return (
    <input
      type="range"
      min={min}
      max={max}
      step="any"
      value={localVal}
      onChange={handleChange}
      onMouseUp={handleRelease}
      onTouchEnd={handleRelease}
      onKeyUp={handleRelease}
      className={`w-full h-1 appearance-none outline-none cursor-pointer rounded-full ${
        isDarkMode
          ? 'bg-[#555] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-[#b4ff39] [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-[#b4ff39] [&::-webkit-slider-thumb]:rounded-full [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:bg-[#b4ff39] [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:rounded-full'
          : 'bg-[#ccc] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-[#141414] [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-[#141414] [&::-webkit-slider-thumb]:rounded-full [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:bg-[#141414] [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:rounded-full'
      }`}
    />
  );
};
