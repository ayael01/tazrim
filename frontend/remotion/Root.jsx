import { Composition } from "remotion";
import { TazrimProductDemo } from "./TazrimProductDemo";

export const RemotionRoot = () => {
  return (
    <Composition
      id="TazrimProductDemo"
      component={TazrimProductDemo}
      durationInFrames={900}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{
        year: 2025,
      }}
    />
  );
};
