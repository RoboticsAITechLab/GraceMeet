"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useLocalParticipant } from "@livekit/components-react";
import {
  Room,
  Track,
  RoomEvent,
  LocalTrackPublication,
  LocalVideoTrack,
  ConnectionState,
} from "livekit-client";
import { PreJoinChoices } from "@/components/meeting/PreJoinScreen";

export interface GraceMediaState {
  isCameraEnabled: boolean;
  isMicrophoneEnabled: boolean;
  isCameraPending: boolean;
  isMicPending: boolean;
  cameraError: Error | null;
  micError: Error | null;
  cameraPublication: LocalTrackPublication | undefined;
  microphonePublication: LocalTrackPublication | undefined;
  facingMode: "user" | "environment";
  hasMultipleCameras: boolean;

  // Actions
  toggleCamera: () => Promise<boolean>;
  toggleMicrophone: () => Promise<boolean>;
  flipCamera: () => Promise<void>;
  recoverCamera: () => Promise<void>;
  syncMediaState: () => void;
  clearErrors: () => void;
}

/**
 * Formats low-level browser MediaStream errors into user-friendly guidance.
 */
function formatMediaError(err: unknown, deviceKind: "camera" | "microphone"): Error {
  if (err instanceof Error) {
    const name = err.name || "";
    const msg = err.message || "";
    const lower = msg.toLowerCase();

    // 1. Permission Denied
    if (
      name === "NotAllowedError" ||
      name === "PermissionDeniedError" ||
      lower.includes("permission") ||
      lower.includes("denied") ||
      lower.includes("not allowed")
    ) {
      return new Error(
        deviceKind === "camera"
          ? "Camera permission is blocked. Please allow camera access in browser settings (🔒 icon) and try again."
          : "Microphone permission is blocked. Please allow microphone access in browser settings (🔒 icon) and try again."
      );
    }

    // 2. Hardware in use / busy
    if (
      name === "NotReadableError" ||
      name === "TrackStartError" ||
      name === "AbortError" ||
      lower.includes("in use") ||
      lower.includes("busy") ||
      lower.includes("could not start")
    ) {
      return new Error(
        deviceKind === "camera"
          ? "Camera is currently in use or busy. Please close other camera apps and retry."
          : "Microphone is currently in use or busy. Please close other audio apps and retry."
      );
    }

    // 3. Device Not Found
    if (
      name === "NotFoundError" ||
      name === "DevicesNotFoundError" ||
      lower.includes("not found")
    ) {
      return new Error(
        deviceKind === "camera"
          ? "No camera device found. Please connect a video input device."
          : "No microphone device found. Please connect an audio input device."
      );
    }

    // 4. Constraint mismatch
    if (name === "OverconstrainedError" || lower.includes("constraint")) {
      return new Error(
        deviceKind === "camera"
          ? "Camera format or resolution constraint is not supported by your device."
          : "Microphone configuration constraint is not supported by your device."
      );
    }

    return new Error(msg || `Error activating ${deviceKind}.`);
  }

  return new Error(`Failed to access ${deviceKind}. Please check device permissions.`);
}

