import React from "react";
import { AbsoluteFill, Audio, Composition, staticFile, useCurrentFrame } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";

import { PersistentBackground } from "./components/PersistentBackground";
import { HeroScene } from "./scenes/HeroScene";
import { WhyScene } from "./scenes/WhyScene";
import { ContractScene } from "./scenes/ContractScene";
import { SurfaceScene } from "./scenes/SurfaceScene";
import { RealRunScene } from "./scenes/RealRunScene";
import { GuardrailScene } from "./scenes/GuardrailScene";
import { RoomsScene } from "./scenes/RoomsScene";
import { ProofScene } from "./scenes/ProofScene";
import { OutroScene } from "./scenes/OutroScene";

import { COLORS } from "./lib/design";
import { FPS, SCENES, TOTAL_DURATION, TRANSITION_FRAMES } from "./lib/timing";

const timing = linearTiming({ durationInFrames: TRANSITION_FRAMES });
const FADE = { presentation: fade(), timing };
const SLIDE_UP = { presentation: slide({ direction: "from-bottom" }), timing };
const SLIDE_LEFT = { presentation: slide({ direction: "from-right" }), timing };
const WIPE = { presentation: wipe({ direction: "from-left" }), timing };

/**
 * The film. Nine scenes, every one of them starting on the frame its narration
 * line starts (see lib/timing.ts), blended into each other so there is never a
 * hard cut. The background is mounted once, underneath, for continuity.
 */
export const DemoFilm: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      <PersistentBackground frame={frame} />

      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={SCENES.hero.duration}>
          <HeroScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...FADE} />

        <TransitionSeries.Sequence durationInFrames={SCENES.why.duration}>
          <WhyScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...SLIDE_LEFT} />

        <TransitionSeries.Sequence durationInFrames={SCENES.contract.duration}>
          <ContractScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...FADE} />

        <TransitionSeries.Sequence durationInFrames={SCENES.surface.duration}>
          <SurfaceScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...WIPE} />

        <TransitionSeries.Sequence durationInFrames={SCENES.realrun.duration}>
          <RealRunScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...FADE} />

        <TransitionSeries.Sequence durationInFrames={SCENES.guardrail.duration}>
          <GuardrailScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...SLIDE_UP} />

        <TransitionSeries.Sequence durationInFrames={SCENES.rooms.duration}>
          <RoomsScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...FADE} />

        <TransitionSeries.Sequence durationInFrames={SCENES.proof.duration}>
          <ProofScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...FADE} />

        <TransitionSeries.Sequence durationInFrames={SCENES.outro.duration}>
          <OutroScene />
        </TransitionSeries.Sequence>
      </TransitionSeries>

      {/* The narration this whole timeline was cut against. */}
      <Audio src={staticFile("narration.mp3")} />
    </AbsoluteFill>
  );
};

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="DemoFilm"
      component={DemoFilm}
      durationInFrames={TOTAL_DURATION}
      fps={FPS}
      width={1920}
      height={1080}
    />

    {/* Each scene on its own, for checking a beat without rendering the film. */}
    <Composition id="Hero" component={HeroScene} durationInFrames={SCENES.hero.duration} fps={FPS} width={1920} height={1080} />
    <Composition id="Why" component={WhyScene} durationInFrames={SCENES.why.duration} fps={FPS} width={1920} height={1080} />
    <Composition id="Contract" component={ContractScene} durationInFrames={SCENES.contract.duration} fps={FPS} width={1920} height={1080} />
    <Composition id="Surface" component={SurfaceScene} durationInFrames={SCENES.surface.duration} fps={FPS} width={1920} height={1080} />
    <Composition id="RealRun" component={RealRunScene} durationInFrames={SCENES.realrun.duration} fps={FPS} width={1920} height={1080} />
    <Composition id="Guardrail" component={GuardrailScene} durationInFrames={SCENES.guardrail.duration} fps={FPS} width={1920} height={1080} />
    <Composition id="Rooms" component={RoomsScene} durationInFrames={SCENES.rooms.duration} fps={FPS} width={1920} height={1080} />
    <Composition id="Proof" component={ProofScene} durationInFrames={SCENES.proof.duration} fps={FPS} width={1920} height={1080} />
    <Composition id="Outro" component={OutroScene} durationInFrames={SCENES.outro.duration} fps={FPS} width={1920} height={1080} />
  </>
);
