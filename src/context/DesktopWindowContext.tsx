import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

interface DesktopWindowContextValue extends DesktopWindowState {
  isDesktop: boolean;
}

const DesktopWindowContext = createContext<DesktopWindowContextValue>({
  isDesktop: false,
  isMaximized: false,
  isNotchMode: false
});

/**
 * Menyinkronkan state maximize/notch dari main process Electron ke renderer.
 * Di browser biasa context ini tetap aman dan hanya bernilai default.
 */
export const DesktopWindowProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const api = window.musicflowDesktop;
  const [state, setState] = useState<DesktopWindowState>({
    isMaximized: false,
    isNotchMode: false
  });

  useEffect(() => {
    if (!api) return;

    let active = true;
    const unsubscribe = api.onWindowStateChange((nextState) => {
      if (active) setState(nextState);
    });

    api
      .getWindowState()
      .then((nextState) => {
        if (active) setState(nextState);
      })
      .catch((error) => {
        console.warn('Gagal membaca state jendela desktop:', error);
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [api]);

  const value = useMemo<DesktopWindowContextValue>(
    () => ({
      ...state,
      isDesktop: Boolean(api)
    }),
    [api, state]
  );

  return <DesktopWindowContext.Provider value={value}>{children}</DesktopWindowContext.Provider>;
};

export const useDesktopWindow = (): DesktopWindowContextValue => {
  return useContext(DesktopWindowContext);
};
