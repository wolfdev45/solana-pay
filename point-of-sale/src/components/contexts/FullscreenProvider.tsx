import React, { FC, ReactNode, useLayoutEffect, useState } from 'react';
import { FullscreenContext } from '../../hooks/useFullscreen';
import { isFullscreen, toggleFullscreen } from '../../utils/fullscreen';

export interface FullscreenProviderProps {
    children: ReactNode;
}

export const FullscreenProvider: FC<FullscreenProviderProps> = ({ children }) => {
    const [fullscreen, setFullscreen] = useState(isFullscreen());

    useLayoutEffect(() => {
        const listener = () => setFullscreen(isFullscreen());
        document.addEventListener('fullscreenchange', listener);
        return () => document.removeEventListener('fullscreenchange', listener);
    }, []);

    useLayoutEffect(() => {
        if (fullscreen) {
            document.documentElement.classList.add('fullscreen');
            return () => document.documentElement.classList.remove('fullscreen');
        }
    }, [fullscreen]);

    return <FullscreenContext.Provider value={{ fullscreen, toggleFullscreen }}>{children}</FullscreenContext.Provider>;
};
