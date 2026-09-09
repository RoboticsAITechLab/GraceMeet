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
  initialMicEnabled: boolean = true
): GraceMediaState {
  // Phase 1: LiveKit native LocalParticipant state as Single Source of Truth
  const {
    localParticipant,
    isCameraEnabled,
    isMicrophoneEnabled,
  } = useLocalParticipant({ room });

  // Concurrency guards for rapid user interactions
  const [isCameraPending, setIsCameraPending] = useState(false);
  const [isMicPending, setIsMicPending] = useState(false);
  const isCameraPendingRef = useRef(false);
  const isMicPendingRef = useRef(false);

  // User-facing media error states
  const [cameraError, setCameraError] = useState<Error | null>(null);
  const [micError, setMicError] = useState<Error | null>(null);

  // Mobile camera facingMode and camera detection
  const [facingMode, setFacingMode] =
    useState<"user" | "environment">(initialFacingMode);
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const isFlippingRef = useRef(false);

  // Guard to ensure initial sequential media acquisition runs exactly once on room join
  const initialAcquisitionDoneRef = useRef(false);

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

  // Phase 2: Ordered Sequential Acquisition upon entering the meeting
  // Microphone is initialized first, Camera second.
  // Eliminates mobile hardware sensor contention and concurrent getUserMedia collision.
  useEffect(() => {
    if (!room || initialAcquisitionDoneRef.current) return;

    let isMounted = true;

    const runOrderedAcquisition = async () => {
      if (initialAcquisitionDoneRef.current || !isMounted) return;
      if (room.state !== ConnectionState.Connected) {
        console.log("[GraceMeet][Media] Waiting for room connection before media acquisition... Current state:", room.state);
        return;
      }

      initialAcquisitionDoneRef.current = true;

      // Diagnostic check for getUserMedia support in current browser context
      const hasMediaDevices = typeof navigator !== "undefined" && !!navigator.mediaDevices;
      const hasGetUserMedia = hasMediaDevices && typeof navigator.mediaDevices.getUserMedia === "function";
      console.log(
        `[GraceMeet][Media][Diag] Context check -> HTTPS/Localhost secure: ${typeof window !== "undefined" ? window.isSecureContext : "unknown"}, mediaDevices: ${hasMediaDevices}, getUserMedia: ${hasGetUserMedia}`
      );
      console.log(
        `[GraceMeet][Media] Starting ordered acquisition -> Mic requested: ${initialMicEnabled ? "ON" : "OFF"}, Cam requested: ${initialCamEnabled ? "ON" : "OFF"} | LiveKit initial state -> Mic: ${room.localParticipant.isMicrophoneEnabled ? "ON" : "OFF"}, Cam: ${room.localParticipant.isCameraEnabled ? "ON" : "OFF"}`
      );

      // Brief 150ms buffer to allow browser camera/audio drivers to fully release pre-join preview tracks
      await new Promise((resolve) => setTimeout(resolve, 150));
      if (!isMounted) return;

      // Step 1: Microphone acquired FIRST (if not already enabled by LiveKitRoom)
      if (initialMicEnabled && !room.localParticipant.isMicrophoneEnabled) {
        try {
          isMicPendingRef.current = true;
          setIsMicPending(true);
          console.log("[GraceMeet][Media] Acquiring microphone track...");
          try {
            await room.localParticipant.setMicrophoneEnabled(true, {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            });
          } catch (micConstraintErr) {
            console.warn("[GraceMeet][Media] Advanced mic constraints rejected, retrying basic:", micConstraintErr);
            await room.localParticipant.setMicrophoneEnabled(true);
          }
          console.log(
            "[GraceMeet][Media] Initial microphone published successfully. Track readyState:",
            room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track?.mediaStreamTrack?.readyState
          );
        } catch (err: unknown) {
          const error = formatMediaError(err, "microphone");
          console.error(
            `[GraceMeet][Media] Initial mic acquisition error: [${(err as Error)?.name || "Unknown"}] ${(err as Error)?.message || String(err)}`,
            err
          );
          setMicError(error);
        } finally {
          isMicPendingRef.current = false;
          setIsMicPending(false);
        }
      }

      // Brief 150ms stagger between mic and cam to prevent hardware sensor contention
      await new Promise((resolve) => setTimeout(resolve, 150));
      if (!isMounted) return;

      // Step 2: Camera acquired SECOND (if not already enabled by LiveKitRoom)
      if (initialCamEnabled && !room.localParticipant.isCameraEnabled) {
        try {
          isCameraPendingRef.current = true;
          setIsCameraPending(true);
          console.log("[GraceMeet][Media] Acquiring camera track with facingMode:", facingMode);
          try {
            await room.localParticipant.setCameraEnabled(true, { facingMode });
          } catch (camConstraintErr) {
            console.warn("[GraceMeet][Media] FacingMode camera constraints rejected, retrying generic:", camConstraintErr);
            await room.localParticipant.setCameraEnabled(true);
          }
          console.log(
            "[GraceMeet][Media] Initial camera published successfully. Track readyState:",
            room.localParticipant.getTrackPublication(Track.Source.Camera)?.track?.mediaStreamTrack?.readyState
          );
        } catch (err: unknown) {
          const error = formatMediaError(err, "camera");
          console.error(
            `[GraceMeet][Media] Initial camera acquisition error: [${(err as Error)?.name || "Unknown"}] ${(err as Error)?.message || String(err)}`,
            err
          );
          setCameraError(error);
        } finally {
          isCameraPendingRef.current = false;
          setIsCameraPending(false);
        }
      }
    };

    if (room.state === ConnectionState.Connected) {
      runOrderedAcquisition();
    } else {
      room.once(RoomEvent.Connected, runOrderedAcquisition);
    }

    return () => {
      isMounted = false;
      room.off(RoomEvent.Connected, runOrderedAcquisition);
    };
  }, [room, initialCamEnabled, initialMicEnabled, facingMode]);

  // Robust Camera Toggle: directly modifies localParticipant with generic fallback
  const toggleCamera = useCallback(async (): Promise<boolean> => {
    if (!localParticipant || isCameraPendingRef.current) {
      return isCameraEnabled;
    }

    isCameraPendingRef.current = true;
    setIsCameraPending(true);
    setCameraError(null);

    const targetState = !localParticipant.isCameraEnabled;
    console.log(
      `[GraceMeet][Media] Toggle Camera: Current=${localParticipant.isCameraEnabled ? "ON" : "OFF"} -> Target=${targetState ? "ON" : "OFF"}`
    );

    try {
      if (targetState) {
        try {
          await localParticipant.setCameraEnabled(true, { facingMode });
        } catch (constraintErr) {
          console.warn("[GraceMeet][Media] FacingMode camera toggle failed, retrying generic:", constraintErr);
          await localParticipant.setCameraEnabled(true);
        }
        console.log(
          "[GraceMeet][Media] Camera enabled successfully. Track readyState:",
          localParticipant.getTrackPublication(Track.Source.Camera)?.track?.mediaStreamTrack?.readyState
        );
      } else {
        await localParticipant.setCameraEnabled(false);
        console.log("[GraceMeet][Media] Camera disabled successfully");
      }
      return localParticipant.isCameraEnabled;
    } catch (err: unknown) {
      const error = formatMediaError(err, "camera");
      console.error(
        `[GraceMeet][Media] Camera toggle error: [${(err as Error)?.name || "Unknown"}] ${(err as Error)?.message || String(err)}`,
        err
      );
      setCameraError(error);
      throw error;
    } finally {
      isCameraPendingRef.current = false;
      setIsCameraPending(false);
    }
  }, [localParticipant, facingMode, isCameraEnabled]);

  // Robust Microphone Toggle: directly modifies localParticipant with generic fallback
  const toggleMicrophone = useCallback(async (): Promise<boolean> => {
    if (!localParticipant || isMicPendingRef.current) {
      return isMicrophoneEnabled;
    }

    isMicPendingRef.current = true;
    setIsMicPending(true);
    setMicError(null);

    const targetState = !localParticipant.isMicrophoneEnabled;
    console.log(
      `[GraceMeet][Media] Toggle Microphone: Current=${localParticipant.isMicrophoneEnabled ? "ON" : "OFF"} -> Target=${targetState ? "ON" : "OFF"}`
    );

    try {
      if (targetState) {
        try {
          await localParticipant.setMicrophoneEnabled(true, {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          });
        } catch (constraintErr) {
          console.warn("[GraceMeet][Media] Advanced mic toggle failed, retrying generic:", constraintErr);
          await localParticipant.setMicrophoneEnabled(true);
        }
        console.log(
          "[GraceMeet][Media] Microphone enabled successfully. Track readyState:",
          localParticipant.getTrackPublication(Track.Source.Microphone)?.track?.mediaStreamTrack?.readyState
        );
      } else {
        await localParticipant.setMicrophoneEnabled(false);
        console.log("[GraceMeet][Media] Microphone muted successfully");
      }
      return localParticipant.isMicrophoneEnabled;
    } catch (err: unknown) {
      const error = formatMediaError(err, "microphone");
      console.error(
        `[GraceMeet][Media] Microphone toggle error: [${(err as Error)?.name || "Unknown"}] ${(err as Error)?.message || String(err)}`,
        err
      );
      setMicError(error);
      throw error;
    } finally {
      isMicPendingRef.current = false;
      setIsMicPending(false);
    }
  }, [localParticipant, isMicrophoneEnabled]);

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
      } else {
        const devices = await Room.getLocalDevices("videoinput");
        if (devices.length > 1) {
          const currentDeviceId = videoTrack?.mediaStreamTrack?.getSettings()?.deviceId;
          const other = devices.find((d) => d.deviceId && d.deviceId !== currentDeviceId);
          if (other?.deviceId) {
            await room.switchActiveDevice("videoinput", other.deviceId);
            setFacingMode(nextFacing);
            return;
          }
        }
        await localParticipant.setCameraEnabled(false);
        await localParticipant.setCameraEnabled(true, { facingMode: nextFacing });
        setFacingMode(nextFacing);
      }
    } catch (err: unknown) {
      console.error("[GraceMeet][Media] Flip camera error:", err);
      setCameraError(formatMediaError(err, "camera"));
    } finally {
      isFlippingRef.current = false;
    }
  }, [room, localParticipant, facingMode]);

  const clearErrors = useCallback(() => {
    setCameraError(null);
    setMicError(null);
  }, []);

  const syncMediaState = useCallback(() => {
    // Kept for interface backward compatibility.
    // Media state is reactively driven by LiveKit's useLocalParticipant.
  }, []);

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
    syncMediaState,
    clearErrors,
  };
}
