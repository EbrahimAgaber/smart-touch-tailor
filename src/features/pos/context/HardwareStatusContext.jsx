import React, { createContext, useContext, useState } from 'react';

const HardwareStatusContext = createContext();

export function HardwareStatusProvider({ children }) {
  const [hwStatus, setHwStatus] = useState({ printer: 'idle', drawer: 'closed' });

  const updateHwStatus = (updates) => {
    setHwStatus(prev => ({ ...prev, ...updates }));
  };

  return (
    <HardwareStatusContext.Provider value={{ hwStatus, updateHwStatus }}>
      {children}
    </HardwareStatusContext.Provider>
  );
}

export const useHardwareStatus = () => useContext(HardwareStatusContext);
