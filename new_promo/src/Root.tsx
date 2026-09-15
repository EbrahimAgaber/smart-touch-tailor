import React from "react";
import { Composition } from "remotion";
import { PromoVideo } from "./PromoVideo";
import "./index.css";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="PromoVideo"
        component={PromoVideo}
        durationInFrames={1800}   // 60 seconds @ 30fps
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