export function useGraceMediaState(
  room: Room | undefined,
  initialFacingMode: "user" | "environment" = "user",
  initialCamEnabled: boolean = true,
  initialMicEnabled: boolean = true,
  onUserChoiceChange?: (update: Partial<PreJoinChoices>) => void
): GraceMediaState {
  // Phase 1: LiveKit native LocalParticipant reactive state as Single Source of Truth
  const {
    localParticipant,
    isCameraEnabled: reactiveIsCameraEnabled,
    isMicrophoneEnabled: reactiveIsMicrophoneEnabled,
  } = useLocalParticipant({ room });

  // Reactive version bumper for LiveKit room track and mute events
  const [, setMediaVersion] = useState(0);
  const bumpMediaVersion = useCallback(() => setMediaVersion((v) => v + 1), []);

  useEffect(() => {
    if (!room) return;
    room.on(RoomEvent.LocalTrackPublished, bumpMediaVersion);
    room.on(RoomEvent.LocalTrackUnpublished, bumpMediaVersion);
    room.on(RoomEvent.TrackMuted, bumpMediaVersion);
    room.on(RoomEvent.TrackUnmuted, bumpMediaVersion);

    return () => {
      room.off(RoomEvent.LocalTrackPublished, bumpMediaVersion);
      room.off(RoomEvent.LocalTrackUnpublished, bumpMediaVersion);
      room.off(RoomEvent.TrackMuted, bumpMediaVersion);
      room.off(RoomEvent.TrackUnmuted, bumpMediaVersion);
    };
  }, [room, bumpMediaVersion]);

  // User intent tracking refs
  const userWantsCamRef = useRef(initialCamEnabled);
  const userWantsMicRef = useRef(initialMicEnabled);

  // In-flight operation mutex guards to serialize all media operations
  const isAcquiringCamRef = useRef(false);
  const isAcquiringMicRef = useRef(false);
  const [isCameraPending, setIsCameraPending] = useState(false);
  const [isMicPending, setIsMicPending] = useState(false);

  // User-facing media error states
  const [cameraError, setCameraError] = useState<Error | null>(null);
  const [micError, setMicError] = useState<Error | null>(null);

  // Mobile camera facingMode and camera detection
  const [facingMode, setFacingMode] =
    useState<"user" | "environment">(initialFacingMode);
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const isFlippingRef = useRef(false);

  // Keep intent synchronized if initial props change
  useEffect(() => {
    userWantsCamRef.current = initialCamEnabled;
  }, [initialCamEnabled]);

  useEffect(() => {
    userWantsMicRef.current = initialMicEnabled;
  }, [initialMicEnabled]);

  // Detect available camera hardware
  useEffect(() => {
    async function checkCameras() {
      try {
        const devices = await Room.getLocalDevices("videoinput");
        if (devices.length > 1) {
          setHasMultipleCameras(true);
        }
      } catch {
        if (typeof window !== "undefined" && "ontouchstart" in window) {
          setHasMultipleCameras(true);
        }
      }
    }
    checkCameras();

    if (room) {
      const handleDevicesChanged = () => {
        checkCameras();
      };
      room.on(RoomEvent.MediaDevicesChanged, handleDevicesChanged);
      return () => {
        room.off(RoomEvent.MediaDevicesChanged, handleDevicesChanged);
      };
    }
  }, [room]);

  // Surface native LiveKit media device errors to UI error state
  useEffect(() => {
    if (!room) return;

    const handleDeviceError = (err: Error) => {
      console.warn("[GraceMeet][Media] Media device notice from Room:", err);
      const msg = err.message.toLowerCase();
      if (msg.includes("video") || msg.includes("camera")) {
        setCameraError(formatMediaError(err, "camera"));
      } else {
        setMicError(formatMediaError(err, "microphone"));
      }
    };

    room.on(RoomEvent.MediaDevicesError, handleDeviceError);
    return () => {
      room.off(RoomEvent.MediaDevicesError, handleDeviceError);
    };
  }, [room]);

  // Controlled Camera Recovery: for mobile background-to-foreground transitions ONLY
  const recoverCamera = useCallback(async () => {
    if (!room || room.state !== ConnectionState.Connected || !localParticipant) return;
    if (isAcquiringCamRef.current || !userWantsCamRef.current) return;

    const camPub = localParticipant.getTrackPublication(Track.Source.Camera);
    const camTrack = camPub?.track?.mediaStreamTrack;
    const isHealthy =
      localParticipant.isCameraEnabled &&
      camPub &&
      camTrack &&
      camTrack.readyState === "live";

    if (isHealthy) return;

    isAcquiringCamRef.current = true;
    setIsCameraPending(true);
    try {
      console.log("[GraceMeet][Media] Controlled camera acquisition/recovery (facingMode:", facingMode, ")...");
      try {
        await localParticipant.setCameraEnabled(true, { facingMode });
      } catch (e) {
        console.warn("[GraceMeet][Media] FacingMode constraint rejected, retrying generic camera:", e);
        await localParticipant.setCameraEnabled(true);
      }
      setCameraError(null);
      console.log(
        "[GraceMeet][Media] Camera enabled/recovered successfully. Track readyState:",
        localParticipant.getTrackPublication(Track.Source.Camera)?.track?.mediaStreamTrack?.readyState
      );
    } catch (err) {
      console.error("[GraceMeet][Media] Camera acquisition/recovery failed:", err);
      setCameraError(formatMediaError(err, "camera"));
    } finally {
      isAcquiringCamRef.current = false;
      setIsCameraPending(false);
    }
  }, [room, localParticipant, facingMode]);

  // Mobile Reliability: Handle backgrounding and foreground recovery (when OS killed hardware track)
  useEffect(() => {
    if (!room) return;

    const handleVisibilityChange = async () => {
      if (document.hidden) {
        console.log("[GraceMeet][Mobile] Tab backgrounded. Preserving active media and room connection.");
        return;
      }

      console.log("[GraceMeet][Mobile] Tab returned to foreground. Inspecting media health...");
      if (room.state !== ConnectionState.Connected || !localParticipant) return;

      if (userWantsCamRef.current) {
        const camPub = localParticipant.getTrackPublication(Track.Source.Camera);
        const camMediaTrack = camPub?.track?.mediaStreamTrack;
        if (!camMediaTrack || camMediaTrack.readyState === "ended") {
          console.warn("[GraceMeet][Mobile] Camera track ended while backgrounded. Recovering...");
          recoverCamera();
        }
      }

      if (userWantsMicRef.current) {
        const micPub = localParticipant.getTrackPublication(Track.Source.Microphone);
        const micMediaTrack = micPub?.track?.mediaStreamTrack;
        if (!micMediaTrack || micMediaTrack.readyState === "ended") {
          console.warn("[GraceMeet][Mobile] Microphone track ended while backgrounded. Recovering...");
          try {
            await localParticipant.setMicrophoneEnabled(true);
          } catch (err) {
            setMicError(formatMediaError(err, "microphone"));
          }
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pageshow", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pageshow", handleVisibilityChange);
    };
  }, [room, localParticipant, recoverCamera]);

  // Single Authoritative Camera Toggle: serialized with mutex and in-place unmute optimization
  const toggleCamera = useCallback(async (): Promise<boolean> => {
    if (!localParticipant) return false;
    if (isAcquiringCamRef.current) {
      console.warn("[GraceMeet][Media] Camera toggle rejected: operation already in progress");
      return localParticipant.isCameraEnabled;
    }

    isAcquiringCamRef.current = true;
    setIsCameraPending(true);
    setCameraError(null);

    const nextState = !localParticipant.isCameraEnabled;
    userWantsCamRef.current = nextState;
    console.log(
      `[GraceMeet][Media] Toggle Camera: Current=${localParticipant.isCameraEnabled ? "ON" : "OFF"} -> Target=${nextState ? "ON" : "OFF"}`
    );

    try {
      if (nextState) {
        const existingPub = localParticipant.getTrackPublication(Track.Source.Camera);
        if (existingPub && existingPub.track && existingPub.track.mediaStreamTrack?.readyState === "live") {
          console.log("[GraceMeet][Media] Existing camera track is live, unmuting in-place...");
          await existingPub.unmute();
        } else {
          try {
            await localParticipant.setCameraEnabled(true, { facingMode });
          } catch (constraintErr) {
            console.warn("[GraceMeet][Media] FacingMode camera toggle rejected, retrying generic:", constraintErr);
            await localParticipant.setCameraEnabled(true);
          }
        }
      } else {
        await localParticipant.setCameraEnabled(false);
      }
      return localParticipant.isCameraEnabled;
    } catch (err: unknown) {
      const error = formatMediaError(err, "camera");
      console.error("[GraceMeet][Media] Camera toggle error:", err);
      setCameraError(error);
      return localParticipant.isCameraEnabled;
    } finally {
      isAcquiringCamRef.current = false;
      setIsCameraPending(false);
    }
  }, [localParticipant, facingMode]);

  // Single Authoritative Microphone Toggle: serialized with mutex and in-place unmute optimization
  const toggleMicrophone = useCallback(async (): Promise<boolean> => {
    if (!localParticipant) return false;
    if (isAcquiringMicRef.current) {
      console.warn("[GraceMeet][Media] Microphone toggle rejected: operation already in progress");
      return localParticipant.isMicrophoneEnabled;
    }

    isAcquiringMicRef.current = true;
    setIsMicPending(true);
    setMicError(null);

    const nextState = !localParticipant.isMicrophoneEnabled;
    userWantsMicRef.current = nextState;
    console.log(
      `[GraceMeet][Media] Toggle Microphone: Current=${localParticipant.isMicrophoneEnabled ? "ON" : "OFF"} -> Target=${nextState ? "ON" : "OFF"}`
    );

    try {
      if (nextState) {
        const existingPub = localParticipant.getTrackPublication(Track.Source.Microphone);
        if (existingPub && existingPub.track && existingPub.track.mediaStreamTrack?.readyState === "live") {
          console.log("[GraceMeet][Media] Existing mic track is live, unmuting in-place...");
          await existingPub.unmute();
        } else {
          try {
            await localParticipant.setMicrophoneEnabled(true, {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            });
          } catch (constraintErr) {
            console.warn("[GraceMeet][Media] Advanced mic toggle rejected, retrying generic:", constraintErr);
            await localParticipant.setMicrophoneEnabled(true);
          }
        }
      } else {
        await localParticipant.setMicrophoneEnabled(false);
      }
      return localParticipant.isMicrophoneEnabled;
    } catch (err: unknown) {
      const error = formatMediaError(err, "microphone");
      console.error("[GraceMeet][Media] Microphone toggle error:", err);
      setMicError(error);
      return localParticipant.isMicrophoneEnabled;
    } finally {
      isAcquiringMicRef.current = false;
      setIsMicPending(false);
    }
  }, [localParticipant]);

  // Flip Camera: uses native LiveKit restartTrack to seamlessly swap camera sensors
  const flipCamera = useCallback(async () => {
    if (
      !room ||
      !localParticipant ||
      !localParticipant.isCameraEnabled ||
      isFlippingRef.current
    ) {
      return;
    }

    isFlippingRef.current = true;
    const nextFacing = facingMode === "user" ? "environment" : "user";
    console.log(`[GraceMeet][Media] Flip Camera: ${facingMode} -> ${nextFacing}`);

    try {
      const camPub = localParticipant.getTrackPublication(Track.Source.Camera);
      const videoTrack = camPub?.track;

      if (videoTrack instanceof LocalVideoTrack) {
        await videoTrack.restartTrack({ facingMode: nextFacing });
        setFacingMode(nextFacing);
        onUserChoiceChange?.({ facingMode: nextFacing });
      } else {
        const devices = await Room.getLocalDevices("videoinput");
        if (devices.length > 1) {
          const currentDeviceId = videoTrack?.mediaStreamTrack?.getSettings()?.deviceId;
          const other = devices.find((d) => d.deviceId && d.deviceId !== currentDeviceId);
          if (other?.deviceId) {
            await room.switchActiveDevice("videoinput", other.deviceId);
            setFacingMode(nextFacing);
            onUserChoiceChange?.({ facingMode: nextFacing });
            return;
          }
        }
        await localParticipant.setCameraEnabled(false);
        await localParticipant.setCameraEnabled(true, { facingMode: nextFacing });
        setFacingMode(nextFacing);
        onUserChoiceChange?.({ facingMode: nextFacing });
      }
    } catch (err: unknown) {
      console.error("[GraceMeet][Media] Flip camera error:", err);
      setCameraError(formatMediaError(err, "camera"));
    } finally {
      isFlippingRef.current = false;
    }
  }, [room, localParticipant, facingMode, onUserChoiceChange]);

  const clearErrors = useCallback(() => {
    setCameraError(null);
    setMicError(null);
  }, []);

  const syncMediaState = useCallback(() => {
    bumpMediaVersion();
  }, [bumpMediaVersion]);

  // Single Source of Truth: Authoritative publication states derived reactively from LiveKit
  const isCameraEnabled = localParticipant
    ? (reactiveIsCameraEnabled ?? localParticipant.isCameraEnabled)
    : false;
  const isMicrophoneEnabled = localParticipant
    ? (reactiveIsMicrophoneEnabled ?? localParticipant.isMicrophoneEnabled)
    : false;

  const cameraPublication = localParticipant?.getTrackPublication(
    Track.Source.Camera
  );
  const microphonePublication = localParticipant?.getTrackPublication(
    Track.Source.Microphone
  );

  return {
    isCameraEnabled,
    isMicrophoneEnabled,
    isCameraPending,
    isMicPending,
    cameraError,
    micError,
    cameraPublication,
    microphonePublication,
    facingMode,
    hasMultipleCameras,
    toggleCamera,
    toggleMicrophone,
    flipCamera,
    recoverCamera,
    syncMediaState,
    clearErrors,
  };
}
