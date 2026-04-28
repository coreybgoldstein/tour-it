"use client";

import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import Hls from "hls.js";

type Props = Omit<React.VideoHTMLAttributes<HTMLVideoElement>, "src"> & {
  src: string;
};

export const HlsVideo = forwardRef<HTMLVideoElement, Props>(
  ({ src, autoPlay, ...rest }, outerRef) => {
    const innerRef = useRef<HTMLVideoElement>(null);
    useImperativeHandle(outerRef, () => innerRef.current!);

    useEffect(() => {
      const video = innerRef.current;
      if (!video || !src) return;

      const isHls = src.endsWith(".m3u8");

      if (!isHls) {
        video.src = src;
        if (autoPlay) video.play().catch(() => {});
        return;
      }

      // Safari / iOS: native HLS support
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = src;
        if (autoPlay) video.play().catch(() => {});
        return;
      }

      if (!Hls.isSupported()) return;

      const hls = new Hls({ startLevel: -1 });
      hls.loadSource(src);
      hls.attachMedia(video);
      if (autoPlay) {
        hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
      }

      return () => hls.destroy();
    }, [src, autoPlay]);

    // src is managed by the effect; autoPlay is handled manually above
    return <video ref={innerRef} {...rest} />;
  }
);

HlsVideo.displayName = "HlsVideo";
